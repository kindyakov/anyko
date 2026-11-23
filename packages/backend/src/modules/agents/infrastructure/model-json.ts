import { LlmError } from '@anyko/llm';

interface JsonStep {
  finishReason?: string | undefined;
  text?: string | undefined;
}

interface ModelResult {
  steps: readonly JsonStep[];
  error: Error | undefined;
  usage: {
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function completedModelJson(step: JsonStep | undefined): unknown {
  if (step?.finishReason !== 'stop' || !step.text) return undefined;
  const direct = parseJson(step.text);
  if (direct !== undefined) return direct;

  const fences = [...step.text.matchAll(/^[ \t]*```[^\r\n]*/gmu)];
  const [open, close] = fences;
  if (
    fences.length !== 2 ||
    !open ||
    !close ||
    !/^[ \t]*```(?:json)?[ \t]*$/iu.test(open[0]) ||
    !/^[ \t]*```[ \t]*$/u.test(close[0])
  )
    return undefined;
  return parseJson(step.text.slice(open.index + open[0].length, close.index));
}

export async function generateModelJson<Result extends ModelResult>(
  generate: () => Promise<Result>,
  options: {
    canRetry?: (result: Result) => boolean;
    onMissingJson?: (finishReason: string | undefined) => Promise<void>;
  } = {},
) {
  const read = async (result: Result) => {
    if (result.error) throw result.error;
    const step = result.steps.at(-1);
    const value = completedModelJson(step);
    if (value === undefined) await options.onMissingJson?.(step?.finishReason);
    if (step?.finishReason === 'length')
      throw new LlmError('LLM_COMPLETION_LIMIT');
    return { value, finishReason: step?.finishReason };
  };
  const first = await generate();
  const initial = await read(first);
  const retry =
    initial.value === undefined &&
    initial.finishReason === 'stop' &&
    (options.canRetry?.(first) ?? true)
      ? await generate()
      : undefined;
  const sumTokens = (key: keyof ModelResult['usage']) => {
    const count = first.usage[key];
    if (!retry) return count ?? null;
    const extra = retry.usage[key];
    return count == null || extra == null ? null : count + extra;
  };
  return {
    value: retry ? (await read(retry)).value : initial.value,
    usage: {
      inputTokens: sumTokens('inputTokens'),
      outputTokens: sumTokens('outputTokens'),
    },
  };
}
