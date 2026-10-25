import type { MemoryCategory, SuggestedExercise } from '@/data/types';

export interface ParsedReply {
  text: string;
  memories: { category: MemoryCategory; text: string }[];
  workout: { title: string; focus: string; explanation: string; exercises: SuggestedExercise[] } | null;
}

const CATS: MemoryCategory[] = ['goal', 'preference', 'pattern', 'recommendation', 'workout', 'other'];

/** Extracts memory tags and a ```workout JSON block from a coach reply. */
export function parseReply(raw: string): ParsedReply {
  const memories: ParsedReply['memories'] = [];
  let text = raw.replace(/<memory(?:\s+category="([^"]*)")?\s*>([\s\S]*?)<\/memory>/g, (_, cat: string | undefined, body: string) => {
    const c = (CATS.includes(cat as MemoryCategory) ? cat : 'other') as MemoryCategory;
    const t = body.trim();
    if (t) memories.push({ category: c, text: t.slice(0, 240) });
    return '';
  });

  let workout: ParsedReply['workout'] = null;
  text = text.replace(/```workout\s*([\s\S]*?)```/, (_, json: string) => {
    try {
      const w = JSON.parse(json);
      if (w && Array.isArray(w.exercises)) {
        workout = {
          title: String(w.title ?? 'Suggested workout').slice(0, 60),
          focus: String(w.focus ?? '').slice(0, 60),
          explanation: String(w.explanation ?? '').slice(0, 600),
          exercises: w.exercises.slice(0, 12).map((e: Record<string, unknown>) => ({
            name: String(e.name ?? 'Exercise').slice(0, 60),
            sets: Math.max(1, Math.min(10, Number(e.sets) || 3)),
            reps: String(e.reps ?? '8-12').slice(0, 20),
            restSec: e.restSec ? Math.max(0, Math.min(600, Number(e.restSec) || 0)) : null,
            notes: String(e.notes ?? '').slice(0, 160),
          })),
        };
        return '';
      }
    } catch {
      /* leave the block visible if it isn't valid JSON */
    }
    return _;
  });

  return { text: text.trim(), memories, workout };
}

/** Removes partially streamed memory tags / workout blocks so they don't flash in the UI. */
export function visibleWhileStreaming(raw: string): string {
  return raw
    .replace(/<memory[\s\S]*?(<\/memory>|$)/g, '')
    .replace(/```workout[\s\S]*?(```|$)/g, '\n_Preparing a workout suggestion…_')
    .trim();
}
