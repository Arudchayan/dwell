import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { parseDomainList } from '../../../core/domain';
import { BASE_SENTENCES } from '../../../core/sentences';
import type { Settings } from '../../../core/types';
import { getSettings, saveSettings } from '../../../storage';
import { Toggle } from '../../../ui/components';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ComponentChildren;
}) {
  return (
    <section class="settings-section">
      <div>
        <h2>{title}</h2>
        {description && (
          <p class="subtle" style={{ marginTop: 4 }}>
            {description}
          </p>
        )}
      </div>
      <div class="stack" style={{ gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

export function SettingsView() {
  const [s, setS] = useState<Settings>();
  const [ignored, setIgnored] = useState('');
  const [ignoredError, setIgnoredError] = useState<string | null>(null);
  const [sentences, setSentences] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void getSettings().then((v) => {
      setS(v);
      setIgnored(v.ignoredDomains.join('\n'));
      setSentences(v.customSentences.join('\n'));
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s) return null;

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setS(next);
    setToast('Saved');
  };

  return (
    <div class="stack">
      <div class="page-head">
        <div>
          <h1>Settings</h1>
          <p class="muted">Changes are saved automatically.</p>
        </div>
      </div>

      <div class="card" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <Section title="Overrides" description="What happens when you try to get past a block.">
          <Toggle
            checked={s.strictMode}
            onChange={(strictMode) => void update({ strictMode })}
            label="Strict mode"
            description="No way to override a block until the day resets. No sentences, no exceptions."
          />
          <label class="field" style={{ maxWidth: 260 }}>
            Grace period after typing the sentence
            <select
              value={s.graceMinutes}
              disabled={s.strictMode}
              onChange={(e) => void update({ graceMinutes: Number(e.currentTarget.value) })}
            >
              {[1, 2, 3, 5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>
                  {m} {m === 1 ? 'minute' : 'minutes'}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            Your own guilt sentences
            <textarea
              rows={4}
              value={sentences}
              placeholder={BASE_SENTENCES[0]}
              onInput={(e) => setSentences(e.currentTarget.value)}
              onBlur={() => void update({ customSentences: sentences.split('\n') })}
            />
            <span class="hint">
              One per line, at least 10 characters. They are mixed in with the built-in ones. Write{' '}
              <code>{'{site}'}</code> to insert the limit's name.
            </span>
          </label>
        </Section>

        <Section title="Tracking" description="What counts as time spent on a site.">
          <label class="field" style={{ maxWidth: 260 }}>
            Pause when I'm away for
            <select
              value={s.idleSeconds}
              onChange={(e) => void update({ idleSeconds: Number(e.currentTarget.value) })}
            >
              {[30, 60, 120, 300, 600].map((sec) => (
                <option key={sec} value={sec}>
                  {sec < 60 ? `${sec} seconds` : `${sec / 60} ${sec === 60 ? 'minute' : 'minutes'}`}
                </option>
              ))}
            </select>
          </label>
          <Toggle
            checked={s.countAudibleWhenIdle}
            onChange={(countAudibleWhenIdle) => void update({ countAudibleWhenIdle })}
            label="Keep counting while a tab plays sound"
            description="Watching a video or in a call counts even if you don't touch the keyboard."
          />
          <label class="field">
            Never track these sites
            <textarea
              rows={3}
              value={ignored}
              placeholder={'mail.example.com\nlocalhost'}
              onInput={(e) => {
                setIgnored(e.currentTarget.value);
                setIgnoredError(null);
              }}
              onBlur={() => {
                const { valid, invalid } = parseDomainList(ignored);
                if (invalid.length)
                  setIgnoredError(`Ignored invalid entries: ${invalid.join(', ')}`);
                setIgnored(valid.join('\n'));
                void update({ ignoredDomains: valid });
              }}
            />
            {ignoredError && <span class="input-error">{ignoredError}</span>}
          </label>
        </Section>

        <Section title="Day & history">
          <label class="field" style={{ maxWidth: 260 }}>
            A new day starts at
            <select
              value={s.resetHour}
              onChange={(e) => void update({ resetHour: Number(e.currentTarget.value) })}
            >
              {[...Array(24).keys()].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00{h === 0 ? ' (midnight)' : ''}
                </option>
              ))}
            </select>
            <span class="hint">
              Night owl? Use 04:00 so late browsing counts towards the day before.
            </span>
          </label>
          <label class="field" style={{ maxWidth: 260 }}>
            Keep history for
            <select
              value={s.retentionDays}
              onChange={(e) => void update({ retentionDays: Number(e.currentTarget.value) })}
            >
              {[30, 90, 180, 365, 730, 3650].map((d) => (
                <option key={d} value={d}>
                  {d >= 365 ? `${d / 365} ${d === 365 ? 'year' : 'years'}` : `${d} days`}
                </option>
              ))}
            </select>
          </label>
        </Section>

        <Section title="Appearance & alerts">
          <Toggle
            checked={s.notifications}
            onChange={(notifications) => void update({ notifications })}
            label="Notifications"
            description="Warn at 80% of a limit, with 5 minutes left, and when a site is blocked."
          />
          <label class="field" style={{ maxWidth: 260 }}>
            Theme
            <select
              value={s.theme}
              onChange={(e) => void update({ theme: e.currentTarget.value as Settings['theme'] })}
            >
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </Section>
      </div>
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
