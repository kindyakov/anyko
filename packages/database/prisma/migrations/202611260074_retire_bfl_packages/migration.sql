BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

CREATE FUNCTION anyko_retired_bfl_package_versions() RETURNS SETOF text
LANGUAGE sql IMMUTABLE AS $$
  VALUES ('bfl-bankruptcy-v1'), ('bfl-bankruptcy-v2'), ('bfl-bankruptcy-v3'),
    ('bfl-bankruptcy-v4'), ('bfl-bankruptcy-v5'), ('bfl-bankruptcy-v6'),
    ('bfl-bankruptcy-v7'), ('bfl-bankruptcy-v8'), ('bfl-bankruptcy-v9'),
    ('bfl-bankruptcy-v10'), ('bfl-bankruptcy-v11');
$$;

-- Stop serving or delivering old works while leaving all their artifact keys
-- available to the normal work deletion lifecycle. Sources belong to the catalog.
UPDATE "Work" work
SET "deletedAt" = COALESCE(work."deletedAt", CURRENT_TIMESTAMP)
FROM "DocumentPackageVersion" package
WHERE work."packageVersion" = package.version
  AND package."packageId" = 'bfl-bankruptcy'
  AND package.version IN (SELECT anyko_retired_bfl_package_versions());

INSERT INTO "WorkDeletion" (id, "workspaceId")
SELECT work.id, work."workspaceId"
FROM "Work" work
JOIN "DocumentPackageVersion" package ON package.version = work."packageVersion"
WHERE package."packageId" = 'bfl-bankruptcy'
  AND package.version IN (SELECT anyko_retired_bfl_package_versions())
ON CONFLICT (id) DO NOTHING;

UPDATE "Run" run
SET status = 'cancelled', "attemptToken" = NULL, "leaseUntil" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Work" work
JOIN "DocumentPackageVersion" package ON package.version = work."packageVersion"
WHERE run."workspaceId" = work."workspaceId" AND run."workId" = work.id
  AND run.status IN ('queued', 'running')
  AND package."packageId" = 'bfl-bankruptcy'
  AND package.version IN (SELECT anyko_retired_bfl_package_versions());

UPDATE "IdempotencyKey" replay
SET state = 'resource_unavailable', status = NULL, body = NULL
FROM "Work" work
JOIN "DocumentPackageVersion" package ON package.version = work."packageVersion"
WHERE replay."workspaceId" = work."workspaceId"
  AND replay."resourceKind" = 'work' AND replay."resourceId" = work.id
  AND replay.state = 'completed'
  AND package."packageId" = 'bfl-bankruptcy'
  AND package.version IN (SELECT anyko_retired_bfl_package_versions());

CREATE FUNCTION anyko_prune_retired_bfl_catalog() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  removable text[];
BEGIN
  -- Two maintenance executions may finish different works concurrently.
  IF NOT pg_try_advisory_xact_lock(hashtext('anyko:retire-bfl-catalog')) THEN
    RETURN;
  END IF;

  SELECT array_agg(package.version) INTO removable
  FROM "DocumentPackageVersion" package
  WHERE package."packageId" = 'bfl-bankruptcy'
    AND package.version IN (SELECT anyko_retired_bfl_package_versions())
    AND NOT EXISTS (
      SELECT 1 FROM "Work" work WHERE work."packageVersion" = package.version
    )
    AND NOT EXISTS (
      SELECT 1 FROM "WorkGeneration" generation
      WHERE generation."packageVersion" = package.version
    );

  IF removable IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM "PackageDocument" WHERE "packageVersion" = ANY(removable);
  DELETE FROM "DocumentPackageVersion" WHERE version = ANY(removable);

  -- A retained package can still use a form first published in an old package.
  DELETE FROM "DocumentTemplateVersion" template
  WHERE template.version IN (
    'bfl-statement-v1', 'bfl-statement-v2', 'bfl-statement-v3', 'bfl-statement-v4',
    'bfl-statement-v5', 'bfl-statement-v6', 'bfl-statement-v7', 'bfl-statement-v8',
    'bfl-statement-v9', 'bfl-statement-v10',
    'bfl-inventory-v1', 'bfl-creditors-v1', 'bfl-creditors-v2'
  )
    AND NOT EXISTS (
      SELECT 1 FROM "PackageDocument" link WHERE link."templateVersion" = template.version
    );
END;
$$;

-- Fresh databases have no works to delete, so the catalog can be pruned now.
SELECT anyko_prune_retired_bfl_catalog();
COMMIT;
