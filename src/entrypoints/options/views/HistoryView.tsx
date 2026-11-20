import { useState } from 'preact/hooks';
import { mostRestrictive, statusesForDomain } from '../../../core/limits';
import {
  averageActiveDay,
  cleanStreak,
  dailySeries,
  domainTotals,
  percentChange,
  unlockSeries,
  weekdayHourHeatmap,
} from '../../../core/stats';
import { addDays, formatDuration, parseDayKey } from '../../../core/time';
import { saveSettings } from '../../../storage';
import { BarChart } from '../../../ui/charts';
import { stateText } from '../../../ui/components';
import { loadRange } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';
import { navigate } from '../router';
import { hourLabel } from './TodayView';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function HistoryView() {
  const [range, setRange] = useState(7);
  const [query, setQuery] = useState('');
  const { data } = useLiveData(() => loadRange(range), [range], 30_000);
  if (!data) return null;

  const series = dailySeries(data.byDay, data.days);
  const prev = dailySeries(data.prevByDay, data.prevDays);
  const sum = series.reduce((a, b) => a + b, 0);
  const prevSum = prev.reduce((a, b) => a + b, 0);
  const avg = averageActiveDay(series);
  const change = percentChange(sum, prevSum);
  const gaveIn = unlockSeries(data.unlocksByDay, data.days).reduce((a, b) => a + b, 0);
  const streak = cleanStreak(
    data.unlocksByDay,
    [...Array(365).keys()].map((i) => addDays(data.today, -i)),
    data.firstDay,
  );
  const totals = domainTotals(data.days.map((d) => data.byDay[d]));
  const q = query.trim().toLowerCase();
  const rows = q ? totals.filter((t) => t.domain.includes(q)) : totals;
  const heat = weekdayHourHeatmap(data.byDay, data.days);
  const heatMax = Math.max(1, ...heat.flat());

  const labels = data.days.map((d) => {
    const date = parseDayKey(d);
    return range <= 7
      ? WEEKDAYS[date.getDay()]!
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  });

  const ignore = async (domain: string) => {
    if (!confirm(`Stop counting time on ${domain}? What's already recorded is kept.`)) return;
    await saveSettings({ ignoredDomains: [...data.settings.ignoredDomains, domain] });
  };

  const comparison =
    change === null
      ? ''
      : Math.abs(change) < 5
        ? ' About the same as the period before.'
        : ` ${Math.abs(change)}% ${change < 0 ? 'less' : 'more'} than the ${range} days before.`;

  return (
    <>
      <section class="lede enter">
        <div class="spread wrap" style={{ alignItems: 'flex-end' }}>
          <h1>
            <span class="num">{formatDuration(avg)}</span> <em>a day, on average.</em>
          </h1>
          <div class="range" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.days} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p>
          {sum === 0
            ? `Nothing recorded in the last ${range} days yet.`
            : `${formatDuration(sum)} across the last ${range} days.${comparison}`}{' '}
          {gaveIn > 0
            ? `You gave in to a limit ${plural(gaveIn, 'time')}; it’s been ${plural(streak, 'day')} since.`
            : data.limits.length > 0 && sum > 0
              ? 'You didn’t give in to a limit once.'
              : ''}
        </p>
      </section>

      <section class="section enter-2" aria-labelledby="days-h">
        <div class="section-head">
          <h2 id="days-h">Day by day</h2>
        </div>
        <BarChart
          labels={labels}
          values={series}
          highlight={series.length - 1}
          height={240}
          ariaLabel="Active browsing time per day"
        />
      </section>

      <section class="section enter-3" aria-labelledby="sites-h">
        <div class="section-head">
          <h2 id="sites-h">Sites</h2>
          <label class="sr-only" for="site-search">
            Filter sites
          </label>
          <input
            id="site-search"
            type="search"
            placeholder="Filter"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
            style={{ maxWidth: 200 }}
          />
        </div>
        {rows.length === 0 ? (
          <p class="muted">{q ? 'No site matches that.' : 'No sites yet.'}</p>
        ) : (
          <table class="plain">
            <thead>
              <tr>
                <th>Site</th>
                <th class="r">Time</th>
                <th class="r">Share</th>
                <th>Today’s limit</th>
                <th>
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const status = mostRestrictive(statusesForDomain(data.statuses, t.domain));
                const limited = data.limits.some((l) => l.domains.includes(t.domain));
                return (
                  <tr key={t.domain}>
                    <td class="truncate" style={{ maxWidth: 260 }}>
                      {t.domain}
                    </td>
                    <td class="r num">{formatDuration(t.ms)}</td>
                    <td class="r num faint">{sum ? Math.round((t.ms / sum) * 100) : 0}%</td>
                    <td>
                      {status ? (
                        <span class={`state ${status.state}`}>{stateText(status)}</span>
                      ) : (
                        <span class="faint small">{limited ? 'Resting today' : '—'}</span>
                      )}
                    </td>
                    <td class="r">
                      <span class="actions row" style={{ justifyContent: 'flex-end', gap: 14 }}>
                        {!limited && (
                          <button
                            class="btn link small"
                            onClick={() => navigate('limits', { add: t.domain })}
                          >
                            Limit
                          </button>
                        )}
                        <button
                          class="btn link small"
                          aria-label={`Stop counting ${t.domain}`}
                          onClick={() => void ignore(t.domain)}
                        >
                          Ignore
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {sum > 0 && (
        <section class="section" aria-labelledby="rhythm-h">
          <div class="section-head">
            <h2 id="rhythm-h">Your rhythm</h2>
            <span class="small faint">darker means more time</span>
          </div>
          <div class="heatmap" role="img" aria-label="Browsing time by weekday and hour">
            <span />
            {heat[0]!.map((_, h) => (
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
                  style={{ opacity: ms ? 0.12 + 0.88 * (ms / heatMax) : 0.05 }}
                />
              )),
            ])}
          </div>
        </section>
      )}
    </>
  );
}
