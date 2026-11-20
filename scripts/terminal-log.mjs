import { StringDecoder } from 'node:string_decoder';

const levels = {
  10: ['TRACE', 90],
  20: ['DEBUG', 36],
  30: ['INFO', 32],
  40: ['WARN', 33],
  50: ['ERROR', 31],
  60: ['FATAL', 31],
};

function display(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

function formatLine(line, color, structuredService) {
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    return structuredService === undefined ? line : undefined;
  }
  if (
    !record ||
    typeof record !== 'object' ||
    typeof record.level !== 'number' ||
    !Object.hasOwn(levels, record.level) ||
    typeof record.event !== 'string' ||
    typeof record.service !== 'string'
  )
    return structuredService === undefined ? line : undefined;
  if (structuredService !== undefined)
    return record.schemaVersion === 1 && record.service === structuredService
      ? line
      : undefined;
  const { level, time, service, event, failure, ...details } = record;
  const [label, code] = levels[level];
  const title = color ? `\x1b[${code}m${label}\x1b[0m` : label;
  const fields = Object.entries(details)
    .filter(
      ([key]) => !['schemaVersion', 'environment', 'release'].includes(key),
    )
    .map(([key, value]) => `${display(key)}=${JSON.stringify(value)}`)
    .join(' ');
  const diagnostic =
    typeof failure?.message === 'string' &&
    typeof failure?.operation === 'string'
      ? ` ${display(failure.message)} operation=${display(failure.operation)}`
      : '';
  return `${display(time ?? '')} ${title} [${display(service)}] ${display(event)}${diagnostic}${fields ? ` ${fields}` : ''}`;
}

// Buffer only complete log lines; preserve framework output and oversized lines.
export function createTerminalLog(
  output,
  { color = true, maxLine = 65536, structuredService } = {},
) {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  let passthrough = false;
  function consume(text) {
    pending += text;
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, end);
      pending = pending.slice(end + 1);
      const formatted = passthrough
        ? structuredService === undefined
          ? line
          : undefined
        : formatLine(line, color, structuredService);
      if (formatted !== undefined) output.write(formatted + '\n');
      passthrough = false;
    }
    if (pending.length > maxLine) {
      if (structuredService === undefined) output.write(pending);
      pending = '';
      passthrough = true;
    }
  }
  return {
    write(chunk) {
      consume(decoder.write(chunk));
    },
    end() {
      consume(decoder.end());
      if (pending && structuredService === undefined) output.write(pending);
    },
  };
}
