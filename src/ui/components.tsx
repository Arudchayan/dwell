import type { ComponentChildren, JSX } from 'preact';
import type { LimitState, LimitStatus } from '../core/limits';
import { hash } from '../core/sentences';
import { formatDuration } from '../core/time';

const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#2563eb',
  '#65a30d',
  '#ea580c',
];

export function colorFor(domain: string): string {
  return AVATAR_COLORS[hash(domain) % AVATAR_COLORS.length]!;
}

export function SiteAvatar({ domain, size = 26 }: { domain: string; size?: number }) {
  return (
    <span
      class="avatar"
      aria-hidden="true"
      style={{
        background: colorFor(domain),
        width: size,
        height: size,
        fontSize: Math.round(size / 2),
      }}
    >
      {domain.charAt(0)}
    </span>
  );
}

export function ProgressBar({
  value,
  max,
  state = 'ok',
  label,
}: {
  value: number;
  max: number;
  state?: LimitState;
  label?: string;
}) {
  const pct = max <= 0 ? 100 : Math.min(100, (value / max) * 100);
  return (
    <div
      class={`progress ${state}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

const STATE_LABEL: Record<LimitState, string> = {
  ok: 'On track',
  warning: 'Almost out',
  grace: 'Grace period',
  blocked: 'Blocked',
};

export function StatePill({ state }: { state: LimitState }) {
  return <span class={`pill ${state}`}>{STATE_LABEL[state]}</span>;
}

export function LimitSummary({ status }: { status: LimitStatus }) {
  const { usedMs, limit, state } = status;
  return (
    <div class="stack" style={{ gap: 6 }}>
      <div class="spread">
        <span class="tabular">
          <strong>{formatDuration(usedMs)}</strong>
          <span class="muted"> / {formatDuration(limit.dailyMs)}</span>
        </span>
        <StatePill state={state} />
      </div>
      <ProgressBar value={usedMs} max={limit.dailyMs} state={state} label={`${limit.name} usage`} />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ComponentChildren;
  description?: ComponentChildren;
  id?: string;
}) {
  return (
    <label class="switch" for={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span class="track" />
      <span class="stack" style={{ gap: 0 }}>
        <span style={{ fontWeight: 550 }}>{label}</span>
        {description && <span class="subtle">{description}</span>}
      </span>
    </label>
  );
}

type IconName =
  | 'settings'
  | 'chart'
  | 'list'
  | 'shield'
  | 'database'
  | 'plus'
  | 'trash'
  | 'edit'
  | 'external'
  | 'clock'
  | 'eye-off'
  | 'heart';

const PATHS: Record<IconName, JSX.Element> = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14L21 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M1 1l22 22" />
    </>
  ),
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return <img src="/icon/128.png" width={size} height={size} alt="" style={{ borderRadius: 6 }} />;
}
