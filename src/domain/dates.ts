import type { ISODate } from '@/data/types';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local calendar date of a millisecond timestamp. */
export const isoFromMs = (ms: number): ISODate => toISO(new Date(ms));

export function todayISO(): ISODate {
  return toISO(new Date());
}

/** Local midnight for the given ISO date. */
export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function utcDay(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Whole calendar days from `a` to `b` (positive when b is later). DST-safe. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round(utcDay(b) - utcDay(a));
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}
export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(iso: ISODate): number {
  return (parseISO(iso).getDay() + 6) % 7;
}

/** Monday of the ISO week containing `iso`. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekday(iso));
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`;
}

export function daysInMonth(iso: ISODate): number {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Inclusive list of dates. Returns [] when end < start. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(start, end);
  for (let i = 0; i <= n; i++) out.push(addDays(start, i));
  return out;
}

export function inRange(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}

/** ISO 8601 week number. */
export function isoWeekNumber(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY_MS + 1) / 7);
}

const LOCALE = 'en-GB';
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, opts);
    fmtCache.set(k, f);
  }
  return f;
}

export const formatDate = (iso: ISODate, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  fmt(opts).format(parseISO(iso));

export const formatShort = (iso: ISODate) => formatDate(iso, { day: 'numeric', month: 'short' });
export const formatWeekday = (iso: ISODate, style: 'short' | 'long' = 'short') => formatDate(iso, { weekday: style });
export const formatMonthYear = (iso: ISODate) => formatDate(iso, { month: 'long', year: 'numeric' });

export function formatRange(a: ISODate, b: ISODate): string {
  if (a.slice(0, 4) === b.slice(0, 4)) {
    return `${formatShort(a)} - ${formatDate(b)}`;
  }
  return `${formatDate(a)} - ${formatDate(b)}`;
}

export function relativeDay(iso: ISODate, today: ISODate = todayISO()): string {
  const d = diffDays(today, iso);
  if (d === 0) return 'Today';
  if (d === -1) return 'Yesterday';
  if (d === 1) return 'Tomorrow';
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}
