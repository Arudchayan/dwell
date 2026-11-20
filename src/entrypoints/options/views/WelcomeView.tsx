import { useState } from 'preact/hooks';
import { MINUTE } from '../../../core/time';
import { getLimits, saveLimits } from '../../../storage';
import { Logo, SiteAvatar } from '../../../ui/components';
import { newLimitId } from '../../../ui/data';
import { navigate } from '../router';

const PRESETS = [
  { name: 'X / Twitter', domains: ['x.com', 'twitter.com'], minutes: 30 },
  { name: 'YouTube', domains: ['youtube.com'], minutes: 60 },
  { name: 'Reddit', domains: ['reddit.com'], minutes: 30 },
  { name: 'Instagram', domains: ['instagram.com'], minutes: 30 },
  { name: 'TikTok', domains: ['tiktok.com'], minutes: 30 },
  { name: 'Facebook', domains: ['facebook.com'], minutes: 30 },
];

export function WelcomeView() {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (name: string) => {
    const next = new Set(picked);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setPicked(next);
  };

  const finish = async () => {
    const existing = await getLimits();
    const add = PRESETS.filter((p) => picked.has(p.name)).map((p) => ({
      id: newLimitId(),
      name: p.name,
      domains: p.domains,
      dailyMs: p.minutes * MINUTE,
      days: [],
      enabled: true,
    }));
    await saveLimits([...existing, ...add]);
    navigate(add.length ? 'limits' : 'overview');
  };

  return (
    <div class="stack" style={{ gap: 20, maxWidth: 760 }}>
      <div class="row">
        <Logo size={44} />
        <div>
          <h1>Welcome to Dwell</h1>
          <p class="muted">Know where your time goes. Decide where it stays.</p>
        </div>
      </div>

      <section class="card stack">
        <h2>How it works</h2>
        <ol class="stack muted" style={{ margin: 0, paddingLeft: 18, gap: 6 }}>
          <li>Dwell counts the time a site is in your active tab while you're at the keyboard.</li>
          <li>Give the sites that eat your day a daily allowance.</li>
          <li>
            When it runs out the site is blocked. Getting back in means typing an honest sentence
            about what you're doing — longer every time you give in.
          </li>
        </ol>
        <p class="subtle">
          Private by design: no accounts, no servers, no analytics. Your data stays in this browser.
        </p>
      </section>

      <section class="card stack">
        <h2>Start with a few limits?</h2>
        <p class="muted">You can change or remove these at any time.</p>
        <div class="presets">
          {PRESETS.map((p) => (
            <label class="preset" key={p.name}>
              <input type="checkbox" checked={picked.has(p.name)} onChange={() => toggle(p.name)} />
              <SiteAvatar domain={p.domains[0]!} size={24} />
              <span class="stack" style={{ gap: 0 }}>
                <strong>{p.name}</strong>
                <span class="subtle">{p.minutes} min a day</span>
              </span>
            </label>
          ))}
        </div>
        <div class="row">
          <button class="btn primary" onClick={() => void finish()}>
            {picked.size
              ? `Add ${picked.size} ${picked.size === 1 ? 'limit' : 'limits'}`
              : 'Skip for now'}
          </button>
        </div>
      </section>
    </div>
  );
}
