import { useState } from 'preact/hooks';
import { mostRestrictive, statusesForDomain } from '../../../core/limits';
import { domainTotals } from '../../../core/stats';
import { formatDuration } from '../../../core/time';
import { saveSettings } from '../../../storage';
import { Icon, SiteAvatar, StatePill } from '../../../ui/components';
import { loadRange } from '../../../ui/data';
import { useLiveData } from '../../../ui/hooks';
import { navigate } from '../router';
import { RangeToggle } from './OverviewView';

export function SitesView() {
  const [range, setRange] = useState(1);
  const [query, setQuery] = useState('');
  const { data } = useLiveData(() => loadRange(range), [range], 30_000);
  if (!data) return null;

  const totals = domainTotals(data.days.map((d) => data.byDay[d]));
  const sum = totals.reduce((a, t) => a + t.ms, 0);
  const q = query.trim().toLowerCase();
  const rows = q ? totals.filter((t) => t.domain.includes(q)) : totals;

  const ignore = async (domain: string) => {
    if (!confirm(`Stop tracking ${domain}? Existing history is kept.`)) return;
    await saveSettings({ ignoredDomains: [...data.settings.ignoredDomains, domain] });
  };

  return (
    <div class="stack" style={{ gap: 16 }}>
      <div class="page-head">
        <div>
          <h1>Sites</h1>
          <p class="muted">Every site you spent time on, most first.</p>
        </div>
        <div class="row wrap">
          <label class="sr-only" for="site-search">
            Filter sites
          </label>
          <input
            id="site-search"
            type="search"
            placeholder="Filter…"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
            style={{ width: 180 }}
          />
          <RangeToggle
            value={range}
            onChange={setRange}
            options={[
              { days: 1, label: 'Today' },
              { days: 7, label: '7 days' },
              { days: 30, label: '30 days' },
            ]}
          />
        </div>
      </div>

      <div class="card" style={{ padding: 6 }}>
        {rows.length === 0 ? (
          <p class="empty">{q ? 'No matching sites.' : 'Nothing tracked in this period yet.'}</p>
        ) : (
          <table class="sites">
            <thead>
              <tr>
                <th>Site</th>
                <th class="num">Time</th>
                <th class="num">Share</th>
                <th>Limit</th>
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
                    <td>
                      <span class="row">
                        <SiteAvatar domain={t.domain} size={22} />
                        <span class="truncate">{t.domain}</span>
                      </span>
                    </td>
                    <td class="num">{formatDuration(t.ms)}</td>
                    <td class="num muted">{sum ? Math.round((t.ms / sum) * 100) : 0}%</td>
                    <td>
                      {status ? (
                        <StatePill state={status.state} />
                      ) : limited ? (
                        <span class="subtle">Not today</span>
                      ) : (
                        <span class="subtle">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {!limited && (
                        <button
                          class="btn small"
                          onClick={() => navigate('limits', { add: t.domain })}
                        >
                          <Icon name="plus" size={14} /> Limit
                        </button>
                      )}{' '}
                      <button
                        class="btn small ghost"
                        title={`Stop tracking ${t.domain}`}
                        aria-label={`Stop tracking ${t.domain}`}
                        onClick={() => void ignore(t.domain)}
                      >
                        <Icon name="eye-off" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
