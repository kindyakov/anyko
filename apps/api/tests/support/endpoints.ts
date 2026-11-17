import * as catalog from '@anyko/contracts/catalog';
import { type Endpoint, isEndpoint } from '@anyko/contracts/common';
import * as common from '@anyko/contracts/common';
import * as connections from '@anyko/contracts/connections';
import * as documents from '@anyko/contracts/documents';
import * as session from '@anyko/contracts/session';
import * as works from '@anyko/contracts/works';

// Каждый subpath contracts перечислен здесь; тест реестра ловит subpath, забытый в этом списке.
export const contractModules = {
  catalog,
  common,
  connections,
  documents,
  session,
  works,
};

export function describedEndpoints(): Endpoint[] {
  return Object.values(contractModules).flatMap((module) =>
    Object.values(module).filter(isEndpoint),
  );
}
