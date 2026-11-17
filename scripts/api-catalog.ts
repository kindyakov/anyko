import {
  contractModules,
  namedEndpoints,
} from '../apps/api/tests/support/endpoints';

const catalogFile = Bun.file(
  new URL('../docs/engineering/api-catalog.md', import.meta.url),
);

export function renderApiCatalog(): string {
  const entries = namedEndpoints();
  const exportedValues = Object.values(contractModules).flatMap(Object.entries);
  const lines = [
    '# Каталог HTTP API',
    '',
    'Сгенерировано из описаний contracts. Для обновления выполните `bun run api:catalog`.',
    'В таблице указаны коды каждого описания сверх общих ошибок транспорта.',
    '',
  ];

  for (const resource of Object.keys(contractModules).sort()) {
    const group = entries.filter((entry) => entry.resource === resource);
    if (group.length === 0) continue;
    lines.push(
      `## ${resource}`,
      '',
      '| Метод | Путь | Описание | Назначение | Идемпотентность | Статус | Ответ | Коды ошибок |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const { name, endpoint } of group.sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      const { method, path, summary, response, status, idempotency, errors } =
        endpoint;
      const schemaName =
        response.kind === 'json'
          ? exportedValues.find(([, schema]) => schema === response.schema)?.[0]
          : undefined;
      lines.push(
        `| ${method} | \`/api/v1${path}\` | \`${name}\` | ${summary.replaceAll('|', '\\|')} | ${idempotency ?? '—'} | ${status} | ${response.kind}${schemaName ? ` (\`${schemaName}\`)` : ''} | ${errors.join(', ') || '—'} |`,
      );
    }
    lines.push('');
  }
  const formatted = Bun.spawnSync(
    [
      process.execPath,
      'fmt',
      '--stdin-filepath=docs/engineering/api-catalog.md',
    ],
    { stdin: new TextEncoder().encode(lines.join('\n')) },
  );
  if (!formatted.success) {
    throw new Error(formatted.stderr.toString());
  }
  return formatted.stdout.toString();
}

export async function apiCatalogIsCurrent(expected: string): Promise<boolean> {
  return (
    (await catalogFile.exists()) &&
    (await catalogFile.text()).replaceAll('\r\n', '\n') === expected
  );
}

if (import.meta.main) {
  const expected = renderApiCatalog();
  if (await apiCatalogIsCurrent(expected)) {
    console.log('Каталог API актуален');
  } else {
    await Bun.write(catalogFile, expected);
    console.log('Обновлён docs/engineering/api-catalog.md');
  }
}
