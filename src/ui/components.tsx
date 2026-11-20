import type { ComponentChildren } from 'preact';
import type { LimitState, LimitStatus } from '../core/limits';
import { formatDuration } from '../core/time';

/** A hairline meter. Fills up to 100%; the state picks the colour. */
export function Meter({
  value,
  max,
  state = 'ok',
  label,
}: {
  value: number;
  max: number;
  state?: LimitState;
  label: string;
}) {
  const pct = max <= 0 ? 100 : Math.min(100, (value / max) * 100);
  return (
    <div
      class={`meter ${state}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Plain-language state of a limit: "8m left", "Over by 7m", "Unlocked for 3m". */
export function stateText(status: LimitStatus, now = Date.now()): string {
  switch (status.state) {
    case 'blocked': {
      const over = status.usedMs - status.limit.dailyMs;
      return over >= 60_000 ? `Over by ${formatDuration(over)}` : 'Time’s up';
    }
    case 'grace':
      return `Unlocked for ${formatDuration(Math.max(0, (status.graceUntil ?? now) - now), { seconds: true })}`;
    default:
      return `${formatDuration(status.remainingMs)} left`;
  }
}

/** One limit as a line: name, meter, used / allowed and its state. */
export function LimitLine({ status, title }: { status: LimitStatus; title?: ComponentChildren }) {
  const { usedMs, limit, state } = status;
  return (
    <div class="stack" style={{ gap: 7 }}>
      <div class="spread">
        <span class="truncate">{title ?? limit.name}</span>
        <span class={`state ${state}`}>{stateText(status)}</span>
      </div>
      <Meter value={usedMs} max={limit.dailyMs} state={state} label={`${limit.name} usage`} />
      <span class="small faint num">
        {formatDuration(usedMs)} of {formatDuration(limit.dailyMs)}
      </span>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ComponentChildren;
  description?: ComponentChildren;
}) {
  return (
    <label class="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="track" />
      <span class="stack" style={{ gap: 2 }}>
        <span style={{ fontWeight: 550 }}>{label}</span>
        {description && <span class="hint">{description}</span>}
      </span>
    </label>
  );
}

/** Choose-one chips (durations, ranges). */
export function Chips<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div class="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          class="chip"
          key={String(o.value)}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return <img src="/icon/128.png" width={size} height={size} alt="" style={{ borderRadius: 5 }} />;
}

/** The wordmark: icon plus the name set in the serif. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span class="row" style={{ gap: 8 }}>
      <Logo size={size} />
      <span class="serif" style={{ fontSize: size * 0.95, fontWeight: 500 }}>
        Overstay
      </span>
    </span>
  );
}

/** The share of a list's largest value, for hairline bars. */
export function SiteBar({ value, max }: { value: number; max: number }) {
  return (
    <span class="bar" aria-hidden="true">
      <span style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%` }} />
    </span>
  );
}
