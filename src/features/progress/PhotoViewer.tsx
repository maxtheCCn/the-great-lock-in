import { AnimatePresence, motion } from 'motion/react';
import { Columns2, Pencil, Trash, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, DatePicker, Field, IconButton, Segmented } from '@/design/primitives';
import { confirmAction } from '@/design/Overlays';
import { db } from '@/data/db';
import { deletePhoto, updatePhoto } from '@/data/repo';
import type { PhotoAngle, ProgressPhoto } from '@/data/types';
import { formatDate, todayISO } from '@/domain/dates';
import { imageUrl } from '@/services/images';
import { toast } from '@/state/ui';
import { go } from '@/nav/store';

/** Object URL for a photo's full-resolution image (falls back to the thumbnail while loading). */
export function useFullPhoto(photo: ProgressPhoto | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!photo) return;
    let alive = true;
    setUrl(imageUrl(`thumb:${photo.id}`, photo.thumb));
    db.photoBlobs.get(photo.id).then((b) => {
      if (alive && b) setUrl(imageUrl(`full:${photo.id}`, b.data, photo.mime));
    });
    return () => {
      alive = false;
    };
  }, [photo]);
  return url;
}

export function PhotoViewer({ photos, startId, onClose }: { photos: ProgressPhoto[]; startId: string; onClose: () => void }) {
  const [index, setIndex] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const [dir, setDir] = useState(0);
  const [editing, setEditing] = useState(false);
  const photo = photos[index];
  const url = useFullPhoto(photo);
  const [date, setDate] = useState(photo?.date ?? todayISO());
  const [angle, setAngle] = useState<PhotoAngle>(photo?.angle ?? 'front');
  const [note, setNote] = useState(photo?.note ?? '');

  useEffect(() => {
    if (!photo) return;
    setDate(photo.date);
    setAngle(photo.angle);
    setNote(photo.note);
    setEditing(false);
  }, [photo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!photos.length) onClose();
  }, [photos.length, onClose]);

  if (!photo) return null;

  function step(d: number) {
    const n = index + d;
    if (n < 0 || n >= photos.length) return;
    setDir(d);
    setIndex(n);
  }

  const save = async () => {
    await updatePhoto(photo.id, { date, angle, note: note.trim() });
    setEditing(false);
    toast('Photo updated', { tone: 'success' });
  };

  const remove = async () => {
    if (!(await confirmAction({ title: 'Delete this photo?', message: 'It is removed from this device permanently.', confirmLabel: 'Delete', tone: 'danger' }))) return;
    await deletePhoto(photo.id);
    toast('Photo deleted');
    if (photos.length <= 1) onClose();
    else setIndex((i) => Math.max(0, i - (i === photos.length - 1 ? 1 : 0)));
  };

  return createPortal(
    <motion.div className="viewer" role="dialog" aria-modal="true" aria-label="Photo viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="viewer__top">
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
        <div className="stack grow" style={{ textAlign: 'center' }}>
          <span style={{ fontWeight: 700 }}>{formatDate(photo.date)}</span>
          <span className="t-eyebrow">
            {photo.angle} · {index + 1}/{photos.length}
          </span>
        </div>
        <IconButton label="Edit photo details" onClick={() => setEditing((e) => !e)}>
          <Pencil />
        </IconButton>
      </div>
      <div className="viewer__stage">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.img
            key={photo.id}
            src={url}
            alt={`${photo.angle} progress photo from ${formatDate(photo.date)}`}
            className="viewer__img"
            custom={dir}
            initial={{ x: dir * 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, i) => {
              if (i.offset.x < -60) step(1);
              else if (i.offset.x > 60) step(-1);
            }}
            draggable={false}
          />
        </AnimatePresence>
      </div>
      <div className="viewer__bottom">
        <AnimatePresence mode="wait">
          {editing ? (
            <motion.div key="edit" className="stack gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} style={{ background: 'rgba(10,16,13,0.92)', padding: 16, borderRadius: 22 }}>
              <Field label="Original date">
                <DatePicker label="Photo date" value={date} onChange={setDate} max={todayISO()} />
              </Field>
              <Segmented<PhotoAngle>
                value={angle}
                onChange={setAngle}
                options={[
                  { value: 'front', label: 'Front' },
                  { value: 'side', label: 'Side' },
                  { value: 'back', label: 'Back' },
                ]}
              />
              <input className="input" value={note} maxLength={140} placeholder="Note" onChange={(e) => setNote(e.target.value)} />
              <div className="row gap-2">
                <Button variant="danger" icon={<Trash />} onClick={remove} aria-label="Delete photo" style={{ width: 56, padding: 0 }} />
                <Button block onClick={save}>
                  Save
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="info" className="stack gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {photo.note && <p className="t-small" style={{ color: 'var(--text-1)', textAlign: 'center' }}>{photo.note}</p>}
              <Button
                variant="secondary"
                icon={<Columns2 />}
                onClick={() => {
                  onClose();
                  go('progress', 'studio', { after: photo.id });
                }}
              >
                Compare in Studio
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body,
  );
}
