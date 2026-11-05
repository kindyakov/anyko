#!/usr/bin/python3
"""Restricted Anyko journal reader. Install root-owned; JSON request on stdin."""

import datetime as dt
import json
import os
import re
import signal
import subprocess
import sys
import tempfile

SERVICES = frozenset(("api", "worker", "web", "redis"))
ENVIRONMENTS = frozenset(("production", "staging"))
SCAN_LIMIT = 5000
BYTE_LIMIT = 8 * 1024 * 1024
LINE_LIMIT = 64 * 1024
OUTPUT_LIMIT = 2 * 1024 * 1024
FILTERS = ("requestId", "correlationId", "jobId", "release", "event")


class InvalidQuery(ValueError):
    pass


def parse_time(value):
    if not isinstance(value, str) or len(value) > 40:
        raise InvalidQuery("time must be an ISO timestamp with timezone")
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise InvalidQuery("time must be an ISO timestamp with timezone") from None
    if parsed.tzinfo is None:
        raise InvalidQuery("time requires timezone")
    return parsed.astimezone(dt.timezone.utc)


def validate_query(value, now=None):
    if not isinstance(value, dict):
        raise InvalidQuery("request must be an object")
    if set(value) - {"service", "environment", "since", "until", "limit", *FILTERS}:
        raise InvalidQuery("unknown query field")
    service = value.get("service")
    environment = value.get("environment", "production")
    if not isinstance(service, str) or service not in SERVICES:
        raise InvalidQuery("service is not allowed")
    if not isinstance(environment, str) or environment not in ENVIRONMENTS:
        raise InvalidQuery("environment is not allowed")
    limit = value.get("limit", 200)
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise InvalidQuery("limit must be between 1 and 1000")
    now = now or dt.datetime.now(dt.timezone.utc)
    until = parse_time(value["until"]) if "until" in value else now
    since = parse_time(value["since"]) if "since" in value else until - dt.timedelta(minutes=30)
    if since >= until or until - since > dt.timedelta(days=1) or until > now:
        raise InvalidQuery("query interval must be in the past and at most 24 hours")
    filters = {}
    for key in FILTERS:
        if key in value:
            item = value[key]
            if not isinstance(item, str) or not re.fullmatch(r"[A-Za-z0-9_.:/-]{1,128}", item):
                raise InvalidQuery("invalid filter value")
            filters[key] = item
    return {
        "service": service, "environment": environment, "limit": limit,
        "since": since, "until": until, "filters": filters,
    }


def journal_command(query):
    return [
        "/usr/bin/journalctl", "--no-pager", "--output=json", "--all", "--reverse",
        "--lines=" + str(SCAN_LIMIT + 1),
        "--since=" + query["since"].strftime("%Y-%m-%d %H:%M:%S UTC"),
        "--until=" + query["until"].strftime("%Y-%m-%d %H:%M:%S UTC"),
        "SYSLOG_IDENTIFIER=anyko-" + query["environment"] + "-" + query["service"],
    ]


def select_events(raw, query):
    events = []
    scanned = 0
    output_bytes = 0
    truncated = len(raw) > BYTE_LIMIT
    for line in raw[:BYTE_LIMIT].splitlines():
        scanned += 1
        if scanned > SCAN_LIMIT:
            truncated = True
            break
        if len(line) > LINE_LIMIT:
            truncated = True
            continue
        try:
            record = json.loads(line)
        except (ValueError, UnicodeDecodeError):
            truncated = True
            continue
        if not isinstance(record, dict):
            continue
        # Recheck scope even though journalctl already applies the trusted tag.
        expected = "anyko-" + query["environment"] + "-" + query["service"]
        if record.get("SYSLOG_IDENTIFIER") != expected:
            continue
        message = record.get("MESSAGE", "")
        if not isinstance(message, str):
            message = "[non-text journal message]"
        try:
            payload = json.loads(message)
        except ValueError:
            payload = None
        structured = isinstance(payload, dict)
        if query["filters"] and (not structured or any(
            payload.get(key) != value for key, value in query["filters"].items()
        )):
            continue
        event = {
            "type": "event", "service": query["service"],
            "environment": query["environment"],
            "journalTime": record.get("__REALTIME_TIMESTAMP"),
            "parseStatus": "json" if structured else "text",
            "data": payload if structured else {"message": message},
        }
        encoded_size = len(json.dumps(event, ensure_ascii=True).encode("utf-8"))
        if len(events) >= query["limit"] or output_bytes + encoded_size > OUTPUT_LIMIT:
            truncated = True
            break
        events.append(event)
        output_bytes += encoded_size
    return events, {"type": "summary", "returned": len(events), "scanned": min(scanned, SCAN_LIMIT),
                    "truncated": truncated, "order": "newest-first"}


def read_journal(query):
    # A file avoids unbounded in-memory capture. Input scope, lines and execution
    # time are bounded before invocation; bytes are bounded before parsing.
    import resource  # Linux server only; keep pure parsing portable for tests.

    def restrict_output():
        resource.setrlimit(resource.RLIMIT_FSIZE, (BYTE_LIMIT + 1, BYTE_LIMIT + 1))

    with tempfile.TemporaryFile() as output:
        result = subprocess.run(
            journal_command(query), stdin=subprocess.DEVNULL, stdout=output,
            stderr=subprocess.DEVNULL, timeout=15, check=False,
            env={"PATH": "/usr/bin:/bin", "LC_ALL": "C"},
            preexec_fn=restrict_output,
        )
        size = output.tell()
        if result.returncode != 0 and size <= BYTE_LIMIT:
            raise RuntimeError("journal unavailable")
        output.seek(0)
        return output.read(BYTE_LIMIT + 1)


def main():
    def deadline(_signum, _frame):
        raise TimeoutError("reader deadline")

    try:
        # Linux entry point: bound stdin as well as journal execution.
        signal.signal(signal.SIGALRM, deadline)
        signal.alarm(25)
        if os.environ.get("SSH_ORIGINAL_COMMAND"):
            raise InvalidQuery("remote commands are not allowed; send JSON on stdin")
        data = sys.stdin.buffer.read(8193)
        if len(data) > 8192:
            raise InvalidQuery("request too large")
        query = validate_query(json.loads(data))
        events, summary = select_events(read_journal(query), query)
        for event in events:
            print(json.dumps(event, ensure_ascii=True))
        print(json.dumps(summary))
        return 0
    except (InvalidQuery, ValueError, UnicodeDecodeError):
        print(json.dumps({"type": "error", "code": "INVALID_QUERY"}))
        return 2
    except (OSError, RuntimeError, subprocess.TimeoutExpired):
        print(json.dumps({"type": "error", "code": "JOURNAL_UNAVAILABLE"}))
        return 1
    finally:
        signal.alarm(0)


if __name__ == "__main__":
    sys.exit(main())
