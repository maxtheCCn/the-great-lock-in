import { motion } from 'motion/react';
import { CircleCheck, Compass, Download, Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Block, Page } from '@/components/Page';
import { Badge, Button, Panel } from '@/design/primitives';
import { canPromptInstall, isIOS, isSafari, isStandalone, onInstallAvailability, promptInstall } from '@/services/platform';
import { toast } from '@/state/ui';

const STEPS = [
  { icon: Compass, title: 'Open TGLI in Safari', text: 'Use Safari on your iPhone for the most reliable install. (Recent iOS versions also allow it from other browsers’ share menus.)' },
  { icon: Share, title: 'Tap Share', text: 'The square with an arrow pointing up, in the toolbar at the bottom (or top on iPad).' },
  { icon: SquarePlus, title: 'Add to Home Screen', text: 'Scroll the share sheet and choose “Add to Home Screen”. Keep “Open as Web App” on if you see it.' },
  { icon: CircleCheck, title: 'Tap Add, then launch', text: 'TGLI appears on your Home Screen. Open it from there for the full-screen, offline experience.' },
];

function PhoneHint({ step }: { step: number }) {
  return (
    <div style={{ position: 'relative', height: 120, borderRadius: 18, background: 'linear-gradient(180deg,#0f1813,#070a09)', boxShadow: 'inset 0 0 0 1px rgba(160,245,184,0.12)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 14, right: 14, top: 14, height: 30, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        tgli · your-domain
      </div>
      {step === 2 ? (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ position: 'absolute', left: 14, right: 14, bottom: 10, height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontSize: 13, fontWeight: 650 }}
        >
          <SquarePlus size={18} color="var(--mint)" /> Add to Home Screen
          <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, background: 'var(--mint)' }} />
        </motion.div>
      ) : (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {['‹', '›', 'share', '▢', '⧉'].map((k) => (
            <span key={k} style={{ position: 'relative', color: k === 'share' && step >= 1 ? 'var(--mint)' : 'var(--text-4)', fontSize: 16 }}>
              {k === 'share' ? <Share size={18} /> : k}
              {k === 'share' && step === 1 && (
                <motion.span
                  style={{ position: 'absolute', inset: -10, borderRadius: 14, border: '1.5px solid var(--mint)' }}
                  animate={{ scale: [0.8, 1.15, 0.8], opacity: [0.9, 0.3, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function InstallGuide() {
  const [active, setActive] = useState(0);
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  useEffect(() => onInstallAvailability(() => setCanPrompt(canPromptInstall())), []);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % STEPS.length), 2600);
    return () => clearInterval(id);
  }, []);

  if (isStandalone()) {
    return (
      <Page title="Installed" backLabel="Profile">
        <Block>
          <Panel glow>
            <div className="row gap-3">
              <CircleCheck color="var(--mint)" />
              <span className="t-h3">You're running the installed app.</span>
            </div>
          </Panel>
        </Block>
      </Page>
    );
  }

  return (
    <Page title="Install on iPhone" subtitle="TGLI is a web app you install straight from Safari. No App Store needed." backLabel="Profile">
      {canPrompt && (
        <Block>
          <Panel glow>
            <div className="row gap-3">
              <div className="stack grow">
                <span className="t-h3" style={{ fontSize: 15 }}>
                  This browser can install TGLI directly
                </span>
                <span className="t-small">One tap, no share sheet.</span>
              </div>
              <Button
                icon={<Download />}
                onClick={async () => {
                  const ok = await promptInstall();
                  if (ok) toast('Installing TGLI…', { tone: 'success' });
                }}
              >
                Install
              </Button>
            </div>
          </Panel>
        </Block>
      )}
      {isIOS() && !isSafari() && (
        <Block>
          <Badge tone="warn">Open this page in Safari to install</Badge>
        </Block>
      )}
      <Block>
        <PhoneHint step={Math.min(active, 2)} />
      </Block>
      {STEPS.map((s, i) => (
        <Block key={s.title}>
          <motion.div animate={{ opacity: active === i ? 1 : 0.55, scale: active === i ? 1 : 0.985 }} transition={{ duration: 0.4 }} onClick={() => setActive(i)}>
            <Panel tight glow={active === i}>
              <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                <span className="option__icon" style={active === i ? { background: 'var(--mint)', color: 'var(--text-on-accent)' } : undefined}>
                  <s.icon />
                </span>
                <div className="stack grow">
                  <span className="t-eyebrow">Step {i + 1}</span>
                  <span className="t-h3" style={{ fontSize: 15, marginTop: 2 }}>
                    {s.title}
                  </span>
                  <span className="t-small" style={{ marginTop: 4 }}>
                    {s.text}
                  </span>
                </div>
              </div>
            </Panel>
          </motion.div>
        </Block>
      ))}
      <Block>
        <p className="t-small" style={{ fontSize: 12 }}>
          Installed web apps keep their own storage on iPhone. Data in Safari and in the Home Screen app are separate. Start fresh in the installed app, or export a backup here and restore it there.
        </p>
      </Block>
    </Page>
  );
}
