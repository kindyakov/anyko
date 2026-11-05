# Database client generation

`bun --filter @anyko/database generate` builds the Prisma client from the
versioned schema into `generated/client`. This directory is excluded from Git
and local build contexts; Docker generates it in its own tools stage and copies
that output into runtime images. API and worker do not depend on the web build.

The generated client uses `@prisma/client` and `@prisma/client-runtime-utils` as
runtime companions. Both must be direct dependencies for isolated Bun installs.
Knip ignores these direct dependencies only in this workspace because generated sources are
excluded from manual-code analysis. Owner: the Anyko database package. Remove
the exception if the generator no longer needs this runtime package or Knip can
trace it without including generated code. This exception does not suppress
unused manual exports or dependencies in other workspaces.
