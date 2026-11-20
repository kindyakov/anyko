import * as catalog from '@anyko/contracts/catalog';
import { type Endpoint, isEndpoint } from '@anyko/contracts/common';
import * as common from '@anyko/contracts/common';
import * as connections from '@anyko/contracts/connections';
import * as documents from '@anyko/contracts/documents';
import * as session from '@anyko/contracts/session';
import * as works from '@anyko/contracts/works';

// Тест реестра сверяет этот перечень с exports пакета contracts.
export const contractModules = {
  catalog,
  common,
  connections,
  documents,
  session,
  works,
};

export interface NamedEndpoint {
  resource: keyof typeof contractModules;
  name: string;
  endpoint: Endpoint;
}

export function namedEndpoints(): NamedEndpoint[] {
  return Object.entries(contractModules).flatMap(([resource, module]) =>
    Object.entries(module).flatMap(([name, endpoint]) =>
      isEndpoint(endpoint)
        ? [{ resource: resource as NamedEndpoint['resource'], name, endpoint }]
        : [],
    ),
  );
}

export function describedEndpoints(): Endpoint[] {
  return namedEndpoints().map(({ endpoint }) => endpoint);
}
