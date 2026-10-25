import { AnimatePresence } from 'motion/react';
import { Archive, Film } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Block, Page } from '@/components/Page';
import { Badge, Button, EmptyState, Panel } from '@/design/primitives';
import { Emblem } from '@/components/Emblem';
import { RATING_COLOR } from '@/components/ratings';
import { useArchivedLockIns, useJournal } from '@/data/hooks';
import { db } from '@/data/db';
import type { LockIn } from '@/data/types';
import { formatDate, formatRange } from '@/domain/dates';
import { MILESTONE_BY_KEY } from '@/domain/milestones';
import { useNav } from '@/nav/store';
import { ReviewsList } from '@/features/motivation/pages';
import { loadReplayData, type ReplayData } from './replayData';
import { Replay } from './Replay';

function useReplayData(id: string | undefined) {
  const [data, setData] = useState<ReplayData | null>(null);
  useEffect(() => {
    if (id) loadReplayData(id).then(setData);
  }, [id]);
  return data;
}

function ArchiveCard({ lockIn, onReplay }: { lockIn: LockIn; onReplay: () => void }) {
  const d = useReplayData(lockIn.id);
  const push = useNav((s) => s.push);
  return (
    <Panel onPress={() => push('archived', { id: lockIn.id })}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="t-eyebrow">{formatRange(lockIn.startDate, lockIn.targetDate)}</span>
        <Badge>Complete</Badge>
      </div>
      <div className="t-h2">{lockIn.name}</div>
      {d && (
        <>
          <div className="stat-row" style={{ marginTop: 14 }}>
            <div className="mini-stat">
              <div className="mini-stat__value">{d.checkIns}</div>
              <div className="mini-stat__label">Check-ins</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat__value">{d.sessions}</div>
              <div className="mini-stat__label">Workouts</div>
            </div>
            <div className="mini-stat">
              <div className="mini-stat__value">{d.milestones.length}</div>
              <div className="mini-stat__label">Milestones</div>
            </div>
          </div>
          <div className="distribution" style={{ marginTop: 14, height: 6 }}>
            {d.mosaic.map((m, i) => (
              <span key={i} style={{ flex: 1, background: m && m !== 'logged' ? RATING_COLOR[m] : m ? 'rgba(160,245,184,.4)' : '#1d2721' }} />
            ))}
          </div>
        </>
      )}
      <div style={{ marginTop: 14 }} onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="secondary" icon={<Film />} onClick={onReplay}>
          Transformation Replay
        </Button>
      </div>
    </Panel>
  );
}

export function ArchivePage() {
  const archived = useArchivedLockIns();
  const [replay, setReplay] = useState<string | null>(null);
  return (
    <Page title="Archive" backLabel="Profile" subtitle="Everything from past Lock Ins is preserved: check-ins, photos, measurements, reviews and journal.">
      {archived && archived.length === 0 && (
        <Block>
          <Panel>
            <EmptyState icon={<Archive />} title="Nothing archived yet" text="When you complete a Lock In it lands here, with its full history and a Transformation Replay." />
          </Panel>
        </Block>
      )}
      {archived?.map((l) => (
        <Block key={l.id}>
          <ArchiveCard lockIn={l} onReplay={() => setReplay(l.id)} />
        </Block>
      ))}
      <AnimatePresence>{replay && <Replay lockInId={replay} onClose={() => setReplay(null)} />}</AnimatePresence>
    </Page>
  );
}

export function ArchivedPage({ params }: { params: Record<string, string> }) {
  const lockIn = useLiveQuery(() => db.lockIns.get(params.id), [params.id]);
  const d = useReplayData(params.id);
  const journal = useJournal(params.id);
  const [replay, setReplay] = useState(params.replay === '1');
  if (!lockIn) return null;
  return (
    <Page title={lockIn.name} eyebrow={lockIn.status === 'completed' ? 'Archived Lock In' : 'Active Lock In'} subtitle={formatRange(lockIn.startDate, lockIn.targetDate)} backLabel="Back">
      <Block>
        <Button size="lg" block icon={<Film />} onClick={() => setReplay(true)}>
          Watch Transformation Replay
        </Button>
      </Block>
      {d && (
        <>
          <Block>
            <div className="stat-row">
              <div className="mini-stat">
                <div className="mini-stat__value">{d.elapsedDays}</div>
                <div className="mini-stat__label">Days</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__value">{d.checkIns}</div>
                <div className="mini-stat__label">Check-ins</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__value">{d.sessions}</div>
                <div className="mini-stat__label">Workouts</div>
              </div>
            </div>
          </Block>
          <Block>
            <div className="stat-row">
              <div className="mini-stat">
                <div className="mini-stat__value">{d.sleepAvg === null ? '—' : `${d.sleepAvg.toFixed(1)}h`}</div>
                <div className="mini-stat__label">Avg sleep</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__value">{d.photoCount}</div>
                <div className="mini-stat__label">Photos</div>
              </div>
              <div className="mini-stat">
                <div className="mini-stat__value">{d.journalCount}</div>
                <div className="mini-stat__label">Journal</div>
              </div>
            </div>
          </Block>
          <Block>
            <Panel eyebrow="Every day">
              <div className="rp-mosaic" style={{ gridTemplateColumns: 'repeat(10, 1fr)', width: '100%', marginTop: 0, display: 'grid', gap: 4 }}>
                {d.mosaic.map((m, i) => (
                  <span key={i} style={{ aspectRatio: '1', borderRadius: 4, background: m && m !== 'logged' ? RATING_COLOR[m] : m ? 'rgba(160,245,184,.4)' : '#1d2721' }} />
                ))}
              </div>
            </Panel>
          </Block>
          {d.milestones.length > 0 && (
            <Block>
              <Panel eyebrow="Milestones">
                <div className="row wrap gap-3">
                  {d.milestones.map((m) => (
                    <div key={m.id} className="stack" style={{ alignItems: 'center', width: 70, gap: 6 }}>
                      <Emblem milestoneKey={m.key} size={46} />
                      <span style={{ fontSize: 10.5, fontWeight: 650, textAlign: 'center' }}>{MILESTONE_BY_KEY[m.key]?.title}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </Block>
          )}
        </>
      )}
      <Block>
        <div className="t-eyebrow section-label">Weekly reviews</div>
        <ReviewsList lockIn={lockIn} />
      </Block>
      {journal.length > 0 && (
        <Block>
          <div className="t-eyebrow section-label">Journal</div>
          <div className="stack gap-2">
            {journal.map((j) => (
              <Panel key={j.id} tight>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{formatDate(j.date)}</span>
                <p className="t-small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {j.body || j.training}
                </p>
              </Panel>
            ))}
          </div>
        </Block>
      )}
      <AnimatePresence>{replay && <Replay lockInId={lockIn.id} onClose={() => setReplay(false)} />}</AnimatePresence>
    </Page>
  );
}
