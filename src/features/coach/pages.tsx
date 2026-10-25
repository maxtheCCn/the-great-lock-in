import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUp,
  Brain,
  Check,
  ChevronLeft,
  Dumbbell,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Trash,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page, useRoute } from '@/components/Page';
import { Badge, Button, Chip, EmptyState, Field, IconButton, Panel, SelectPicker, Stepper, Toggle } from '@/design/primitives';
import { confirmAction } from '@/design/Overlays';
import { PROVIDERS, providerMeta } from '@/ai/providers';
import { clearApiKey, getApiKey, maskKey, setApiKey } from '@/ai/keyStore';
import { loadAdapter, CoachError, type ModelOption } from '@/ai/adapters';
import { askCoach } from '@/ai/coach';
import { parseReply, visibleWhileStreaming } from '@/ai/parse';
import { Markdown } from '@/ai/Markdown';
import { WEEKLY_INSTRUCTION, WORKOUT_INSTRUCTION } from '@/ai/prompts';
import { db, uid } from '@/data/db';
import { saveMemory, saveSuggestion } from '@/data/repo';
import { getCoachSettings, updateCoachSettings, useCoachSettings } from '@/data/settings';
import { EXERCISES } from '@/data/training/exercises';
import type { ChatMessage, ChatThread, CoachMemory, MemoryCategory, ProviderId, SuggestedWorkout, WorkoutExercise } from '@/data/types';
import { addDays, diffDays, formatDate, formatRange, formatShort, isoFromMs, startOfWeek, todayISO } from '@/domain/dates';
import { lockInWeeks } from '@/domain/weekly';
import { useActive } from '@/state/lockin';
import { toast, useUI } from '@/state/ui';
import { goBack, useNav } from '@/nav/store';
import './coach.css';

/* ═══════════════════════ Settings ═══════════════════════ */

export function CoachSettingsPage() {
  const coach = useCoachSettings();
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [model, setModel] = useState('');
  const [storage, setStorage] = useState<'device' | 'session'>('device');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coach || provider !== null) return;
    setProvider(coach.provider ?? 'anthropic');
    setModel(coach.model);
    setStorage(coach.keyStorage);
    getApiKey(coach.keyStorage).then(setSavedKey);
  }, [coach, provider]);

  if (!coach || !provider) return null;
  const meta = providerMeta(provider)!;
  const connected = coach.provider === provider && !!savedKey;

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const k = key.trim() || savedKey;
      if (!k) throw new CoachError('Paste your API key first.');
      const adapter = await loadAdapter(provider);
      const list = await adapter.listModels(k);
      if (!list.length) throw new CoachError('No compatible chat models were found for this key.');
      setModels(list);
      const preferred = list.find((m) => m.id === (coach.provider === provider ? coach.model : meta.defaultModel)) ?? list[0];
      setModel(preferred.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
      setModels(null);
    }
    setBusy(false);
  };

  const save = async () => {
    const k = key.trim() || savedKey;
    if (!k || !model) return;
    await setApiKey(k, storage);
    await updateCoachSettings({ provider, model, keyStorage: storage });
    setSavedKey(k);
    setKey('');
    toast('TGLI Coach connected', { tone: 'success' });
  };

  const disconnect = async () => {
    if (!(await confirmAction({ title: 'Disconnect AI?', message: 'Your API key is removed from this device. Chats and memories stay until you delete them.', confirmLabel: 'Disconnect', tone: 'danger' }))) return;
    await clearApiKey();
    await updateCoachSettings({ provider: null, model: '' });
    setSavedKey(null);
    setModels(null);
    toast('AI disconnected');
  };

  return (
    <Page title="Coach & AI" backLabel="Back" subtitle="Everything else in TGLI works without this. Requests go directly from your device to the provider you choose.">
      <Block>
        <Field label="Provider">
          <div className="stack gap-2">
            {PROVIDERS.map((p) => (
              <motion.button
                key={p.id}
                type="button"
                className="option"
                aria-pressed={provider === p.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProvider(p.id);
                  setModels(null);
                  setError(null);
                  setModel(coach.provider === p.id ? coach.model : '');
                }}
              >
                <span className="option__icon">
                  <Sparkles />
                </span>
                <span className="stack grow">
                  <span className="option__title">{p.label}</span>
                  <span className="option__desc">{p.vendor}</span>
                </span>
                {coach.provider === p.id && <Badge>Active</Badge>}
              </motion.button>
            ))}
          </div>
        </Field>
      </Block>

      <Block>
        <Field label={`${meta.vendor} API key`} hint={savedKey && coach.provider === provider ? `Saved · ${maskKey(savedKey)}` : undefined}>
          <div className="row gap-2">
            <input
              className="input grow"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={savedKey && coach.provider === provider ? 'Enter a new key to replace' : meta.keyHint}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}
            />
            <IconButton label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}>
              {show ? <EyeOff /> : <Eye />}
            </IconButton>
          </div>
        </Field>
        <a href={meta.keyUrl} target="_blank" rel="noreferrer noopener" className="row gap-1 t-small" style={{ marginTop: 8, color: 'var(--mint)', fontWeight: 650, textDecoration: 'none' }}>
          Get a key from {meta.vendor} <ExternalLink size={13} />
        </a>
      </Block>

      <Block>
        <Field label="Remember key">
          <div className="stack gap-2">
            {(
              [
                ['device', 'On this device', 'Stored in this browser until you remove it.'],
                ['session', 'This session only', 'Forgotten when TGLI is closed.'],
              ] as const
            ).map(([v, t, d]) => (
              <motion.button key={v} type="button" className="option" aria-pressed={storage === v} whileTap={{ scale: 0.98 }} onClick={() => setStorage(v)} style={{ minHeight: 56 }}>
                <span className="stack grow">
                  <span className="option__title">{t}</span>
                  <span className="option__desc">{d}</span>
                </span>
                <span className="option__check">{storage === v && <Check strokeWidth={3} />}</span>
              </motion.button>
            ))}
          </div>
        </Field>
      </Block>

      <Block>
        <Button block variant="secondary" icon={<KeyRound />} loading={busy} onClick={verify}>
          Verify key & load models
        </Button>
        {error && (
          <p className="t-small" style={{ color: '#ff9d90', marginTop: 10 }}>
            {error}
          </p>
        )}
      </Block>

      {(models || (connected && model)) && (
        <Block>
          <Field label="Model">
            {models ? (
              <SelectPicker label="Model" value={model} onChange={setModel} options={models.map((m) => ({ value: m.id, label: m.label === m.id ? m.id : `${m.label} · ${m.id}` }))} />
            ) : (
              <div className="picker">
                <span className="picker__value t-mono" style={{ fontSize: 14 }}>
                  {model}
                </span>
              </div>
            )}
          </Field>
          {provider === 'anthropic' && models && <p className="t-small" style={{ fontSize: 12, marginTop: 6 }}>Recommended: Claude Opus 5.5 (claude-opus-5-5).</p>}
          <Button block size="lg" style={{ marginTop: 14 }} disabled={!model || (!key.trim() && !savedKey)} onClick={save}>
            {connected && !key.trim() ? 'Save settings' : 'Connect'}
          </Button>
        </Block>
      )}

      <Block>
        <Panel tight>
          <p className="t-small" style={{ fontSize: 12.5 }}>
            Using the API may cost money: {meta.vendor} bills your account directly based on usage. TGLI never sees your key on any server: there is none. The key is excluded from backups and never logged.
          </p>
        </Panel>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">What the coach can see</div>
        <div className="list">
          {(
            [
              ['checkins', 'Check-ins & sleep', 'Daily ratings, sleep, training status, food self-assessment'],
              ['workouts', 'Workouts', 'Exercises, sets and muscle volume'],
              ['measurements', 'Body measurements', 'Off by default'],
              ['journal', 'Journal', 'Off by default. Recent entries only'],
            ] as const
          ).map(([k, t, d]) => (
            <div key={k} className="list-row">
              <span className="stack grow">
                <span className="list-row__title">{t}</span>
                <span className="list-row__sub">{d}</span>
              </span>
              <Toggle label={t} checked={coach.share[k]} onChange={(v) => updateCoachSettings({ share: { ...coach.share, [k]: v } })} />
            </div>
          ))}
        </div>
        <p className="t-small" style={{ fontSize: 12, marginTop: 8 }}>
          Progress photos are never shared with the coach.
        </p>
      </Block>

      <Block>
        <div className="t-eyebrow section-label">History & memory</div>
        <div className="list">
          <div className="list-row">
            <span className="stack grow">
              <span className="list-row__title">Save chat history</span>
              <span className="list-row__sub">Stored on this device</span>
            </span>
            <Toggle label="Save chat history" checked={coach.saveHistory} onChange={(v) => updateCoachSettings({ saveHistory: v })} />
          </div>
          <div className="list-row">
            <span className="stack grow">
              <span className="list-row__title">Coach memory</span>
              <span className="list-row__sub">Lets the coach remember preferences and patterns</span>
            </span>
            <Toggle label="Coach memory" checked={coach.memoryEnabled} onChange={(v) => updateCoachSettings({ memoryEnabled: v })} />
          </div>
        </div>
      </Block>

      {coach.provider && (
        <Block>
          <Button variant="danger" block onClick={disconnect}>
            Disconnect & remove key
          </Button>
        </Block>
      )}
    </Page>
  );
}

/* ═══════════════════════ Workout suggestion card ═══════════════════════ */

function matchExercise(name: string): WorkoutExercise {
  const n = name.toLowerCase();
  const hit = EXERCISES.find((e) => n.includes(e.name.toLowerCase()) || e.name.toLowerCase().includes(n)) ?? EXERCISES.find((e) => n.split(/\s+/).some((w) => w.length > 3 && e.name.toLowerCase().includes(w)));
  return { id: uid(), exerciseId: hit?.id, name, primary: hit?.primary ?? [], secondary: hit?.secondary ?? [], sets: 3, reps: null, weight: null };
}

export function SuggestionCard({ id }: { id: string }) {
  const s = useLiveQuery(() => db.suggestions.get(id), [id]);
  const openSheet = useUI((st) => st.openSheet);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SuggestedWorkout | null>(null);
  useEffect(() => {
    if (s && !editing) setDraft(s);
  }, [s, editing]);
  if (!s || !draft) return null;

  const set = async (status: SuggestedWorkout['status']) => {
    await saveSuggestion({ ...s, status });
    toast(status === 'approved' ? 'Workout approved and saved in TGLI' : 'Suggestion rejected');
  };
  const saveEdit = async () => {
    await saveSuggestion({ ...draft });
    setEditing(false);
  };
  const log = () => {
    const exercises = s.exercises.map((e) => {
      const m = matchExercise(e.name);
      const reps = parseInt(e.reps, 10);
      return { ...m, sets: e.sets, reps: Number.isFinite(reps) ? reps : null };
    });
    openSheet({ type: 'workout', date: todayISO(), prefill: { title: s.title, exercises } });
  };

  return (
    <Panel glow={s.status === 'approved'} className="workout-suggest">
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="t-eyebrow">Suggested workout</span>
        <Badge tone={s.status === 'pending' ? 'accent' : s.status === 'approved' ? 'solid' : 'muted'}>{s.status === 'pending' ? 'Needs review' : s.status}</Badge>
      </div>
      {editing ? (
        <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      ) : (
        <div className="t-h3">{s.title}</div>
      )}
      {s.focus && !editing && <span className="t-small">{s.focus}</span>}
      {s.explanation && !editing && (
        <p className="t-small" style={{ marginTop: 8 }}>
          <span className="msg__tag msg__tag--suggestion">suggestion</span>
          {s.explanation}
        </p>
      )}
      <div className="stack gap-2" style={{ marginTop: 12 }}>
        {draft.exercises.map((e, i) => (
          <div key={i} className="ex-card" style={{ padding: '10px 12px' }}>
            {editing ? (
              <div className="stack gap-2">
                <div className="row gap-2">
                  <input className="input grow" value={e.name} onChange={(ev) => setDraft({ ...draft, exercises: draft.exercises.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} style={{ minHeight: 40, padding: '8px 12px' }} />
                  <IconButton label="Remove exercise" size="sm" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter((_, j) => j !== i) })}>
                    <X />
                  </IconButton>
                </div>
                <div className="row between">
                  <Stepper label="sets" value={e.sets} min={1} max={10} onChange={(n) => setDraft({ ...draft, exercises: draft.exercises.map((x, j) => (j === i ? { ...x, sets: n } : x)) })} />
                  <input className="input" style={{ width: 100, minHeight: 40, padding: '8px 10px', textAlign: 'center' }} value={e.reps} onChange={(ev) => setDraft({ ...draft, exercises: draft.exercises.map((x, j) => (j === i ? { ...x, reps: ev.target.value } : x)) })} aria-label="Reps" />
                </div>
              </div>
            ) : (
              <>
                <div className="row between">
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{e.name}</span>
                  <span className="t-mono" style={{ fontSize: 12 }}>
                    {e.sets} × {e.reps}
                  </span>
                </div>
                {(e.restSec || e.notes) && (
                  <span className="t-small" style={{ fontSize: 12 }}>
                    {e.restSec ? `Rest ${e.restSec}s` : ''}
                    {e.restSec && e.notes ? ' · ' : ''}
                    {e.notes}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
        {editing && (
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setDraft({ ...draft, exercises: [...draft.exercises, { name: 'New exercise', sets: 3, reps: '8-12', restSec: 90, notes: '' }] })}>
            Add exercise
          </Button>
        )}
      </div>
      <div className="row wrap gap-2" style={{ marginTop: 14 }}>
        {editing ? (
          <>
            <Button size="sm" onClick={saveEdit}>
              Save edits
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            {s.status !== 'approved' && (
              <Button size="sm" icon={<Check />} onClick={() => set('approved')}>
                Approve
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Pencil />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            {s.status === 'pending' && (
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => set('rejected')}>
                Reject
              </Button>
            )}
            {s.status === 'approved' && (
              <Button size="sm" variant="secondary" icon={<Dumbbell />} onClick={log}>
                Log as done
              </Button>
            )}
          </>
        )}
      </div>
      {s.status === 'approved' && (
        <p className="t-small" style={{ fontSize: 11.5, marginTop: 10 }}>
          Saved in TGLI. Sending approved workouts to NW Log will be possible once that integration exists.
        </p>
      )}
    </Panel>
  );
}

/* ═══════════════════════ Chat ═══════════════════════ */

const STARTERS = ['How has my training changed?', 'Which muscle groups have I trained most?', 'What should I focus on next week?', 'Can you suggest a workout?', 'How consistent has my sleep been?', 'What did I improve this month?'];

export function ChatPage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const coach = useCoachSettings();
  const { depth } = useRoute();
  const push = useNav((s) => s.push);
  const replace = useNav((s) => s.replace);
  const [threadId, setThreadId] = useState<string>(params.id ?? uid());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!params.id) return;
    db.chats.get(params.id).then((t) => t && setMessages(t.messages));
  }, [params.id]);

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, stream]);

  useEffect(() => () => abort.current?.abort(), []);

  const persist = async (msgs: ChatMessage[]) => {
    const c = await getCoachSettings();
    if (!c.saveHistory) return;
    const existing = await db.chats.get(threadId);
    const firstUser = msgs.find((m) => m.role === 'user')?.content ?? 'Conversation';
    const t: ChatThread = { id: threadId, title: existing?.title ?? firstUser.slice(0, 60), messages: msgs, createdAt: existing?.createdAt ?? Date.now(), updatedAt: Date.now() };
    await db.chats.put(t);
  };

  const send = async (text: string, base: ChatMessage[] = messages) => {
    const q = text.trim();
    if (!q || busy) return;
    const user: ChatMessage = { id: uid(), role: 'user', content: q, createdAt: Date.now() };
    const next = [...base, user];
    setMessages(next);
    setInput('');
    setBusy(true);
    setStream('');
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      let acc = '';
      const { text: raw } = await askCoach({
        lockIn,
        messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })),
        signal: ctrl.signal,
        onText: (d) => {
          acc += d;
          setStream(acc);
        },
      });
      const parsed = parseReply(raw || acc);
      const c = await getCoachSettings();
      const savedMemories: string[] = [];
      if (c.memoryEnabled) {
        for (const m of parsed.memories) {
          await saveMemory(m.text, m.category, 'coach');
          savedMemories.push(m.text);
        }
      }
      let suggestionId: string | undefined;
      if (parsed.workout) {
        const sw = await saveSuggestion({ ...parsed.workout, status: 'pending' });
        suggestionId = sw.id;
      }
      const reply: ChatMessage = { id: uid(), role: 'assistant', content: parsed.text || (parsed.workout ? 'Here is a workout suggestion for you to review.' : ''), createdAt: Date.now(), suggestionId, memories: savedMemories.length ? savedMemories : undefined };
      const done = [...next, reply];
      setMessages(done);
      await persist(done);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      const err: ChatMessage = { id: uid(), role: 'assistant', content: msg, createdAt: Date.now(), error: true };
      setMessages([...next, err]);
    } finally {
      setBusy(false);
      setStream('');
      abort.current = null;
    }
  };

  const retry = () => {
    const lastUserIdx = [...messages].map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx < 0) return;
    const q = messages[lastUserIdx].content;
    void send(q, messages.slice(0, lastUserIdx));
  };

  const newChat = () => {
    abort.current?.abort();
    if (params.id) replace('coachChat');
    else {
      setThreadId(uid());
      setMessages([]);
    }
  };

  if (coach && !coach.provider) {
    return (
      <Page title="Chat" backLabel="Coach">
        <Block>
          <Panel>
            <EmptyState icon={<KeyRound />} title="Connect an AI provider" text="Chat needs your own API key. Everything else works without it." action={<Button onClick={() => push('settingsCoach')}>Coach settings</Button>} />
          </Panel>
        </Block>
      </Page>
    );
  }

  return (
    <div className="page-frame">
      <div className="page__topbar">
        <div className="page__topbar-bg" />
        {depth > 0 && (
          <motion.button type="button" className="page__back" onClick={goBack} whileTap={{ scale: 0.94 }} style={{ position: 'relative' }}>
            <ChevronLeft />
            Coach
          </motion.button>
        )}
        <div className="page__topbar-title">TGLI Coach</div>
        <div className="page__topbar-actions" style={{ position: 'relative' }}>
          <IconButton label="New chat" size="sm" onClick={newChat}>
            <Plus />
          </IconButton>
        </div>
      </div>
      <div className="chat">
        <div className="chat__scroll" ref={scroll}>
          {messages.length === 0 && !busy && (
            <motion.div className="stack gap-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 'auto' }}>
              <div className="coach-hero__orb" style={{ width: 54, height: 54, margin: '0 0 6px' }} aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <div className="t-h2">Ask about your Lock In</div>
              <p className="t-small">Answers use your recorded data. Facts and suggestions are labelled.</p>
              <div className="suggest-chips">
                {STARTERS.map((s) => (
                  <Chip key={s} selected={false} onClick={() => send(s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
          {messages.map((m) => (
            <motion.div key={m.id} className="stack gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'stretch' }}>
              {(m.content || m.role === 'user') && (
                <div className={`msg msg--${m.role} ${m.error ? 'msg--error' : ''}`}>{m.role === 'assistant' && !m.error ? <Markdown text={m.content} /> : m.content}</div>
              )}
              {m.error && (
                <Button size="sm" variant="secondary" icon={<RefreshCw />} onClick={retry} style={{ alignSelf: 'flex-start' }}>
                  Try again
                </Button>
              )}
              {m.suggestionId && <SuggestionCard id={m.suggestionId} />}
              {m.memories?.map((t) => (
                <span key={t} className="memory-chip">
                  <Brain /> Remembered: {t}
                </span>
              ))}
            </motion.div>
          ))}
          {busy && (
            <div className="msg msg--assistant">
              {stream ? <Markdown text={visibleWhileStreaming(stream)} /> : <span className="typing"><i /><i /><i /></span>}
            </div>
          )}
        </div>
        <div className="chat__composer">
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              rows={1}
              value={input}
              placeholder="Message TGLI Coach"
              maxLength={2000}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            {busy ? (
              <IconButton label="Stop" variant="accent" onClick={() => abort.current?.abort()}>
                <Square />
              </IconButton>
            ) : (
              <IconButton label="Send" variant="accent" type="submit" disabled={!input.trim()}>
                <ArrowUp />
              </IconButton>
            )}
          </form>
          <p className="t-small" style={{ fontSize: 10.5, textAlign: 'center', marginTop: 6 }}>
            AI can be wrong. Not medical advice. {coach?.model}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ History ═══════════════════════ */

export function HistoryPage() {
  const chats = useLiveQuery(() => db.chats.orderBy('updatedAt').reverse().toArray(), []);
  const push = useNav((s) => s.push);
  const [q, setQ] = useState('');
  const list = (chats ?? []).filter((c) => !q.trim() || `${c.title} ${c.messages.map((m) => m.content).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()));
  const clearAll = async () => {
    if (!(await confirmAction({ title: 'Clear all chat history?', message: 'Every saved conversation on this device is deleted.', confirmLabel: 'Clear', tone: 'danger' }))) return;
    await db.chats.clear();
    toast('Chat history cleared');
  };
  return (
    <Page title="Chat history" backLabel="Coach" actions={chats?.length ? <IconButton label="Clear all" size="sm" onClick={clearAll}><Trash /></IconButton> : undefined}>
      {chats && chats.length === 0 ? (
        <Block>
          <Panel>
            <EmptyState icon={<MessageSquare />} title="No saved chats" text="Conversations appear here when chat history is on." />
          </Panel>
        </Block>
      ) : (
        <>
          <Block>
            <div className="search">
              <Search />
              <input className="input" placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </Block>
          <Block>
            <div className="list">
              {list.map((c) => (
                <div key={c.id} className="list-row">
                  <button className="row gap-3 grow" style={{ textAlign: 'left', minWidth: 0 }} onClick={() => push('coachChat', { id: c.id })}>
                    <span className="list-row__icon">
                      <MessageSquare />
                    </span>
                    <span className="stack grow" style={{ minWidth: 0 }}>
                      <span className="list-row__title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.title}
                      </span>
                      <span className="list-row__sub">
                        {formatDate(isoFromMs(c.updatedAt))} · {c.messages.length} messages
                      </span>
                    </span>
                  </button>
                  <IconButton
                    label="Delete conversation"
                    size="sm"
                    variant="plain"
                    onClick={async () => {
                      if (await confirmAction({ title: 'Delete this conversation?', confirmLabel: 'Delete', tone: 'danger' })) await db.chats.delete(c.id);
                    }}
                  >
                    <Trash />
                  </IconButton>
                </div>
              ))}
            </div>
          </Block>
        </>
      )}
    </Page>
  );
}

/* ═══════════════════════ Memory ═══════════════════════ */

const MEM_CATS: MemoryCategory[] = ['goal', 'preference', 'pattern', 'recommendation', 'workout', 'other'];

export function MemoryPage() {
  const coach = useCoachSettings();
  const memories = useLiveQuery(() => db.memories.orderBy('updatedAt').reverse().toArray(), []);
  const [editing, setEditing] = useState<CoachMemory | null>(null);
  const [text, setText] = useState('');
  const [cat, setCat] = useState<MemoryCategory>('preference');
  const [adding, setAdding] = useState(false);
  if (!coach) return null;
  const open = (m: CoachMemory | null) => {
    setEditing(m);
    setAdding(!m);
    setText(m?.text ?? '');
    setCat(m?.category ?? 'preference');
  };
  const save = async () => {
    if (!text.trim()) return;
    await saveMemory(text.trim(), cat, editing?.source ?? 'user', editing?.id);
    setEditing(null);
    setAdding(false);
  };
  return (
    <Page title="Coach memory" eyebrow={coach.memoryEnabled ? 'On' : 'Off'} backLabel="Coach" subtitle="Long-term notes the coach uses. Separate from chat history, and you control every entry.">
      <Block>
        <Panel tight>
          <div className="row gap-3">
            <span className="list-row__icon">
              <Brain />
            </span>
            <div className="stack grow">
              <span className="t-h3" style={{ fontSize: 15 }}>
                Coach memory
              </span>
              <span className="t-small">When off, nothing new is saved and memories aren't shared.</span>
            </div>
            <Toggle label="Coach memory" checked={coach.memoryEnabled} onChange={(v) => updateCoachSettings({ memoryEnabled: v })} />
          </div>
        </Panel>
      </Block>
      <AnimatePresence>
        {(editing || adding) && (
          <Block>
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Panel glow>
                <Field label={editing ? 'Edit memory' : 'New memory'}>
                  <textarea className="input" rows={2} maxLength={240} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                </Field>
                <div className="row wrap gap-2" style={{ marginTop: 10 }}>
                  {MEM_CATS.map((c) => (
                    <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
                <div className="grid-2" style={{ marginTop: 14 }}>
                  <Button variant="secondary" onClick={() => (setEditing(null), setAdding(false))}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={!text.trim()}>
                    Save
                  </Button>
                </div>
              </Panel>
            </motion.div>
          </Block>
        )}
      </AnimatePresence>
      <Block>
        <Button variant="secondary" block icon={<Plus />} onClick={() => open(null)}>
          Add a memory
        </Button>
      </Block>
      <Block>
        {memories && memories.length === 0 ? (
          <Panel>
            <EmptyState icon={<Brain />} title="Nothing remembered yet" text="The coach can save short notes like “prefers morning training”. You'll see each one here." />
          </Panel>
        ) : (
          <div className="list">
            {memories?.map((m) => (
              <div key={m.id} className="list-row">
                <span className="stack grow">
                  <span className="list-row__title" style={{ fontWeight: 600 }}>
                    {m.text}
                  </span>
                  <span className="list-row__sub">
                    {m.category} · {m.source === 'coach' ? 'saved by coach' : 'added by you'}
                  </span>
                </span>
                <IconButton label="Edit memory" size="sm" variant="plain" onClick={() => open(m)}>
                  <Pencil />
                </IconButton>
                <IconButton label="Delete memory" size="sm" variant="plain" onClick={() => db.memories.delete(m.id)}>
                  <Trash />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Block>
      {memories && memories.length > 0 && (
        <Block>
          <Button
            variant="ghost"
            block
            onClick={async () => {
              if (await confirmAction({ title: 'Delete all memories?', confirmLabel: 'Delete all', tone: 'danger' })) await db.memories.clear();
            }}
          >
            Delete all memories
          </Button>
        </Block>
      )}
    </Page>
  );
}

/* ═══════════════════════ Weekly coach ═══════════════════════ */

export function WeeklyCoachPage({ params }: { params: Record<string, string> }) {
  const lockIn = useActive();
  const today = todayISO();
  const weeks = lockInWeeks(lockIn, today);
  const [week, setWeek] = useState(params.week ?? (weeks[1] ?? weeks[0] ?? startOfWeek(today)));
  const reports = useLiveQuery(() => db.coachReports.where('weekStart').equals(week).reverse().sortBy('createdAt'), [week]);
  const [busy, setBusy] = useState(false);
  const [stream, setStream] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const weekNo = (w: string) => Math.floor(diffDays(startOfWeek(lockIn.startDate), w) / 7) + 1;

  const generate = async () => {
    setBusy(true);
    setError(null);
    setStream('');
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      let acc = '';
      const { text, model } = await askCoach({
        lockIn,
        extra: WEEKLY_INSTRUCTION,
        messages: [{ role: 'user', content: `Analyse week ${weekNo(week)} (${formatRange(week, addDays(week, 6))}), starting ${week}.` }],
        signal: ctrl.signal,
        onText: (d) => {
          acc += d;
          setStream(acc);
        },
      });
      const parsed = parseReply(text || acc);
      await db.coachReports.add({ id: uid(), weekStart: week, content: parsed.text, model, createdAt: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    }
    setBusy(false);
    setStream('');
  };

  return (
    <Page title="AI weekly coach" backLabel="Coach" subtitle="A coach-style read of your week. The standard weekly review in Progress never uses AI.">
      <Block>
        <SelectPicker label="Week" value={week} onChange={setWeek} options={weeks.map((w) => ({ value: w, label: `Week ${weekNo(w)} · ${formatShort(w)} - ${formatShort(addDays(w, 6))}` }))} />
      </Block>
      <Block>
        <Button block size="lg" icon={<Sparkles />} loading={busy} onClick={generate}>
          {reports?.length ? 'Generate a new analysis' : 'Analyse this week'}
        </Button>
        {error && (
          <p className="t-small" style={{ color: '#ff9d90', marginTop: 10 }}>
            {error}
          </p>
        )}
      </Block>
      {busy && stream && (
        <Block>
          <div className="msg msg--assistant" style={{ maxWidth: '100%' }}>
            <Markdown text={visibleWhileStreaming(stream)} />
          </div>
        </Block>
      )}
      {reports?.map((r) => (
        <Block key={r.id}>
          <Panel eyebrow={`${formatDate(isoFromMs(r.createdAt))} · ${r.model}`} action={<IconButton label="Delete analysis" size="sm" variant="plain" onClick={() => db.coachReports.delete(r.id)}><Trash /></IconButton>}>
            <div className="msg" style={{ padding: 0, maxWidth: '100%' }}>
              <Markdown text={r.content} />
            </div>
          </Panel>
        </Block>
      ))}
    </Page>
  );
}

/* ═══════════════════════ Workout suggestions ═══════════════════════ */

const FOCI = ['Full body', 'Upper body', 'Lower body', 'Push', 'Pull', 'Legs', 'Core', 'Recovery & mobility'];

export function WorkoutSuggestionsPage() {
  const lockIn = useActive();
  const suggestions = useLiveQuery(() => db.suggestions.orderBy('createdAt').reverse().toArray(), []);
  const [focus, setFocus] = useState('Full body');
  const [minutes, setMinutes] = useState(45);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const list = useMemo(() => (suggestions ?? []).filter((s) => s.status === filter), [suggestions, filter]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const { text } = await askCoach({
        lockIn,
        extra: WORKOUT_INSTRUCTION,
        messages: [{ role: 'user', content: `Suggest a ${focus.toLowerCase()} session of about ${minutes} minutes for me.` }],
        onText: () => undefined,
      });
      const parsed = parseReply(text);
      if (!parsed.workout) throw new CoachError('The coach did not return a workout in the expected format. Try again.');
      await saveSuggestion({ ...parsed.workout, status: 'pending' });
      setFilter('pending');
      toast('New workout suggestion ready to review', { tone: 'success' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a workout');
    }
    setBusy(false);
  };

  return (
    <Page title="Workout suggestions" backLabel="Coach" subtitle="Nothing is applied or sent automatically. Approve, edit or reject each suggestion.">
      <Block>
        <Panel>
          <Field label="Focus">
            <div className="row wrap gap-2">
              {FOCI.map((f) => (
                <Chip key={f} selected={focus === f} onClick={() => setFocus(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="row between" style={{ marginTop: 16 }}>
            <span className="t-small">Duration</span>
            <Stepper label="minutes" value={minutes} min={15} max={120} step={5} format={(v) => `${v}m`} onChange={setMinutes} />
          </div>
          <Button block style={{ marginTop: 16 }} icon={<Sparkles />} loading={busy} onClick={generate}>
            Suggest a workout
          </Button>
          {error && (
            <p className="t-small" style={{ color: '#ff9d90', marginTop: 10 }}>
              {error}
            </p>
          )}
        </Panel>
      </Block>
      <Block>
        <div className="row gap-2">
          {(['pending', 'approved', 'rejected'] as const).map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)} {suggestions ? `(${suggestions.filter((s) => s.status === f).length})` : ''}
            </Chip>
          ))}
        </div>
      </Block>
      {list.length === 0 ? (
        <Block>
          <p className="t-small" style={{ textAlign: 'center' }}>
            No {filter} suggestions.
          </p>
        </Block>
      ) : (
        list.map((s) => (
          <Block key={s.id}>
            <SuggestionCard id={s.id} />
            {s.status === 'rejected' && (
              <Button size="sm" variant="ghost" icon={<Trash />} style={{ marginTop: 6 }} onClick={() => db.suggestions.delete(s.id)}>
                Delete
              </Button>
            )}
          </Block>
        ))
      )}
    </Page>
  );
}

