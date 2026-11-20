import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { domainFromUrl } from '../../core/domain';
import { mostRestrictive, statusesForDomain } from '../../core/limits';
import { dayTotal, domainTotals } from '../../core/stats';
import { formatDuration, MINUTE } from '../../core/time';
import { send } from '../../shared/messages';
import { upsertLimit } from '../../storage';
import { Icon, LimitSummary, Logo, SiteAvatar } from '../../ui/components';
import { loadToday, newLimitId } from '../../ui/data';
import { useLiveData, useTheme } from '../../ui/hooks';
import '../../ui/styles.css';
import './popup.css';

const QUICK_LIMITS = [15, 30, 60, 120];

function Popup() {
  useTheme();
  const [domain, setDomain] = useState<string | null | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const { data } = useLiveData(loadToday, [], 5000);

  useEffect(() => {
    void (async () => {
      // Flush the running segment so the numbers are up to date.
      await send({ type: 'dwell:flush' }).catch(() => undefined);
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      setDomain(domainFromUrl(tab?.url));
    })();
  }, []);

  const openDashboard = (hash = '') => {
    void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${hash}`) });
    window.close();
  };

  if (!data) return <div class="popup" />;

  const total = dayTotal(data.usage);
  const top = domainTotals([data.usage]).slice(0, 5);
  const max = top[0]?.ms ?? 1;
  const siteMs = domain ? (data.usage[domain] ?? []).reduce((a, b) => a + b, 0) : 0;
  const siteStatus = domain ? mostRestrictive(statusesForDomain(data.statuses, domain)) : null;
  const hasLimit = domain ? data.limits.some((l) => l.domains.includes(domain)) : false;

  const addLimit = async () => {
    if (!domain) return;
    await upsertLimit({
      id: newLimitId(),
      name: domain,
      domains: [domain],
      dailyMs: minutes * MINUTE,
      days: [],
      enabled: true,
    });
    setAdding(false);
  };

  return (
    <div class="popup stack">
      <header class="spread">
        <div class="row">
          <Logo size={22} />
          <strong>Dwell</strong>
        </div>
        <button
          class="btn ghost icon-btn"
          title="Settings"
          aria-label="Open settings"
          onClick={() => openDashboard('#/settings')}
        >
          <Icon name="settings" />
        </button>
      </header>

      {domain && (
        <section class="card stack current" aria-label="Current site">
          <div class="row">
            <SiteAvatar domain={domain} size={30} />
            <div class="grow">
              <div class="truncate" style={{ fontWeight: 600 }}>
                {domain}
              </div>
              <div class="subtle tabular">{formatDuration(siteMs)} today</div>
            </div>
          </div>
          {siteStatus ? (
            <LimitSummary status={siteStatus} />
          ) : hasLimit ? (
            <p class="subtle">Your limit for this site is not active today.</p>
          ) : adding ? (
            <div class="row">
              <label class="sr-only" for="quick-limit">
                Daily limit
              </label>
              <select
                id="quick-limit"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.currentTarget.value))}
              >
                {QUICK_LIMITS.map((m) => (
                  <option value={m} key={m}>
                    {formatDuration(m * MINUTE)} a day
                  </option>
                ))}
              </select>
              <button class="btn primary" onClick={() => void addLimit()}>
                Save
              </button>
            </div>
          ) : (
            <button class="btn" onClick={() => setAdding(true)}>
              <Icon name="clock" /> Set a daily limit
            </button>
          )}
        </section>
      )}

      <section class="stack" aria-label="Today">
        <div class="spread">
          <h2>Today</h2>
          <span class="tabular total">{formatDuration(total)}</span>
        </div>
        {top.length === 0 ? (
          <p class="empty">No browsing tracked yet today.</p>
        ) : (
          <ul class="sites">
            {top.map((t) => (
              <li class="site-row" key={t.domain}>
                <SiteAvatar domain={t.domain} size={22} />
                <div class="grow">
                  <div class="truncate">{t.domain}</div>
                  <div class="bar" style={{ width: `${Math.max(4, (t.ms / max) * 100)}%` }} />
                </div>
                <span class="tabular muted">{formatDuration(t.ms)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button class="btn" style={{ justifyContent: 'center' }} onClick={() => openDashboard()}>
        <Icon name="chart" /> Open dashboard
      </button>
    </div>
  );
}

render(<Popup />, document.getElementById('app')!);
