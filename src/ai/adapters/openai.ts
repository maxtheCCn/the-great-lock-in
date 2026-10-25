import { CoachError, httpError, sseData, type ProviderAdapter } from './types';

const BASE = 'https://api.openai.com/v1';

/** Chat-capable model families; embeddings, audio, image and moderation models are hidden. */
const CHAT = /^(gpt-|o\d|chatgpt-)/;
const NOT_CHAT = /(embedding|whisper|tts|dall-e|image|audio|realtime|transcribe|moderation|search)/;

async function check(res: Response) {
  if (res.ok) return;
  let detail: string | undefined;
  try {
    detail = (await res.json())?.error?.message;
  } catch {
    /* ignore */
  }
  throw httpError(res.status, detail);
}

export const openaiAdapter: ProviderAdapter = {
  async listModels(apiKey) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
    } catch {
      throw new CoachError('Could not reach OpenAI. Check your connection.', 'network');
    }
    await check(res);
    const json = (await res.json()) as { data: { id: string; created: number }[] };
    return json.data
      .filter((m) => CHAT.test(m.id) && !NOT_CHAT.test(m.id))
      .sort((a, b) => b.created - a.created)
      .map((m) => ({ id: m.id, label: m.id }));
  },

  async stream(apiKey, req) {
    let res: Response;
    try {
      res = await fetch(`${BASE}/chat/completions`, {
        method: 'POST',
        signal: req.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: req.model,
          stream: true,
          messages: [{ role: 'system', content: req.system }, ...req.messages],
        }),
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new CoachError('Stopped.');
      throw new CoachError('Could not reach OpenAI. Check your connection.', 'network');
    }
    await check(res);
    let text = '';
    for await (const data of sseData(res)) {
      if (data === '[DONE]') break;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          text += delta;
          req.onText(delta);
        }
      } catch {
        /* keep-alive or partial line */
      }
    }
    return text;
  },
};
