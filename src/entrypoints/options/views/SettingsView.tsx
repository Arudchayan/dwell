import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { parseDomainList } from '../../../core/domain';
import { ImportError, parseImport, toCsv } from '../../../core/schema';
import { BASE_SENTENCES } from '../../../core/sentences';
import type { Settings } from '../../../core/types';
import { clearAll, exportAll, getSettings, importAll, saveSettings } from '../../../storage';
import { Chips, Toggle } from '../../../ui/components';

function Group({
  title,
  description,
  id,
  children,
}: {
  title: string;
  description?: string;
  id?: string;
  children: ComponentChildren;
}) {
  return (
    <section class="setting-group" id={id} aria-label={title}>
      <div>
        <h2>{title}</h2>
        {description && <p class="small muted">{description}</p>}
      </div>
      <div class="controls">{children}</div>
    </section>
  );
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

function DataControls({ onMessage }: { onMessage: (m: string, error?: boolean) => void }) {
  const [confirmText, setConfirmText] = useState('');

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const bundle = parseImport(await file.text());
      const days = Object.keys(bundle.usage).length;
      if (
        !confirm(
          `Replace everything with this backup (${days} days of history, ${bundle.limits.length} limits)?`,
        )
      )
        return;
      await importAll(bundle);
      onMessage(`Restored ${days} days of history and ${bundle.limits.length} limits.`);
    } catch (e) {
      onMessage(e instanceof ImportError ? e.message : 'That file couldn’t be read.', true);
    }
  };

  return (
    <>
      <div class="stack" style={{ gap: 8 }}>
        <span class="field-label">Take a copy</span>
        <div class="row wrap">
          <button
            class="btn"
            onClick={async () => {
              const b = await exportAll();
              download(
                `overstay-backup-${stamp()}.json`,
                JSON.stringify(b, null, 2),
                'application/json',
              );
            }}
          >
            Download backup (JSON)
          </button>
          <button
            class="btn"
            onClick={async () => {
              const b = await exportAll();
              download(`overstay-history-${stamp()}.csv`, toCsv(b.usage), 'text/csv');
            }}
          >
            History as CSV
          </button>
        </div>
        <span class="hint">
          The backup holds settings, limits and history and can be restored here.
        </span>
      </div>

      <div class="stack" style={{ gap: 8 }}>
        <span class="field-label">Restore a backup</span>
        <label class="btn" style={{ alignSelf: 'flex-start' }}>
          Choose a file…
          <input
            type="file"
            accept="application/json,.json"
            class="sr-only"
            data-testid="import-file"
            onChange={(e) => {
              void onImport(e.currentTarget.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
        </label>
        <span class="hint">Replaces everything currently stored.</span>
      </div>

      <div class="stack" style={{ gap: 8 }}>
        <span class="field-label">Erase everything</span>
        <span class="hint">
          Deletes all history, limits and settings from this browser. It can’t be undone. Type{' '}
          <strong>delete</strong> to confirm.
        </span>
        <div class="row">
          <label class="sr-only" for="confirm-delete">
            Type delete to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onInput={(e) => setConfirmText(e.currentTarget.value)}
            style={{ maxWidth: 160 }}
            autocomplete="off"
          />
          <button
            class="btn danger"
            disabled={confirmText.trim().toLowerCase() !== 'delete'}
            onClick={async () => {
              await clearAll();
              setConfirmText('');
              onMessage('All data deleted.');
            }}
          >
            Delete all data
          </button>
        </div>
      </div>
    </>
  );
}

export function SettingsView() {
  const [s, setS] = useState<Settings>();
  const [ignored, setIgnored] = useState('');
  const [ignoredError, setIgnoredError] = useState<string | null>(null);
  const [sentences, setSentences] = useState('');
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    void getSettings().then((v) => {
      setS(v);
      setIgnored(v.ignoredDomains.join('\n'));
      setSentences(v.customSentences.join('\n'));
    });
  }, []);

  useEffect(() => {
    if (!toast || toast.error) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  if (!s) return null;

  const update = async (patch: Partial<Settings>) => {
    setS(await saveSettings(patch));
    setToast({ text: 'Saved' });
  };

  const message = (text: string, error = false) => {
    setToast({ text, error });
    void getSettings().then(setS);
  };

  return (
    <>
      <section class="lede enter">
        <h1>
          Settings, <em>quietly saved.</em>
        </h1>
        <p>Every change takes effect straight away.</p>
      </section>

      <Group title="When time runs out" description="What happens at a closed site.">
        <Toggle
          checked={s.strictMode}
          onChange={(strictMode) => void update({ strictMode })}
          label="Strict mode"
          description="No way back in until the day resets. No sentences, no exceptions."
        />
        <div class="stack" style={{ gap: 8, opacity: s.strictMode ? 0.5 : 1 }}>
          <span class="field-label">After typing the sentence, let me in for</span>
          <Chips
            label="Grace period"
            value={s.graceMinutes}
            options={[1, 3, 5, 10, 15].map((m) => ({ value: m, label: `${m} min` }))}
            onChange={(graceMinutes) => !s.strictMode && void update({ graceMinutes })}
          />
        </div>
        <label class="field">
          <span>Sentences of your own</span>
          <textarea
            rows={3}
            value={sentences}
            placeholder={BASE_SENTENCES[0]}
            onInput={(e) => setSentences(e.currentTarget.value)}
            onBlur={() => void update({ customSentences: sentences.split('\n') })}
          />
          <span class="hint">
            One per line. They’re mixed in with the built-in ones. Write {'{site}'} where the site’s
            name should go.
          </span>
        </label>
      </Group>

      <Group title="Counting time" description="What counts as time spent on a site.">
        <div class="stack" style={{ gap: 8 }}>
          <span class="field-label">Pause when I’ve been away for</span>
          <Chips
            label="Idle threshold"
            value={s.idleSeconds}
            options={[
              { value: 30, label: '30 sec' },
              { value: 60, label: '1 min' },
              { value: 120, label: '2 min' },
              { value: 300, label: '5 min' },
            ]}
            onChange={(idleSeconds) => void update({ idleSeconds })}
          />
        </div>
        <Toggle
          checked={s.countAudibleWhenIdle}
          onChange={(countAudibleWhenIdle) => void update({ countAudibleWhenIdle })}
          label="Keep counting while a tab plays sound"
          description="Videos and calls count even when you’re not touching the keyboard."
        />
        <label class="field">
          <span>Never count these sites</span>
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
              if (invalid.length) setIgnoredError(`Left out: ${invalid.join(', ')}`);
              setIgnored(valid.join('\n'));
              void update({ ignoredDomains: valid });
            }}
          />
          {ignoredError && <span class="error-text">{ignoredError}</span>}
        </label>
      </Group>

      <Group title="Your day">
        <label class="field" style={{ maxWidth: 240 }}>
          <span>A new day starts at</span>
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
          <span class="hint">Up late? 04:00 keeps late nights with the day before.</span>
        </label>
        <Toggle
          checked={s.notifications}
          onChange={(notifications) => void update({ notifications })}
          label="Gentle warnings"
          description="A notification at 80% of a limit, with 5 minutes left, and when a site closes."
        />
        <div class="stack" style={{ gap: 8 }}>
          <span class="field-label">Appearance</span>
          <Chips
            label="Theme"
            value={s.theme}
            options={[
              { value: 'system', label: 'Match system' },
              { value: 'light', label: 'Paper' },
              { value: 'dark', label: 'Night' },
            ]}
            onChange={(theme) => void update({ theme })}
          />
        </div>
      </Group>

      <Group
        id="data"
        title="Your data"
        description="Everything Overstay knows lives in this browser and never leaves it."
      >
        <label class="field" style={{ maxWidth: 240 }}>
          <span>Keep history for</span>
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
        <DataControls onMessage={message} />
      </Group>

      {toast && (
        <div
          class="toast"
          role={toast.error ? 'alert' : 'status'}
          data-testid="data-message"
          onClick={() => setToast(null)}
          style={toast.error ? { background: 'var(--clay)' } : undefined}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}
