import { CoachError, httpError, sseData, type ProviderAdapter } from './types';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

async function check(res: Response) {
  if (res.ok) return;
  let detail: string | undefined;
  try {
    detail = (await res.json())?.error?.message;
  } catch {
    /* ignore */
  }
  // Gemini reports an invalid key as 400 INVALID_ARGUMENT.
  if (res.status === 400 && detail && /api key/i.test(detail)) throw new CoachError('Google rejected this API key. Check it and try again.', 'auth');
  throw httpError(res.status, detail);
}

export const geminiAdapter: ProviderAdapter = {
  async listModels(apiKey) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey } });
    } catch {
      throw new CoachError('Could not reach Google AI. Check your connection.', 'network');
    }
    await check(res);
    const json = (await res.json()) as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
    return (json.models ?? [])
      .filter((m) => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent') && !/embedding|image|tts|audio/.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
  },

  async stream(apiKey, req) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal: req.signal,
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        }),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new CoachError('Stopped.');
      throw new CoachError('Could not reach Google AI. Check your connection.', 'network');
    }
    await check(res);
    let text = '';
    for await (const data of sseData(res)) {
      try {
        const json = JSON.parse(data);
        if (json?.promptFeedback?.blockReason) throw new CoachError('The model declined this request. Try rephrasing it.', 'refusal');
        const parts: { text?: string }[] = json?.candidates?.[0]?.content?.parts ?? [];
        const delta = parts.map((p) => p.text ?? '').join('');
        if (delta) {
          text += delta;
          req.onText(delta);
        }
      } catch (e) {
        if (e instanceof CoachError) throw e;
      }
    }
    return text;
  },
};
