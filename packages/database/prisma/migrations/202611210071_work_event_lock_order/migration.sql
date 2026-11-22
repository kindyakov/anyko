-- Lock the parent before the per-work cursor. The foreign key otherwise takes
-- the parent lock after the trigger, in reverse order to a Work change.
CREATE OR REPLACE FUNCTION anyko_assign_work_event_cursor() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "Work"
    WHERE "workspaceId" = NEW."workspaceId" AND id = NEW."workId"
    FOR KEY SHARE;
  PERFORM pg_advisory_xact_lock(hashtextextended('anyko:work-events:' || NEW."workspaceId" || ':' || NEW."workId", 0));
  NEW.id := nextval(pg_get_serial_sequence('"WorkEvent"', 'id'));
  RETURN NEW;
END;
$$;
