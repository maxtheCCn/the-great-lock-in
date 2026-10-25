import Anthropic from '@anthropic-ai/sdk';
import { CoachError, type ProviderAdapter } from './types';

/**
 * Bring-your-own-key: the request goes straight from this browser to Anthropic.
 * `dangerouslyAllowBrowser` is required for that; the key is the user's own and is
 * stored only on their device (see ai/keyStore.ts).
 */
function client(apiKey: string) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

/** Models that accept `output_config.effort`. */
const SUPPORTS_EFFORT = /^claude-(fable-5|mythos-5|opus-5|sonnet-5|haiku-5|opus-4-[678]|sonnet-4-6|opus-4-6)/;
/** Models that accept server-side `fallbacks: "default"`. */
const SUPPORTS_DEFAULT_FALLBACK = /^claude-(fable-5-1|opus-5|sonnet-5-5)/;

function mapError(e: unknown): CoachError {
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new CoachError('Anthropic rejected this API key. Check it and try again.', 'auth');
  if (e instanceof Anthropic.RateLimitError) return new CoachError('Anthropic rate limit or usage limit reached. Wait a moment, or check your plan and billing.', 'rate');
  if (e instanceof Anthropic.NotFoundError) return new CoachError('That model is not available for this API key. Pick another model in Coach settings.');
  if (e instanceof Anthropic.BadRequestError) return new CoachError(`Anthropic could not process the request: ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) return new CoachError('Could not reach Anthropic. Check your connection.', 'network');
  if (e instanceof Anthropic.APIError) return new CoachError(`Anthropic error ${e.status ?? ''}: ${e.message}`);
  if (e instanceof Error && e.name === 'AbortError') return new CoachError('Stopped.');
  return new CoachError(e instanceof Error ? e.message : 'Unknown error');
}

export const anthropicAdapter: ProviderAdapter = {
  async listModels(apiKey) {
    try {
      const out: { id: string; label: string }[] = [];
      for await (const m of client(apiKey).models.list({ limit: 100 })) out.push({ id: m.id, label: m.display_name || m.id });
      return out.filter((m) => m.id.startsWith('claude'));
    } catch (e) {
      throw mapError(e);
    }
  },

  async stream(apiKey, req) {
    try {
      const stream = client(apiKey).beta.messages.stream(
        {
          model: req.model,
          max_tokens: 16000,
          system: req.system,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          ...(SUPPORTS_EFFORT.test(req.model) ? { output_config: { effort: 'medium' as const } } : {}),
          ...(SUPPORTS_DEFAULT_FALLBACK.test(req.model) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
        },
        { signal: req.signal },
      );
      stream.on('text', (delta) => req.onText(delta));
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        throw new CoachError('The model declined this request. Try rephrasing it.', 'refusal');
      }
      return final.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    } catch (e) {
      if (e instanceof CoachError) throw e;
      throw mapError(e);
    }
  },
};
