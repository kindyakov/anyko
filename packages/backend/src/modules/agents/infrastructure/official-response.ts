const maximumResponseBytes = 2_000_000;

export async function readOfficialResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  const chunks: string[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return chunks.join('') + decoder.decode();
      bytes += value.byteLength;
      if (bytes > maximumResponseBytes) {
        void reader.cancel().catch(() => undefined);
        throw new Error('OFFICIAL_RESPONSE_TOO_LARGE');
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}
