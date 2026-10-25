import { Camera, Lock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet } from '@/design/Sheet';
import { Badge, Button, Chip, DatePicker, Field, IconButton } from '@/design/primitives';
import { addPhoto } from '@/data/repo';
import type { ISODate, LockIn, PhotoAngle } from '@/data/types';
import { formatDate, todayISO } from '@/domain/dates';
import { suggestedPhotoDate } from '@/services/images';
import { toast, useUI } from '@/state/ui';
import './sheets.css';

const ANGLES: PhotoAngle[] = ['front', 'side', 'back'];

export function PhotosSheet({ lockIn }: { lockIn: LockIn }) {
  const sheet = useUI((s) => s.sheet);
  const closeSheet = useUI((s) => s.closeSheet);
  const open = sheet?.type === 'photos';
  const [files, setFiles] = useState<Partial<Record<PhotoAngle, { file: File; url: string }>>>({});
  const [date, setDate] = useState<ISODate>(todayISO());
  const [suggested, setSuggested] = useState<ISODate | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate((sheet?.type === 'photos' && sheet.date) || todayISO());
    setSuggested(null);
    setNote('');
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Revoke preview URLs when the sheet closes.
  useEffect(() => {
    if (open) return;
    setFiles((cur) => {
      Object.values(cur).forEach((f) => f && URL.revokeObjectURL(f.url));
      return {};
    });
  }, [open]);

  const pick = async (angle: PhotoAngle, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', { tone: 'error' });
      return;
    }
    setFiles((f) => ({ ...f, [angle]: { file, url: URL.createObjectURL(file) } }));
    const d = await suggestedPhotoDate(file);
    if (d && d !== todayISO() && d <= todayISO()) setSuggested(d);
  };

  const count = Object.values(files).filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    try {
      for (const angle of ANGLES) {
        const f = files[angle];
        if (f) await addPhoto(lockIn.id, f.file, angle, date, note.trim());
      }
      closeSheet();
      toast(`${count} photo${count === 1 ? '' : 's'} saved privately`, { tone: 'success' });
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Could not save the photos.', { tone: 'error' });
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      locked={saving}
      eyebrow="Progress photos · optional"
      title="Add photos"
      footer={
        <Button block size="lg" disabled={!count} loading={saving} onClick={save}>
          {count ? `Save ${count} photo${count === 1 ? '' : 's'}` : 'Choose at least one photo'}
        </Button>
      }
    >
      <div className="stack gap-5">
        <div className="photo-slots">
          {ANGLES.map((a) => {
            const f = files[a];
            return (
              <div className="photo-slot" key={a}>
                {f ? (
                  <>
                    <img src={f.url} alt={`${a} preview`} />
                    <span className="photo-slot__label">{a}</span>
                    <IconButton className="photo-slot__remove" label={`Remove ${a} photo`} size="sm" onClick={() => {
                        URL.revokeObjectURL(f.url);
                        setFiles((x) => ({ ...x, [a]: undefined }) as typeof x);
                      }}>
                      <X />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <Camera />
                    <span style={{ textTransform: 'capitalize' }}>{a}</span>
                    <input type="file" accept="image/*" aria-label={`Choose ${a} photo`} onChange={(e) => pick(a, e.target.files?.[0])} />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <Field label="Photo date">
          <DatePicker label="Photo date" value={date} onChange={setDate} max={todayISO()} />
        </Field>
        {suggested && suggested !== date && (
          <div className="row between gap-3" style={{ marginTop: -8 }}>
            <span className="t-small">This photo was taken {formatDate(suggested)}.</span>
            <Chip selected={false} onClick={() => setDate(suggested)}>
              Use that date
            </Chip>
          </div>
        )}
        <Field label="Note" hint="Optional">
          <input className="input" value={note} maxLength={140} placeholder="Lighting, time of day, how you feel…" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row gap-2">
          <Badge icon={<Lock />}>Stays on this device</Badge>
          <Badge tone="muted">Never analysed or rated</Badge>
        </div>
        <p className="t-small" style={{ fontSize: 12 }}>
          Weekly photos are optional. Skip any week you like. Photos are resized on your device and stored only in this browser's private storage.
        </p>
      </div>
    </Sheet>
  );
}
