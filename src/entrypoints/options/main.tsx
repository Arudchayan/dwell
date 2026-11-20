import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon, Logo } from '../../ui/components';
import { useTheme } from '../../ui/hooks';
import '../../ui/styles.css';
import './dashboard.css';
import { parseHash, type Route } from './router';
import { DataView } from './views/DataView';
import { LimitsView } from './views/LimitsView';
import { OverviewView } from './views/OverviewView';
import { SettingsView } from './views/SettingsView';
import { SitesView } from './views/SitesView';
import { WelcomeView } from './views/WelcomeView';

const NAV: { route: Route; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { route: 'overview', label: 'Overview', icon: 'chart' },
  { route: 'sites', label: 'Sites', icon: 'list' },
  { route: 'limits', label: 'Limits', icon: 'shield' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
  { route: 'data', label: 'Your data', icon: 'database' },
];

function App() {
  useTheme();
  const [loc, setLoc] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const onHash = () => {
      setLoc(parseHash(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const label = NAV.find((n) => n.route === loc.route)?.label ?? 'Welcome';
    document.title = `${label} — Dwell`;
  }, [loc.route]);

  return (
    <div class="layout">
      <aside class="sidebar">
        <a class="brand row" href="#/overview">
          <Logo size={28} />
          <span>Dwell</span>
        </a>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={`#/${n.route}`}
              class={`nav-link ${loc.route === n.route ? 'active' : ''}`}
              aria-current={loc.route === n.route ? 'page' : undefined}
            >
              <Icon name={n.icon} />
              {n.label}
            </a>
          ))}
        </nav>
        <p class="subtle sidebar-foot">
          100% local. Nothing leaves your browser.
          <br />
          <a href="https://github.com/Arudchayan/dwell" target="_blank" rel="noreferrer">
            Open source on GitHub
          </a>
        </p>
      </aside>
      <main class="content">
        {loc.route === 'overview' && <OverviewView />}
        {loc.route === 'sites' && <SitesView />}
        {loc.route === 'limits' && <LimitsView params={loc.params} />}
        {loc.route === 'settings' && <SettingsView />}
        {loc.route === 'data' && <DataView />}
        {loc.route === 'welcome' && <WelcomeView />}
      </main>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
