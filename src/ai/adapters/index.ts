import type { ProviderId } from '@/data/types';
import type { ProviderAdapter } from './types';

/** Lazily loads only the adapter for the chosen provider. */
export async function loadAdapter(id: ProviderId): Promise<ProviderAdapter> {
  switch (id) {
    case 'anthropic':
      return (await import('./anthropic')).anthropicAdapter;
    case 'openai':
      return (await import('./openai')).openaiAdapter;
    case 'gemini':
      return (await import('./gemini')).geminiAdapter;
  }
}

export * from './types';
