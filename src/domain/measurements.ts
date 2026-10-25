import type { AppSettings, BuiltInMeasurement, CustomMeasurementType } from '@/data/types';

export const BUILT_IN_MEASUREMENTS: { id: BuiltInMeasurement; label: string }[] = [
  { id: 'arm', label: 'Arm' },
  { id: 'chest', label: 'Chest' },
  { id: 'waist', label: 'Waist' },
  { id: 'hip', label: 'Hip' },
  { id: 'thigh', label: 'Thigh' },
];

const CM_PER_IN = 2.54;

export function measurementTypes(custom: CustomMeasurementType[] = []): { id: string; label: string }[] {
  return [...BUILT_IN_MEASUREMENTS, ...custom];
}

export function measurementLabel(kind: string, custom: CustomMeasurementType[] = []): string {
  return measurementTypes(custom).find((t) => t.id === kind)?.label ?? 'Measurement';
}

export const lengthUnit = (units: AppSettings['units']) => (units === 'imperial' ? 'in' : 'cm');
export const toDisplayLength = (cm: number, units: AppSettings['units']) => (units === 'imperial' ? cm / CM_PER_IN : cm);
export const fromDisplayLength = (v: number, units: AppSettings['units']) => (units === 'imperial' ? v * CM_PER_IN : v);
export const fmtLength = (cm: number, units: AppSettings['units'], dp = 1) => `${toDisplayLength(cm, units).toFixed(dp)} ${lengthUnit(units)}`;
