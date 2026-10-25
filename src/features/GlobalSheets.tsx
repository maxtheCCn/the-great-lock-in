import type { LockIn } from '@/data/types';
import { WorkoutSheet } from './sheets/WorkoutSheet';
import { MeasurementSheet } from './sheets/MeasurementSheet';
import { PhotosSheet } from './sheets/PhotosSheet';
import { GoalSheet } from './sheets/GoalSheet';

/** Sheets that can be opened from anywhere via `useUI().openSheet`. */
export function GlobalSheets({ lockIn }: { lockIn: LockIn }) {
  return (
    <>
      <WorkoutSheet lockIn={lockIn} />
      <MeasurementSheet lockIn={lockIn} />
      <PhotosSheet lockIn={lockIn} />
      <GoalSheet lockIn={lockIn} />
    </>
  );
}
