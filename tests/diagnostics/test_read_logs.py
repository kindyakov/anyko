import datetime as dt
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("read_logs", Path(__file__).parents[2] / "scripts/read-logs.py")
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)
NOW = dt.datetime(2026, 11, 5, 12, tzinfo=dt.timezone.utc)


def line(message, tag="anyko-production-api"):
    return json.dumps({"SYSLOG_IDENTIFIER": tag, "MESSAGE": message}).encode() + b"\n"


class LogReaderTests(unittest.TestCase):
    def query(self, **kwargs):
        return reader.validate_query({"service": "api", **kwargs}, NOW)

    def test_command_scope_and_historical_interval(self):
        query = self.query(since="2026-11-01T00:00:00Z", until="2026-11-02T00:00:00Z")
        command = reader.journal_command(query)
        self.assertEqual(command[0], "/usr/bin/journalctl")
        self.assertIn("SYSLOG_IDENTIFIER=anyko-production-api", command)
        self.assertIn("--since=2026-11-01 00:00:00 UTC", command)
        self.assertIn("--lines=5001", command)

    def test_rejects_privilege_expansion_and_invalid_limits(self):
        for kwargs in ({"service": "api;id"}, {"service": ["api"]}, {"environment": "other"},
                       {"limit": True}, {"limit": 1001}, {"file": "/var/log/auth"},
                       {"since": "2026-10-01T00:00:00Z"}, {"requestId": "$(id)"},
                       {"until": "2026-11-06T00:00:00Z"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(reader.InvalidQuery):
                self.query(**kwargs)

    def test_matches_correlation_and_rechecks_scope(self):
        raw = (line('{"correlationId":"abc","event":"done"}') +
               line('{"correlationId":"abc"}', "foreign") +
               line('{"correlationId":"other"}'))
        events, summary = reader.select_events(raw, self.query(correlationId="abc"))
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["data"]["event"], "done")
        self.assertFalse(summary["truncated"])

    def test_preserves_crash_text_and_reports_result_cap(self):
        events, summary = reader.select_events(line("Bun crashed") + line("second"), self.query(limit=1))
        self.assertEqual(events[0]["parseStatus"], "text")
        self.assertEqual(events[0]["data"], {"message": "Bun crashed"})
        self.assertTrue(summary["truncated"])

    def test_scan_cap_is_visible_even_when_no_match(self):
        with patch.object(reader, "SCAN_LIMIT", 2):
            events, summary = reader.select_events(line("one") * 3, self.query(correlationId="missing"))
        self.assertEqual(events, [])
        self.assertEqual(summary["scanned"], 2)
        self.assertTrue(summary["truncated"])

    def test_limits_oversize_records_and_output(self):
        with patch.object(reader, "LINE_LIMIT", 50):
            events, summary = reader.select_events(line("x" * 100), self.query())
        self.assertEqual(events, [])
        self.assertTrue(summary["truncated"])
        with patch.object(reader, "OUTPUT_LIMIT", 10):
            events, summary = reader.select_events(line("ok"), self.query())
        self.assertEqual(events, [])
        self.assertTrue(summary["truncated"])


if __name__ == "__main__":
    unittest.main()
