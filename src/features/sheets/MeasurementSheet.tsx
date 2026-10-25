import { Plus, Ruler, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Button, DatePicker, Field, SelectPicker } from '@/design/primitives';
import { confirmAction } from '@/design/Overlays';
import { db } from '@/data/db';
import { deleteMeasurement, saveMeasurement } from '@/data/repo';
import { updateSettings, useSettings } from '@/data/settings';
import type { LockIn } from '@/data/types';
import { todayISO } from '@/domain/dates';
import { fromDisplayLength, lengthUnit, measurementTypes, toDisplayLength } from '@/domain/measurements';
import { toast, useUI } from '@/state/ui';
import './sheets.css';

const NEW_TYPE = '__new__';

export function MeasurementSheet({ lockIn }: { lockIn: LockIn }) {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  const settings = useSettings();
  const open = sheet?.type === 'measurement';
  const editId = sheet?.type === 'measurement' ? sheet.id : undefined;
  const units = settings?.units ?? 'metric';
  const types = measurementTypes(settings?.customMeasurements);

  const [kind, setKind] = useState('waist');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [newType, setNewType] = useState('');
  const [exists, setExists] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setNewType('');
    (async () => {
      const m = editId ? await db.measurements.get(editId) : undefined;
      setExists(!!m);
      setKind(m?.kind ?? (sheet?.type === 'measurement' ? sheet.kind : undefined) ?? 'waist');
      setValue(m ? String(Math.round(toDisplayLength(m.valueCm, units) * 10) / 10) : '');
      setDate(m?.date ?? todayISO());
      setNote(m?.note ?? '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  const num = parseFloat(value.replace(',', '.'));
  const valid = Number.isFinite(num) && num > 0 && num < (units === 'imperial' ? 120 : 300) && kind !== NEW_TYPE;

  const createType = async () => {
    const label = newType.trim();
    if (!label || !settings) return;
    const id = `custom-${Date.now().toString(36)}`;
    await updateSettings({ customMeasurements: [...settings.customMeasurements, { id, label }] });
    setKind(id);
    setNewType('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveMeasurement({ id: editId, lockInId: lockIn.id, date, kind, valueCm: Math.round(fromDisplayLength(num, units) * 100) / 100, note: note.trim() });
      closeSheet();
      toast(exists ? 'Measurement updated' : 'Measurement saved', { tone: 'success' });
    } catch {
      toast('Could not save the measurement.', { tone: 'error' });
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId || !(await confirmAction({ title: 'Delete this measurement?', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await deleteMeasurement(editId);
    closeSheet();
    toast('Measurement deleted');
  };

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      locked={saving}
      eyebrow="Body · optional"
      title={exists ? 'Edit measurement' : 'Add measurement'}
      footer={
        <div className="row gap-2">
          {exists && <Button variant="danger" icon={<Trash />} aria-label="Delete measurement" onClick={remove} style={{ width: 56, padding: 0 }} />}
          <Button block size="lg" disabled={!valid} loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="stack gap-5">
        <Field label="Measurement">
          <SelectPicker icon={<Ruler />} label="Measurement type" value={kind} onChange={setKind} options={[...types.map((t) => ({ value: t.id, label: t.label })), { value: NEW_TYPE, label: '+ New custom measurement…' }]} />
        </Field>
        {kind === NEW_TYPE && (
          <Field label="Custom measurement name">
            <div className="row gap-2">
              <input className="input grow" autoFocus value={newType} maxLength={30} placeholder="e.g. Calf, Neck, Forearm" onChange={(e) => setNewType(e.target.value)} />
              <Button variant="secondary" icon={<Plus />} onClick={createType} disabled={!newType.trim()} aria-label="Create type" style={{ height: 52 }} />
            </div>
          </Field>
        )}
        <Field label="Circumference">
          <div className="unit-input">
            <input className="input input--big" inputMode="decimal" autoFocus={!exists} placeholder="0.0" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} />
            <span>{lengthUnit(units)}</span>
          </div>
        </Field>
        <Field label="Date">
          <DatePicker label="Measurement date" value={date} onChange={setDate} max={todayISO()} />
        </Field>
        <Field label="Note" hint="Optional">
          <input className="input" value={note} maxLength={120} placeholder="e.g. measured in the morning" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="t-small" style={{ fontSize: 12 }}>
          Measurements are optional and never required for check-ins. Measure the same way each time for comparable numbers.
        </p>
      </div>
    </Sheet>
  );
}
