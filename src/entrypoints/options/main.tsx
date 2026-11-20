import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { Wordmark } from '../../ui/components';
import { useTheme } from '../../ui/hooks';
import '../../ui/styles.css';
import './dashboard.css';
import { parseHash, type Route } from './router';
import { HistoryView } from './views/HistoryView';
import { LimitsView } from './views/LimitsView';
import { SettingsView } from './views/SettingsView';
import { TodayView } from './views/TodayView';
import { WelcomeView } from './views/WelcomeView';

const NAV: { route: Route; label: string }[] = [
  { route: 'today', label: 'Today' },
  { route: 'history', label: 'History' },
  { route: 'limits', label: 'Limits' },
  { route: 'settings', label: 'Settings' },
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
    document.title = `${label} · Overstay`;
  }, [loc.route]);

  return (
    <div class="page">
      <header class="topbar">
        <a href="#/today" class="brand" aria-label="Overstay home">
          <Wordmark size={22} />
        </a>
        <nav aria-label="Main" class="nav">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={`#/${n.route}`}
              class="nav-link"
              aria-current={loc.route === n.route ? 'page' : undefined}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main class="content" key={loc.route}>
        {loc.route === 'today' && <TodayView />}
        {loc.route === 'history' && <HistoryView />}
        {loc.route === 'limits' && <LimitsView params={loc.params} />}
        {loc.route === 'settings' && <SettingsView />}
        {loc.route === 'welcome' && <WelcomeView />}
      </main>
      <footer class="colophon small faint">
        Everything stays in this browser. Overstay is{' '}
        <a href="https://github.com/Arudchayan/overstay" target="_blank" rel="noreferrer">
          open source
        </a>
        .
      </footer>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
