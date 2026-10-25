export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelOption {
  id: string;
  label: string;
}

export interface StreamRequest {
  model: string;
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
  onText: (delta: string) => void;
}

export interface ProviderAdapter {
  /** Also serves as key verification: rejects with a readable error on a bad key. */
  listModels(apiKey: string): Promise<ModelOption[]>;
  /** Streams a reply and resolves with the full text. */
  stream(apiKey: string, req: StreamRequest): Promise<string>;
}

export class CoachError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'rate' | 'network' | 'refusal' | 'other' = 'other',
  ) {
    super(message);
  }
}

export function httpError(status: number, detail?: string): CoachError {
  if (status === 401 || status === 403) return new CoachError('The provider rejected this API key. Check it and try again.', 'auth');
  if (status === 429) return new CoachError('Rate limit or quota reached at the provider. Wait a moment, or check your plan and billing.', 'rate');
  if (status >= 500) return new CoachError('The provider is having trouble right now. Try again shortly.', 'network');
  return new CoachError(detail ? `Request failed: ${detail}` : `Request failed (${status}).`);
}

/** Reads a fetch Response body as server-sent events, yielding each `data:` payload. */
export async function* sseData(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  const rest = buf.trim();
  if (rest.startsWith('data:')) yield rest.slice(5).trim();
}
