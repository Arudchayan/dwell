import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { domainFromUrl } from '../../core/domain';
import { mostRestrictive, statusesForDomain } from '../../core/limits';
import { dayTotal, domainTotals } from '../../core/stats';
import { formatDuration, MINUTE } from '../../core/time';
import { send } from '../../shared/messages';
import { upsertLimit } from '../../storage';
import { Chips, LimitLine, SiteBar, Wordmark } from '../../ui/components';
import { loadToday, newLimitId } from '../../ui/data';
import { useLiveData, useTheme } from '../../ui/hooks';
import '../../ui/styles.css';
import './popup.css';

const QUICK_LIMITS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
];

function openDashboard(hash = '') {
  void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${hash}`) });
  window.close();
}

function Popup() {
  useTheme();
  const [domain, setDomain] = useState<string | null | undefined>(undefined);
  const { data } = useLiveData(loadToday, [], 5000);

  useEffect(() => {
    void (async () => {
      // Flush the running segment so the numbers are current.
      await send({ type: 'overstay:flush' }).catch(() => undefined);
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      setDomain(domainFromUrl(tab?.url));
    })();
  }, []);

  if (!data || domain === undefined) return <main class="popup" />;

  const total = dayTotal(data.usage);
  const top = domainTotals([data.usage]).slice(0, 5);
  const siteMs = domain ? (data.usage[domain] ?? []).reduce((a, b) => a + b, 0) : 0;
  const siteStatus = domain ? mostRestrictive(statusesForDomain(data.statuses, domain)) : null;
  const hasLimit = domain ? data.limits.some((l) => l.domains.includes(domain)) : false;

  const addLimit = async (minutes: number) => {
    if (!domain) return;
    await upsertLimit({
      id: newLimitId(),
      name: domain,
      domains: [domain],
      dailyMs: minutes * MINUTE,
      days: [],
      enabled: true,
    });
  };

  return (
    <main class="popup">
      <header class="spread popup-head">
        <Wordmark size={18} />
        <button class="btn link small" onClick={() => openDashboard('#/settings')}>
          Settings
        </button>
      </header>

      {domain && (
        <section class="here enter" aria-label="This site">
          <p class="label truncate">{domain}</p>
          <p class="serif here-time num">
            {formatDuration(siteMs)} <span class="here-sub">today</span>
          </p>
          {siteStatus ? (
            <LimitLine status={siteStatus} title={<span class="small muted">Daily limit</span>} />
          ) : hasLimit ? (
            <p class="small faint">Its limit is resting today.</p>
          ) : (
            <div class="stack" style={{ gap: 8 }}>
              <span class="small muted">Give it a daily limit</span>
              <Chips
                label="Daily limit"
                value={null}
                options={QUICK_LIMITS}
                onChange={(m) => void addLimit(m)}
              />
            </div>
          )}
        </section>
      )}

      <section class="today enter-2" aria-labelledby="today-heading">
        <h2 id="today-heading" class="today-total">
          <span class="num">{formatDuration(total)}</span>{' '}
          <span class="here-sub">on the web today</span>
        </h2>
        {top.length === 0 ? (
          <p class="small muted" style={{ paddingTop: 8 }}>
            Nothing yet. Time counts while a tab is open in front of you.
          </p>
        ) : (
          <ul class="sites">
            {top.map((t) => (
              <li key={t.domain}>
                <span class="truncate">{t.domain}</span>
                <span class="num muted small">{formatDuration(t.ms)}</span>
                <SiteBar value={t.ms} max={top[0]!.ms} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer class="popup-foot">
        <button class="btn link" onClick={() => openDashboard()}>
          See the whole week →
        </button>
      </footer>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
