import { motion } from 'motion/react';
import { Brain, ChartColumn, ChevronRight, Dumbbell, KeyRound, MessagesSquare, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Panel } from '@/design/primitives';
import { useCoachSettings } from '@/data/settings';
import { db } from '@/data/db';
import { useNav } from '@/nav/store';
import { PROVIDERS } from '@/ai/providers';
import './coach.css';

const FEATURES = [
  { icon: MessagesSquare, title: 'AI Chat', text: 'Ask about your training, sleep and consistency, answered from your own records.' },
  { icon: ChartColumn, title: 'Weekly Training Analysis', text: 'A coach-style read of your week, compared with previous weeks.' },
  { icon: WandSparkles, title: 'Workout Recommendations', text: 'Suggested sessions you review, edit, approve or reject. Nothing is applied automatically.' },
  { icon: Sparkles, title: 'Personalized Coaching', text: 'Advice shaped by your goals, experience and preferences.' },
  { icon: Brain, title: 'Coach Memory', text: 'Optional long-term memory you can read, edit, delete or switch off.' },
];

export default function CoachHome() {
  const coach = useCoachSettings();
  const push = useNav((s) => s.push);
  const chats = useLiveQuery(() => db.chats.count(), []) ?? 0;
  const memories = useLiveQuery(() => db.memories.count(), []) ?? 0;
  const pending = useLiveQuery(() => db.suggestions.where('status').equals('pending').count(), []) ?? 0;
  if (!coach) return null;
  const connected = !!coach.provider;

  if (!connected) {
    return (
      <Page title="TGLI Coach">
        <Block>
          <div className="coach-hero">
            <div className="coach-hero__orb" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="coach-hero__title">A coach that knows your Lock In.</div>
            <p className="t-small" style={{ marginTop: 10, maxWidth: '34ch' }}>
              Everything else in TGLI works without AI. Connect your own provider only if you want conversational coaching on top.
            </p>
            <div className="feature-list">
              {FEATURES.map((f, i) => (
                <motion.div key={f.title} className="feature" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.07 }}>
                  <span className="feature__icon">
                    <f.icon />
                  </span>
                  <div className="stack">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{f.title}</span>
                    <span className="t-small" style={{ fontSize: 12.5 }}>
                      {f.text}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
            <Button block size="lg" icon={<KeyRound />} style={{ marginTop: 22 }} onClick={() => push('settingsCoach')}>
              CONNECT YOUR AI
            </Button>
          </div>
        </Block>
        <Block>
          <Panel tight>
            <div className="row gap-3">
              <span className="list-row__icon">
                <ShieldCheck />
              </span>
              <span className="t-small" style={{ fontSize: 12.5 }}>
                Supports {PROVIDERS.map((p) => p.label).join(', ')}. Your key stays on this device and requests go straight to the provider. Usage may be billed by them.
              </span>
            </div>
          </Panel>
        </Block>
      </Page>
    );
  }

  const provider = PROVIDERS.find((p) => p.id === coach.provider);
  const items = [
    { icon: MessagesSquare, title: 'New chat', sub: 'Ask anything about your Lock In', to: 'coachChat' as const, value: undefined },
    { icon: ChartColumn, title: 'AI weekly coach', sub: 'Analysis of your training week', to: 'coachWeekly' as const, value: undefined },
    { icon: Dumbbell, title: 'Workout suggestions', sub: 'Review, edit, approve or reject', to: 'coachWorkouts' as const, value: pending ? <Badge>{pending} new</Badge> : undefined },
    { icon: MessagesSquare, title: 'Chat history', sub: coach.saveHistory ? 'Saved on this device' : 'Saving is off', to: 'coachHistory' as const, value: chats || undefined },
    { icon: Brain, title: 'Coach memory', sub: coach.memoryEnabled ? 'On · you control every entry' : 'Off', to: 'coachMemory' as const, value: memories || undefined },
  ];

  return (
    <Page title="TGLI Coach" eyebrow={<span className="row gap-2"><span className="dot-live" /> Connected · {provider?.label}</span>} subtitle="Facts come from your data. Suggestions are clearly marked — you decide.">
      <Block>
        <div className="coach-hero" style={{ paddingBottom: 20 }}>
          <div className="row gap-4">
            <div className="coach-hero__orb" style={{ width: 56, height: 56, margin: 0 }} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <div className="stack grow">
              <span className="t-h3">How can I help today?</span>
              <span className="t-small">{coach.model}</span>
            </div>
          </div>
          <Button block size="lg" style={{ marginTop: 20 }} onClick={() => push('coachChat')}>
            Start a conversation
          </Button>
        </div>
      </Block>
      <Block>
        <div className="list">
          {items.map((it) => (
            <button key={it.title} className="list-row" onClick={() => push(it.to)}>
              <span className="list-row__icon">
                <it.icon />
              </span>
              <span className="stack grow">
                <span className="list-row__title">{it.title}</span>
                <span className="list-row__sub">{it.sub}</span>
              </span>
              {it.value && <span className="list-row__value">{it.value}</span>}
              <span className="list-row__chev">
                <ChevronRight />
              </span>
            </button>
          ))}
        </div>
      </Block>
      <Block>
        <Button variant="secondary" block icon={<KeyRound />} onClick={() => push('settingsCoach')}>
          Provider & privacy settings
        </Button>
      </Block>
    </Page>
  );
}
