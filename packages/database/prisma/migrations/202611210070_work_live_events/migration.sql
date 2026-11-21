-- Serialize event IDs for the same work until commit. Readers resume with id > cursor.
CREATE FUNCTION anyko_assign_work_event_cursor() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('anyko:work-events:' || NEW."workspaceId" || ':' || NEW."workId", 0));
  NEW.id := nextval(pg_get_serial_sequence('"WorkEvent"', 'id'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_event_cursor BEFORE INSERT ON "WorkEvent"
FOR EACH ROW EXECUTE FUNCTION anyko_assign_work_event_cursor();

CREATE FUNCTION anyko_signal_work_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('anyko_runtime_events', json_build_object(
    'workspaceId', NEW."workspaceId", 'workId', NEW."workId", 'kind', TG_ARGV[0],
    'eventKind', CASE WHEN TG_ARGV[0] = 'work' THEN NEW.kind ELSE NULL END
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_event_signal AFTER INSERT ON "WorkEvent"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_work_change('work');

CREATE TRIGGER work_history_signal AFTER INSERT OR UPDATE ON "WorkAgentEvent"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_work_change('history');

CREATE FUNCTION anyko_signal_workspace_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('anyko_runtime_events', json_build_object(
    'workspaceId', NEW."workspaceId", 'kind', TG_ARGV[0]
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER work_list_signal AFTER INSERT OR UPDATE OF "deletedAt", title ON "Work"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_workspace_change('work-list');

CREATE TRIGGER work_deletion_signal AFTER INSERT OR UPDATE ON "WorkDeletion"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_workspace_change('work-list');

CREATE FUNCTION anyko_signal_recognition() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  source_id text;
BEGIN
  IF TG_TABLE_NAME = 'SourceDocument' THEN
    source_id := NEW.id;
  ELSE
    source_id := NEW."documentId";
  END IF;
  PERFORM pg_notify('anyko_runtime_events', json_build_object(
    'workspaceId', NEW."workspaceId", 'documentId', source_id, 'kind', 'recognition'
  )::text);
  RETURN NEW;
END;
$$;

CREATE TRIGGER recognition_run_signal AFTER INSERT OR UPDATE OF status ON "Run"
FOR EACH ROW WHEN (NEW.kind = 'document.ocr' AND NEW."documentId" IS NOT NULL)
EXECUTE FUNCTION anyko_signal_recognition();

CREATE TRIGGER recognition_source_signal AFTER INSERT OR UPDATE OF "deletedAt", "purgedAt" ON "SourceDocument"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_recognition();

CREATE TRIGGER recognition_deletion_signal AFTER INSERT OR UPDATE OF "completedAt" ON "DocumentDeletion"
FOR EACH ROW EXECUTE FUNCTION anyko_signal_workspace_change('recognition');
