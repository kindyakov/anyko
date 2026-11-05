import { dirname, relative, resolve, sep } from 'node:path';

const ioGlobals = [
  'fetch',
  'Bun',
  'Deno',
  'process',
  'require',
  'WebSocket',
  'XMLHttpRequest',
  'EventSource',
  'Worker',
  'globalThis',
  'global',
];

export const architectureRules = {
  'no-cross-package-source': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        boundary:
          'Import another workspace through its declared public package exports.',
      },
    },
    create(context) {
      const root = context.cwd;
      const file = relative(root, context.filename).split(sep).join('/');
      const owner = /^(apps|packages)\/([^/]+)\//.exec(file);
      function check(node, value) {
        if (!owner || typeof value !== 'string') return;
        if (/^@anyko\/[^/]+\/src(?:\/|$)/.test(value)) {
          context.report({ node, messageId: 'boundary' });
          return;
        }
        if (!value.startsWith('.')) return;
        const target = relative(root, resolve(dirname(context.filename), value))
          .split(sep)
          .join('/');
        const other = /^(apps|packages)\/([^/]+)(?:\/|$)/.exec(target);
        if (other && (owner[1] !== other[1] || owner[2] !== other[2]))
          context.report({ node, messageId: 'boundary' });
      }
      return {
        ImportDeclaration(node) {
          check(node, node.source.value);
        },
        ExportNamedDeclaration(node) {
          if (node.source) check(node, node.source.value);
        },
        ExportAllDeclaration(node) {
          check(node, node.source.value);
        },
        ImportExpression(node) {
          if (node.source.type === 'Literal') check(node, node.source.value);
        },
        CallExpression(node) {
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            node.arguments[0]?.type === 'Literal'
          )
            check(node, node.arguments[0].value);
        },
      };
    },
  },
};

export const restrictedIoGlobals = ioGlobals.map((name) => ({
  name,
  message:
    'Pass data or a narrow port explicitly instead of using ambient I/O.',
}));
