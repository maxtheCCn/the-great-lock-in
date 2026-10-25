import type { ProviderId } from '@/data/types';

/**
 * Provider metadata only — kept tiny so the core bundle never loads AI code.
 * Adapters live in `ai/adapters/*` and are imported lazily by the Coach.
 */
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  vendor: string;
  keyHint: string;
  keyUrl: string;
  /** Suggested default; the live model list fetched with the user's key is authoritative. */
  defaultModel: string | null;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'anthropic',
    label: 'Claude',
    vendor: 'Anthropic',
    keyHint: 'sk-ant-…',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-opus-5-5',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    vendor: 'OpenAI',
    keyHint: 'sk-…',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: null,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    vendor: 'Google',
    keyHint: 'AIza…',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: null,
  },
];

export const providerMeta = (id: ProviderId | null) => PROVIDERS.find((p) => p.id === id);
