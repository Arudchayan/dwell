import { useState } from 'preact/hooks';
import { MINUTE } from '../../../core/time';
import { getLimits, saveLimits } from '../../../storage';
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
    const add = PRESETS.filter((p) => picked.has(p.name)).map((p) => ({
      id: newLimitId(),
      name: p.name,
      domains: p.domains,
      dailyMs: p.minutes * MINUTE,
      days: [],
      enabled: true,
    }));
    await saveLimits([...(await getLimits()), ...add]);
    navigate(add.length ? 'limits' : 'today');
  };

  return (
    <>
      <section class="lede enter">
        <h1>
          Hello. <em>Let’s see where the time goes.</em>
        </h1>
        <p>
          Overstay quietly counts the minutes each site spends in front of you. When one takes more
          than you’d like, it closes for the day — and getting back in means typing an honest
          sentence about it.
        </p>
      </section>

      <section class="section enter-2" aria-labelledby="start-h">
        <div class="section-head">
          <h2 id="start-h">Any of these pull you in?</h2>
        </div>
        <div class="presets">
          {PRESETS.map((p) => (
            <label class="preset" key={p.name}>
              <input type="checkbox" checked={picked.has(p.name)} onChange={() => toggle(p.name)} />
              <span class="grow">{p.name}</span>
              <span class="small faint">{p.minutes} min a day</span>
            </label>
          ))}
        </div>
        <div class="row" style={{ marginTop: 28 }}>
          <button class="btn solid" onClick={() => void finish()}>
            {picked.size
              ? `Set ${picked.size === 1 ? 'this limit' : `these ${picked.size} limits`}`
              : 'Just watch for now'}
          </button>
          <span class="small faint">You can change any of this later.</span>
        </div>
      </section>

      <section class="section enter-3" aria-labelledby="private-h">
        <div class="section-head">
          <h2 id="private-h">Private by design</h2>
        </div>
        <p class="muted" style={{ maxWidth: '60ch' }}>
          No account, no servers, no analytics. Overstay stores how long you spend on each site —
          never the pages, searches or anything you type — and keeps it in this browser.
        </p>
      </section>
    </>
  );
}
