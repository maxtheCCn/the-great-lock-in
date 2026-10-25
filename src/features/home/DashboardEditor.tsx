import { Reorder, useDragControls } from 'motion/react';
import { GripVertical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Button, Chip, Field, Toggle } from '@/design/primitives';
import { ALL_STATS, DEFAULT_SETTINGS, updateSettings, useSettings } from '@/data/settings';
import type { StatId, WidgetId } from '@/data/types';
import { WIDGET_META } from './widgets';

const STAT_LABELS: Record<StatId, string> = {
  checkins: 'Check-ins',
  workouts: 'Workouts',
  sleep: 'Average sleep',
  restDays: 'Rest days',
  milestones: 'Milestones',
  habits: 'Habit rate',
};

function Row({ id, hidden, onToggle }: { id: WidgetId; hidden: boolean; onToggle: () => void }) {
  const controls = useDragControls();
  const meta = WIDGET_META[id];
  const Icon = meta.icon;
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className="edit-row" whileDrag={{ scale: 1.03, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.8)', zIndex: 2 }}>
      <span className="edit-row__grip" onPointerDown={(e) => controls.start(e)} aria-label={`Reorder ${meta.label}`}>
        <GripVertical />
      </span>
      <span className="list-row__icon">
        <Icon />
      </span>
      <span className="grow" style={{ fontWeight: 650, opacity: hidden ? 0.45 : 1 }}>
        {meta.label}
      </span>
      <Toggle label={`Show ${meta.label}`} checked={!hidden} onChange={onToggle} />
    </Reorder.Item>
  );
}

export function DashboardEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const [order, setOrder] = useState<WidgetId[]>([]);
  const [hidden, setHidden] = useState<WidgetId[]>([]);
  const [stats, setStats] = useState<StatId[]>([]);

  useEffect(() => {
    if (open && settings) {
      setOrder(settings.dashboard.order);
      setHidden(settings.dashboard.hidden);
      setStats(settings.dashboard.stats);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    await updateSettings({ dashboard: { order, hidden, stats } });
    onClose();
  };
  const toggleStat = (s: StatId) => setStats((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : cur.length >= 4 ? cur : [...cur, s]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Home"
      title="Customize dashboard"
      full
      footer={
        <div className="grid-2">
          <Button
            variant="secondary"
            onClick={() => {
              setOrder(DEFAULT_SETTINGS.dashboard.order);
              setHidden(DEFAULT_SETTINGS.dashboard.hidden);
              setStats(DEFAULT_SETTINGS.dashboard.stats);
            }}
          >
            Reset
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="stack gap-6">
        <Field label="Widgets" hint="Drag to reorder">
          <Reorder.Group axis="y" values={order} onReorder={setOrder} className="edit-list">
            {order.map((id) => (
              <Row key={id} id={id} hidden={hidden.includes(id)} onToggle={() => setHidden((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))} />
            ))}
          </Reorder.Group>
        </Field>
        <Field label="Statistics" hint={`${stats.length}/4 selected`}>
          <div className="row wrap gap-2">
            {ALL_STATS.map((s) => (
              <Chip key={s} selected={stats.includes(s)} onClick={() => toggleStat(s)}>
                {STAT_LABELS[s]}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
