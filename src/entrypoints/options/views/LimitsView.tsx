import { useEffect, useState } from 'preact/hooks';
import { parseDomainList } from '../../../core/domain';
import { evaluateLimit } from '../../../core/limits';
import { formatDuration, HOUR, MINUTE, weekdayOf } from '../../../core/time';
import type { Limit } from '../../../core/types';
import { deleteLimit, upsertLimit } from '../../../storage';
import { Icon, LimitSummary, SiteAvatar, Toggle } from '../../../ui/components';
import { loadToday, newLimitId } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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
    name: domain,
    domains: domain,
    hours: 0,
    minutes: 30,
    days: [],
    enabled: true,
    isNew: true,
  };
}

function LimitEditor({
  draft,
  onCancel,
  onSaved,
}: {
  draft: Draft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });

  const save = async (e: Event) => {
    e.preventDefault();
    const { valid, invalid } = parseDomainList(d.domains);
    if (invalid.length) return setError(`Not a valid site: ${invalid.join(', ')}`);
    if (!valid.length) return setError('Add at least one site, e.g. youtube.com');
    const dailyMs = (Number(d.hours) || 0) * HOUR + (Number(d.minutes) || 0) * MINUTE;
    if (dailyMs > 24 * HOUR) return setError('A day only has 24 hours.');
    await upsertLimit({
      id: d.id,
      name: d.name.trim() || valid[0]!,
      domains: valid,
      dailyMs,
      days: d.days,
      enabled: d.enabled,
    });
    onSaved();
  };

  const toggleDay = (day: number) =>
    set({ days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] });

  return (
    <form class="card stack" onSubmit={(e) => void save(e)} aria-label="Edit limit">
      <h2>{d.isNew ? 'New limit' : `Edit ${draft.name}`}</h2>
      <div class="grid halves">
        <label class="field">
          Sites
          <input
            type="text"
            value={d.domains}
            placeholder="twitter.com, x.com"
            onInput={(e) => set({ domains: e.currentTarget.value })}
            required
            data-testid="limit-domains"
          />
          <span class="hint">Separate several sites with commas. Subdomains are included.</span>
        </label>
        <label class="field">
          Name
          <input
            type="text"
            value={d.name}
            placeholder="Social media"
            maxLength={60}
            onInput={(e) => set({ name: e.currentTarget.value })}
          />
          <span class="hint">Shown on the block page.</span>
        </label>
      </div>
      <fieldset class="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 550, marginBottom: 5 }}>Daily allowance</legend>
        <div class="row">
          <label class="row">
            <input
              type="number"
              min={0}
              max={24}
              value={d.hours}
              onInput={(e) => set({ hours: Number(e.currentTarget.value) })}
              style={{ width: 80 }}
              aria-label="Hours"
            />
            <span class="muted">h</span>
          </label>
          <label class="row">
            <input
              type="number"
              min={0}
              max={59}
              value={d.minutes}
              onInput={(e) => set({ minutes: Number(e.currentTarget.value) })}
              style={{ width: 80 }}
              aria-label="Minutes"
              data-testid="limit-minutes"
            />
            <span class="muted">min</span>
          </label>
          <span class="subtle">0 blocks the site entirely.</span>
        </div>
      </fieldset>
      <div class="field">
        <span style={{ fontWeight: 550 }}>Active on</span>
        <div class="weekdays" role="group" aria-label="Weekdays">
          {DAY_ORDER.map((day) => (
            <button
              type="button"
              key={day}
              aria-pressed={d.days.length === 0 || d.days.includes(day)}
              onClick={() =>
                d.days.length === 0
                  ? set({ days: DAY_ORDER.filter((x) => x !== day) })
                  : toggleDay(day)
              }
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
        <span class="hint subtle">
          {d.days.length === 0 || d.days.length === 7
            ? 'Every day.'
            : 'Only on the highlighted days.'}
        </span>
      </div>
      {error && (
        <p class="input-error" role="alert">
          {error}
        </p>
      )}
      <div class="row">
        <button class="btn primary" type="submit" data-testid="limit-save">
          Save limit
        </button>
        <button class="btn ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function LimitsView({ params }: { params: URLSearchParams }) {
  const { data, reload } = useLiveData(loadToday, [], 30_000);
  const [editing, setEditing] = useState<Draft | null>(null);

  useEffect(() => {
    const add = params.get('add');
    if (add) setEditing(emptyDraft(add));
  }, [params.get('add')]);

  if (!data) return null;
  const weekday = weekdayOf(data.today);
  const now = Date.now();

  const close = () => {
    setEditing(null);
    if (params.get('add')) location.hash = '#/limits';
    reload();
  };

  return (
    <div class="stack" style={{ gap: 16 }}>
      <div class="page-head">
        <div>
          <h1>Limits</h1>
          <p class="muted">
            When a site uses up its daily allowance it is blocked until the day resets
            {data.settings.resetHour ? ` at ${data.settings.resetHour}:00` : ' at midnight'}.
          </p>
        </div>
        {!editing && (
          <button
            class="btn primary"
            onClick={() => setEditing(emptyDraft())}
            data-testid="add-limit"
          >
            <Icon name="plus" /> Add limit
          </button>
        )}
      </div>

      {editing && <LimitEditor key={editing.id} draft={editing} onCancel={close} onSaved={close} />}

      {data.limits.length === 0 && !editing ? (
        <div class="card empty">
          <p>No limits yet.</p>
          <p class="subtle">Pick the sites that eat your day and give them a daily allowance.</p>
        </div>
      ) : (
        <div class="grid halves">
          {data.limits.map((l) => {
            const status = evaluateLimit(l, data.usage, weekday, undefined, now);
            const live = data.statuses.find((s) => s.limit.id === l.id) ?? status;
            const unlocks = data.unlocks.filter((u) => u.limitId === l.id).length;
            return (
              <article class="card stack limit-card" key={l.id} aria-label={`Limit ${l.name}`}>
                <div class="spread">
                  <div class="row grow">
                    <SiteAvatar domain={l.domains[0]!} />
                    <div class="grow">
                      <h3 class="truncate">{l.name}</h3>
                      <span class="subtle">
                        {formatDuration(l.dailyMs)} a day
                        {l.days.length > 0 &&
                          l.days.length < 7 &&
                          ` · ${l.days.map((x) => DAY_LABELS[x]).join(' ')}`}
                      </span>
                    </div>
                  </div>
                  <Toggle
                    checked={l.enabled}
                    label={<span class="sr-only">Enabled</span>}
                    onChange={(enabled) => void upsertLimit({ ...l, enabled })}
                  />
                </div>
                <div class="domains">
                  {l.domains.map((d) => (
                    <span class="pill" key={d}>
                      {d}
                    </span>
                  ))}
                </div>
                {live ? (
                  <LimitSummary status={live} />
                ) : (
                  <p class="subtle">{l.enabled ? 'Not active today.' : 'Paused.'}</p>
                )}
                {unlocks > 0 && <p class="subtle">You overrode this limit {unlocks}× today.</p>}
                <div class="row">
                  <button class="btn small" onClick={() => setEditing(toDraft(l))}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                  <button
                    class="btn small ghost"
                    onClick={() => {
                      if (confirm(`Delete the limit "${l.name}"?`)) void deleteLimit(l.id);
                    }}
                  >
                    <Icon name="trash" size={14} /> Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
