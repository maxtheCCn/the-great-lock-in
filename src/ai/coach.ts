import { getCoachSettings, getSettings } from '@/data/settings';
import type { LockIn } from '@/data/types';
import { loadAdapter, CoachError, type ChatTurn } from './adapters';
import { getApiKey } from './keyStore';
import { buildCoachContext } from './context';
import { coachSystemPrompt } from './prompts';

/** Sends a conversation to the user's chosen provider with their Lock In data as context. */
export async function askCoach(opts: { lockIn: LockIn; messages: ChatTurn[]; extra?: string; onText: (delta: string) => void; signal?: AbortSignal }): Promise<{ text: string; model: string }> {
  const coach = await getCoachSettings();
  if (!coach.provider || !coach.model) throw new CoachError('Connect an AI provider in Coach settings first.', 'auth');
  const key = await getApiKey(coach.keyStorage);
  if (!key) throw new CoachError(coach.keyStorage === 'session' ? 'Your session key was cleared when the app closed. Enter it again in Coach settings.' : 'No API key saved. Add one in Coach settings.', 'auth');
  const [settings, context, adapter] = await Promise.all([getSettings(), buildCoachContext(opts.lockIn, coach), loadAdapter(coach.provider)]);
  const system = coachSystemPrompt({ ageGroup: settings.ageGroup, memory: coach.memoryEnabled, context, extra: opts.extra });
  const text = await adapter.stream(key, { model: coach.model, system, messages: opts.messages, signal: opts.signal, onText: opts.onText });
  return { text, model: coach.model };
}
