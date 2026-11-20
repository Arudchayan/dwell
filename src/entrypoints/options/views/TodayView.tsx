import { dayTotal, domainTotals, hourlyTotals, percentChange } from '../../../core/stats';
import { addDays, formatDuration } from '../../../core/time';
import { BarChart } from '../../../ui/charts';
import { LimitLine, SiteBar } from '../../../ui/components';
import { loadRange } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';

export function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

/** "22% less than yesterday", or something kinder when there is nothing to compare. */
function comparison(today: number, yesterday: number): string {
  const pct = percentChange(today, yesterday);
  if (pct === null) return 'Nothing from yesterday to compare with yet.';
  if (Math.abs(pct) < 5) return 'About the same as yesterday.';
  return pct < 0
    ? `That’s ${Math.abs(pct)}% less than yesterday.`
    : `That’s ${pct}% more than yesterday.`;
}

export function TodayView() {
  const { data } = useLiveData(() => loadRange(2), [], 30_000);
  if (!data) return null;

  const total = dayTotal(data.usage);
  const yesterday = dayTotal(data.byDay[addDays(data.today, -1)]);
  const sites = domainTotals([data.usage]).slice(0, 8);
  const hourly = hourlyTotals([data.usage]);
  const blocked = data.statuses.filter((s) => s.state === 'blocked');
  const limited = new Set(data.limits.flatMap((l) => l.domains));
  const suggestion = sites.find((s) => !limited.has(s.domain));

  return (
    <>
      <section class="lede enter">
        <h1>
          <span class="num">{formatDuration(total)}</span> <em>on the web today.</em>
        </h1>
        <p>
          {total === 0
            ? 'Nothing counted yet. Time adds up while a site is in the tab in front of you.'
            : comparison(total, yesterday)}
          {blocked.length > 0 &&
            ` ${blocked.map((s) => s.limit.name).join(' and ')} ${
              blocked.length === 1 ? 'is' : 'are'
            } closed for the rest of the day.`}
        </p>
      </section>

      <section class="section enter-2" aria-labelledby="limits-h">
        <div class="section-head">
          <h2 id="limits-h">Limits</h2>
          <a href="#/limits" class="small">
            {data.limits.length ? 'Edit limits' : 'Set a limit'}
          </a>
        </div>
        {data.statuses.length > 0 ? (
          <div class="limit-list">
            {data.statuses.map((s) => (
              <LimitLine key={s.limit.id} status={s} />
            ))}
          </div>
        ) : (
          <p class="muted">
            {data.limits.length ? 'None of your limits apply today.' : 'No limits yet. '}
            {!data.limits.length && suggestion && (
              <>
                Your most visited site today is <strong>{suggestion.domain}</strong> —{' '}
                <a href={`#/limits?add=${encodeURIComponent(suggestion.domain)}`}>
                  give it a daily allowance
                </a>
                .
              </>
            )}
          </p>
        )}
      </section>

      {total > 0 && (
        <div class="split enter-3">
          <section class="section" aria-labelledby="where-h">
            <div class="section-head">
              <h2 id="where-h">Where it went</h2>
            </div>
            <ul class="sites">
              {sites.map((t) => (
                <li key={t.domain}>
                  <span class="truncate">{t.domain}</span>
                  <span class="num muted">{formatDuration(t.ms)}</span>
                  <SiteBar value={t.ms} max={sites[0]!.ms} />
                </li>
              ))}
            </ul>
          </section>
          <section class="section" aria-labelledby="day-h">
            <div class="section-head">
              <h2 id="day-h">Through the day</h2>
            </div>
            <BarChart
              labels={hourly.map((_, h) => hourLabel(h))}
              values={hourly}
              highlight={new Date().getHours()}
              height={220}
              ariaLabel="Active browsing time per hour today"
            />
          </section>
        </div>
      )}
    </>
  );
}
