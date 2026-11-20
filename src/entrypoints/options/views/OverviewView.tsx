import { useState } from 'preact/hooks';
import {
  averageActiveDay,
  cleanStreak,
  dailySeries,
  dayTotal,
  domainTotals,
  hourlyTotals,
  percentChange,
  topWithOther,
  unlockSeries,
  weekdayHourHeatmap,
} from '../../../core/stats';
import { addDays, formatDuration, parseDayKey } from '../../../core/time';
import { BarChart, DoughnutChart, OTHER_COLOR, SERIES_COLORS } from '../../../ui/charts';
import { LimitSummary, SiteAvatar } from '../../../ui/components';
import { loadRange } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';

const sliceColor = (domain: string, i: number) =>
  domain === 'Other' ? OTHER_COLOR : SERIES_COLORS[i % SERIES_COLORS.length]!;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function RangeToggle({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (n: number) => void;
  options: { days: number; label: string }[];
}) {
  return (
    <div class="segmented" role="group" aria-label="Date range">
      {options.map((o) => (
        <button key={o.days} aria-pressed={value === o.days} onClick={() => onChange(o.days)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OverviewView() {
  const [range, setRange] = useState(7);
  const { data } = useLiveData(() => loadRange(range), [range], 30_000);
  if (!data) return null;

  const series = dailySeries(data.byDay, data.days);
  const prevSeries = dailySeries(data.prevByDay, data.prevDays);
  const rangeTotal = series.reduce((a, b) => a + b, 0);
  const prevTotal = prevSeries.reduce((a, b) => a + b, 0);
  const todayMs = dayTotal(data.usage);
  const yesterdayMs = dayTotal(data.byDay[addDays(data.today, -1)]);
  const avg = averageActiveDay(series);
  const unlocks = unlockSeries(data.unlocksByDay, data.days).reduce((a, b) => a + b, 0);
  const streakDays = [...Array(365).keys()].map((i) => addDays(data.today, -i));
  const streak = cleanStreak(data.unlocksByDay, streakDays, data.firstDay);
  const usageList = data.days.map((d) => data.byDay[d]);
  const totals = topWithOther(domainTotals(usageList), 6);
  const hourly = hourlyTotals(usageList);
  const heat = weekdayHourHeatmap(data.byDay, data.days);
  const heatMax = Math.max(1, ...heat.flat());
  const vsYesterday = percentChange(todayMs, yesterdayMs);
  const vsPrev = percentChange(rangeTotal, prevTotal);

  const labels = data.days.map((d) => {
    const date = parseDayKey(d);
    return range <= 7
      ? WEEKDAYS[date.getDay()]!
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  });

  const hasData = rangeTotal > 0;

  return (
    <div class="stack" style={{ gap: 16 }}>
      <div class="page-head">
        <div>
          <h1>Overview</h1>
          <p class="muted">Where your time went{range === 7 ? ' this week' : ' this month'}.</p>
        </div>
        <RangeToggle
          value={range}
          onChange={setRange}
          options={[
            { days: 7, label: '7 days' },
            { days: 30, label: '30 days' },
          ]}
        />
      </div>

      <div class="grid kpis">
        <div class="card kpi">
          <span class="subtle">Today</span>
          <div class="value tabular">{formatDuration(todayMs)}</div>
          <Delta pct={vsYesterday} label="vs yesterday" />
        </div>
        <div class="card kpi">
          <span class="subtle">Daily average</span>
          <div class="value tabular">{formatDuration(avg)}</div>
          <Delta pct={vsPrev} label={`vs previous ${range} days`} />
        </div>
        <div class="card kpi">
          <span class="subtle">Times you gave in</span>
          <div class="value tabular">{unlocks}</div>
          <span class="subtle">limit overrides in {range} days</span>
        </div>
        <div class="card kpi">
          <span class="subtle">Clean streak</span>
          <div class="value tabular">
            {streak} {streak === 1 ? 'day' : 'days'}
          </div>
          <span class="subtle">without overriding a limit</span>
        </div>
      </div>

      {!hasData ? (
        <div class="card empty">
          <p>No activity recorded in this period yet.</p>
          <p class="subtle">
            Browse as usual — Dwell counts time while a tab is active and you're around.
          </p>
        </div>
      ) : (
        <>
          <div class="grid two">
            <section class="card stack" aria-label="Daily total">
              <h2>Daily total</h2>
              <BarChart
                labels={labels}
                values={series}
                highlight={series.length - 1}
                height={360}
                ariaLabel="Active browsing time per day"
              />
            </section>
            <section class="card stack" aria-label="Top sites">
              <h2>Top sites</h2>
              <DoughnutChart
                labels={totals.map((t) => t.domain)}
                values={totals.map((t) => t.ms)}
                colors={totals.map((t, i) => sliceColor(t.domain, i))}
                ariaLabel="Share of time per site"
              />
              <ul class="legend">
                {totals.map((t, i) => (
                  <li class="spread" key={t.domain}>
                    <span class="row grow">
                      <span
                        class="swatch"
                        style={{
                          background: sliceColor(t.domain, i),
                        }}
                      />
                      <span class="truncate">{t.domain}</span>
                    </span>
                    <span class="tabular muted">
                      {formatDuration(t.ms)} · {Math.round((t.ms / rangeTotal) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div class="grid halves">
            <section class="card stack" aria-label="Time of day">
              <h2>Time of day</h2>
              <BarChart
                labels={hourly.map((_, h) => hourLabel(h))}
                values={hourly}
                height={200}
                ariaLabel="Active browsing time per hour of day"
              />
            </section>
            <section class="card stack" aria-label="Weekly rhythm">
              <h2>Weekly rhythm</h2>
              <div
                class="heatmap"
                role="img"
                aria-label="Heatmap of browsing time by weekday and hour"
              >
                <span />
                {hourly.map((_, h) => (
                  <span class="hour" key={h}>
                    {h % 6 === 0 ? hourLabel(h) : ''}
                  </span>
                ))}
                {heat.map((row, d) => [
                  <span key={`l${d}`}>{WEEKDAYS[d]}</span>,
                  ...row.map((ms, h) => (
                    <span
                      key={`${d}-${h}`}
                      class="cell"
                      title={`${WEEKDAYS[d]} ${hourLabel(h)}: ${formatDuration(ms)}`}
                      style={{ opacity: ms ? 0.15 + 0.85 * (ms / heatMax) : 0.06 }}
                    />
                  )),
                ])}
              </div>
            </section>
          </div>
        </>
      )}

      {data.statuses.length > 0 && (
        <section class="card stack" aria-label="Limits today">
          <div class="spread">
            <h2>Limits today</h2>
            <a href="#/limits">Manage</a>
          </div>
          <div class="grid halves">
            {data.statuses.map((s) => (
              <div class="stack" style={{ gap: 6 }} key={s.limit.id}>
                <div class="row">
                  <SiteAvatar domain={s.limit.domains[0]!} size={22} />
                  <strong class="truncate">{s.limit.name}</strong>
                </div>
                <LimitSummary status={s} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Delta({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) return <span class="subtle">no earlier data</span>;
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
  return (
    <span class={`subtle delta ${dir}`}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {Math.abs(pct)}% {label}
    </span>
  );
}
