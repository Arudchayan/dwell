import { useEffect, useState } from 'preact/hooks';
import { parseDomainList } from '../../../core/domain';
import { formatDuration, HOUR, MINUTE } from '../../../core/time';
import type { Limit } from '../../../core/types';
import { deleteLimit, upsertLimit } from '../../../storage';
import { Chips, Meter, stateText, Toggle } from '../../../ui/components';
import { loadToday, newLimitId } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const PRESETS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
];

interface Draft {
  id: string;
  name: string;
  domains: string;
  hours: number;
  minutes: number;
  days: number[];
  enabled: boolean;
  isNew: boolean;
}

function toDraft(l: Limit): Draft {
  return {
    id: l.id,
    name: l.name,
    domains: l.domains.join(', '),
    hours: Math.floor(l.dailyMs / HOUR),
    minutes: Math.round((l.dailyMs % HOUR) / MINUTE),
    days: l.days,
    enabled: l.enabled,
    isNew: false,
  };
}

function emptyDraft(domain = ''): Draft {
  return {
    id: newLimitId(),
    name: '',
    domains: domain,
    hours: 0,
    minutes: 30,
    days: [],
    enabled: true,
    isNew: true,
  };
}

function daysText(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'every day';
  const sorted = DAY_ORDER.filter((d) => days.includes(d));
  if (sorted.join() === '1,2,3,4,5') return 'weekdays';
  if (sorted.join() === '6,0') return 'weekends';
  return sorted.map((d) => DAY_NAMES[d]).join(', ');
}

function LimitEditor({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const totalMinutes = (Number(d.hours) || 0) * 60 + (Number(d.minutes) || 0);

  const save = async (e: Event) => {
    e.preventDefault();
    const { valid, invalid } = parseDomainList(d.domains);
    if (invalid.length) return setError(`“${invalid.join('”, “')}” doesn’t look like a website.`);
    if (!valid.length) return setError('Add at least one site, like youtube.com.');
    if (totalMinutes > 24 * 60) return setError('A day only has 24 hours.');
    await upsertLimit({
      id: d.id,
      name: d.name.trim() || valid[0]!,
      domains: valid,
      dailyMs: totalMinutes * MINUTE,
      days: d.days,
      enabled: d.enabled,
    });
    onDone();
  };

  const activeDays = d.days.length === 0 ? DAY_ORDER : d.days;
  const toggleDay = (day: number) => {
    const next = activeDays.includes(day)
      ? activeDays.filter((x) => x !== day)
      : [...activeDays, day];
    set({ days: next.length === 7 ? [] : next });
  };

  return (
    <form class="editor enter" onSubmit={(e) => void save(e)} aria-label="Edit limit">
      <h2 style={{ fontSize: 'var(--step-1)' }}>
        {d.isNew ? 'A new limit' : `Editing ${draft.name}`}
      </h2>
      <div class="fields">
        <label class="field">
          <span>Sites</span>
          <input
            type="text"
            value={d.domains}
            placeholder="youtube.com, or x.com, twitter.com"
            onInput={(e) => {
              set({ domains: e.currentTarget.value });
              setError(null);
            }}
            data-testid="limit-domains"
            autoFocus
          />
          <span class="hint">Separate several with commas. Subdomains count too.</span>
        </label>
        <label class="field">
          <span>Name (optional)</span>
          <input
            type="text"
            value={d.name}
            placeholder="Social media"
            maxLength={60}
            onInput={(e) => set({ name: e.currentTarget.value })}
          />
          <span class="hint">Shown when the site is closed.</span>
        </label>
      </div>

      <div class="stack" style={{ gap: 10 }}>
        <span class="field-label">Allowed each day</span>
        <div class="row wrap" style={{ gap: 16 }}>
          <Chips
            label="Common allowances"
            value={totalMinutes}
            options={PRESETS}
            onChange={(m) => set({ hours: Math.floor(m / 60), minutes: m % 60 })}
          />
          <span class="row small muted" style={{ gap: 6 }}>
            or
            <input
              type="number"
              min={0}
              max={24}
              value={d.hours}
              onInput={(e) => set({ hours: Number(e.currentTarget.value) })}
              style={{ width: 64 }}
              aria-label="Hours"
            />
            h
            <input
              type="number"
              min={0}
              max={59}
              value={d.minutes}
              onInput={(e) => set({ minutes: Number(e.currentTarget.value) })}
              style={{ width: 64 }}
              aria-label="Minutes"
              data-testid="limit-minutes"
            />
            min
          </span>
        </div>
        {totalMinutes === 0 && (
          <span class="hint">Zero closes the site completely on those days.</span>
        )}
      </div>

      <div class="stack" style={{ gap: 10 }}>
        <span class="field-label">On</span>
        <div class="row wrap" style={{ gap: 14 }}>
          <div class="weekdays chips" role="group" aria-label="Weekdays">
            {DAY_ORDER.map((day) => (
              <button
                type="button"
                class="chip"
                key={day}
                aria-label={DAY_NAMES[day]}
                aria-pressed={activeDays.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {DAY_LETTERS[day]}
              </button>
            ))}
          </div>
          <span class="small faint">{daysText(d.days)}</span>
        </div>
      </div>

      {error && (
        <p class="error-text" role="alert">
          {error}
        </p>
      )}
      <div class="row">
        <button class="btn solid" type="submit" data-testid="limit-save">
          Save limit
        </button>
        <button class="btn link" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LimitsView({ params }: { params: URLSearchParams }) {
  const { data, reload } = useLiveData(loadToday, [], 30_000);
  const [editing, setEditing] = useState<Draft | null>(null);
  const addParam = params.get('add');

  useEffect(() => {
    if (addParam) setEditing(emptyDraft(addParam));
  }, [addParam]);

  if (!data) return null;

  const close = () => {
    setEditing(null);
    if (addParam) location.hash = '#/limits';
    reload();
  };

  return (
    <>
      <section class="lede enter">
        <h1>
          Limits <em>you’ve set yourself.</em>
        </h1>
        <p>
          When a site uses up its daily allowance it closes until{' '}
          {data.settings.resetHour ? `${data.settings.resetHour}:00` : 'midnight'}. Getting back in
          means typing an honest sentence about it.
        </p>
      </section>

      {editing?.isNew ? (
        <LimitEditor key={editing.id} draft={editing} onDone={close} />
      ) : (
        <div style={{ marginBottom: 12 }}>
          <button
            class="btn solid"
            onClick={() => setEditing(emptyDraft())}
            data-testid="add-limit"
          >
            Add a limit
          </button>
        </div>
      )}

      {data.limits.length === 0 && !editing ? (
        <div class="empty">
          <p class="serif">No limits yet.</p>
          <p>Start with the one site you reach for without thinking.</p>
        </div>
      ) : (
        <div>
          {data.limits.map((l) => {
            if (editing && !editing.isNew && editing.id === l.id) {
              return <LimitEditor key={l.id} draft={editing} onDone={close} />;
            }
            const status = data.statuses.find((s) => s.limit.id === l.id);
            const unlocks = data.unlocks.filter((u) => u.limitId === l.id).length;
            return (
              <article
                key={l.id}
                class={`limit-row ${l.enabled ? '' : 'paused'}`}
                aria-label={`Limit ${l.name}`}
              >
                <div class="stack" style={{ gap: 3 }}>
                  <h3 class="truncate">{l.name}</h3>
                  <span class="small faint truncate">
                    {formatDuration(l.dailyMs)} {daysText(l.days)}
                    {l.domains.join(', ') !== l.name && ` · ${l.domains.join(', ')}`}
                  </span>
                </div>
                <div class="stack" style={{ gap: 7 }}>
                  {status ? (
                    <>
                      <Meter
                        value={status.usedMs}
                        max={l.dailyMs}
                        state={status.state}
                        label={`${l.name} usage`}
                      />
                      <span class="spread small">
                        <span class="faint num">{formatDuration(status.usedMs)} used</span>
                        <span class={`state ${status.state}`}>{stateText(status)}</span>
                      </span>
                    </>
                  ) : (
                    <span class="small faint">{l.enabled ? 'Resting today' : 'Paused'}</span>
                  )}
                  {unlocks > 0 && (
                    <span class="small over">
                      Overridden {unlocks === 1 ? 'once' : `${unlocks} times`} today
                    </span>
                  )}
                </div>
                <div class="row" style={{ gap: 16 }}>
                  <Toggle
                    checked={l.enabled}
                    label={<span class="sr-only">Enabled</span>}
                    onChange={(enabled) => void upsertLimit({ ...l, enabled })}
                  />
                  <button class="btn link small" onClick={() => setEditing(toDraft(l))}>
                    Edit
                  </button>
                  <button
                    class="btn link small"
                    onClick={() => {
                      if (confirm(`Remove the limit for ${l.name}?`)) void deleteLimit(l.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
