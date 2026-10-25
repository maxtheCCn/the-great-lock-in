import { motion, type HTMLMotionProps } from 'motion/react';
import { Calendar, Check, ChevronDown, Clock, Minus, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { forwardRef, useId, type ReactNode } from 'react';
import { formatDate } from '@/domain/dates';
import type { ISODate } from '@/data/types';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

const tap = { scale: 0.965 };
const spring = { type: 'spring' as const, stiffness: 560, damping: 40, mass: 0.7 };

/* ── Button ──────────────────────────────────────────────── */

type ButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, iconRight, children, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : tap}
      transition={spring}
      disabled={disabled || loading}
      className={cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className)}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  );
});

type IconButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  label: string;
  variant?: 'default' | 'plain' | 'accent';
  size?: 'sm' | 'md';
  children: ReactNode;
};

export function IconButton({ label, variant = 'default', size = 'md', className, children, type = 'button', ...rest }: IconButtonProps) {
  return (
    <motion.button
      type={type}
      aria-label={label}
      title={label}
      whileTap={tap}
      transition={spring}
      className={cx('icon-btn', variant !== 'default' && `icon-btn--${variant}`, size === 'sm' && 'icon-btn--sm', className)}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/* ── Panel ───────────────────────────────────────────────── */

interface PanelProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
  glow?: boolean;
  flush?: boolean;
  tight?: boolean;
  className?: string;
  onPress?: () => void;
  children?: ReactNode;
  style?: React.CSSProperties;
}

export function Panel({ eyebrow, title, action, glow, flush, tight, className, onPress, children, style }: PanelProps) {
  const head =
    eyebrow || title || action ? (
      <div className="panel__head">
        <div className="stack">
          {eyebrow && <div className="panel__eyebrow">{eyebrow}</div>}
          {title && <div className="panel__title t-h3">{title}</div>}
        </div>
        {action}
      </div>
    ) : null;
  const cls = cx('panel', glow && 'panel--glow', flush && 'panel--flush', tight && 'panel--tight', onPress && 'panel--press', className);
  if (onPress) {
    return (
      <motion.button type="button" className={cls} onClick={onPress} whileTap={{ scale: 0.985 }} transition={spring} style={style}>
        {head}
        {children}
      </motion.button>
    );
  }
  return (
    <section className={cls} style={style}>
      {head}
      {children}
    </section>
  );
}

/* ── Small atoms ─────────────────────────────────────────── */

export function Badge({ tone = 'accent', icon, children }: { tone?: 'accent' | 'warn' | 'muted' | 'solid'; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={cx('badge', tone !== 'accent' && `badge--${tone}`)}>
      {icon}
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" disabled={disabled} onClick={() => onChange(!checked)}>
      <motion.span className="toggle__knob" animate={{ x: checked ? 20 : 0 }} transition={spring} />
    </button>
  );
}

export function Chip({ selected, onClick, icon, children }: { selected: boolean; onClick: () => void; icon?: ReactNode; children: ReactNode }) {
  return (
    <motion.button type="button" className="chip" aria-pressed={selected} onClick={onClick} whileTap={tap} transition={spring}>
      {icon}
      {children}
    </motion.button>
  );
}

export function Option({
  selected,
  onClick,
  icon,
  title,
  description,
  multi,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  multi?: boolean;
}) {
  return (
    <motion.button type="button" className="option" aria-pressed={selected} onClick={onClick} whileTap={{ scale: 0.98 }} transition={spring}>
      {icon && <span className="option__icon">{icon}</span>}
      <span className="stack grow">
        <span className="option__title">{title}</span>
        {description && <span className="option__desc">{description}</span>}
      </span>
      <span className="option__check" style={multi ? { borderRadius: 7 } : undefined}>
        {selected && <Check strokeWidth={3} />}
      </span>
    </motion.button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  scroll,
  layoutId,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  scroll?: boolean;
  layoutId?: string;
  ariaLabel?: string;
}) {
  const auto = useId();
  const id = layoutId ?? `seg-${auto}`;
  return (
    <div className={cx('seg', scroll && 'seg--scroll')} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg__item" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={id} className="seg__pill" transition={spring} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, color }: { value: number; color?: string }) {
  return (
    <div className="meter" role="presentation">
      <motion.div
        className="meter__fill"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={color ? { background: color, boxShadow: 'none' } : undefined}
      />
    </div>
  );
}

export function Delta({ value, unit = '', digits = 1, invert, neutral }: { value: number | null; unit?: string; digits?: number; invert?: boolean; neutral?: boolean }) {
  if (value === null) return <span className="delta">no comparison</span>;
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return <span className="delta">± 0{unit}</span>;
  const up = rounded > 0;
  const good = neutral ? null : invert ? !up : up;
  return (
    <span className={cx('delta', good === true && 'delta--up', good === false && 'delta--down')}>
      {up ? <TrendingUp /> : <TrendingDown />}
      {up ? '+' : '−'}
      {Math.abs(rounded).toFixed(digits)}
      {unit}
    </span>
  );
}

export function KV({ value, unit, label }: { value: ReactNode; unit?: string; label: ReactNode }) {
  return (
    <div className="kv">
      <span className="kv__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      <span className="kv__label">{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__emblem">{icon}</div>
      <div className="t-h3">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

/* ── Fields ──────────────────────────────────────────────── */

export function Field({ label, hint, children, htmlFor }: { label: ReactNode; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={htmlFor}>
        <span className="t-eyebrow">{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Styled surface over the native date input, so iOS still shows its own wheel picker. */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: ISODate;
  onChange: (v: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
  label: string;
}) {
  return (
    <div className="picker">
      <span className="picker__icon">
        <Calendar />
      </span>
      <span className="picker__value stack" style={{ lineHeight: 1.2 }}>
        {value ? (
          <>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{formatDate(value, { weekday: 'long' })}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </>
        ) : (
          'Choose a date'
        )}
      </span>
      <span className="picker__chev">
        <ChevronDown />
      </span>
      <input
        className="picker__native"
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </div>
  );
}

export function TimePicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="picker">
      <span className="picker__icon">
        <Clock />
      </span>
      <span className="picker__value t-mono" style={{ fontSize: 18 }}>
        {value}
      </span>
      <span className="picker__chev">
        <ChevronDown />
      </span>
      <input className="picker__native" type="time" aria-label={label} value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

export function SelectPicker<T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  icon?: ReactNode;
}) {
  const current = options.find((o) => o.value === value)?.label ?? 'Choose';
  return (
    <div className="picker">
      {icon && <span className="picker__icon">{icon}</span>}
      <span className="picker__value">{current}</span>
      <span className="picker__chev">
        <ChevronDown />
      </span>
      <select className="picker__native" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  format = (v) => String(v),
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => ReactNode;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  return (
    <div className="row gap-3" role="group" aria-label={label}>
      <IconButton label={`Decrease ${label}`} size="sm" onClick={() => set(value - step)} disabled={value <= min}>
        <Minus />
      </IconButton>
      <span className="t-num" style={{ minWidth: 44, textAlign: 'center', fontSize: 20 }} aria-live="polite">
        {format(value)}
      </span>
      <IconButton label={`Increase ${label}`} size="sm" onClick={() => set(value + step)} disabled={value >= max}>
        <Plus />
      </IconButton>
    </div>
  );
}
