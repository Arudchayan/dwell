import { useState } from 'preact/hooks';
import { ImportError, parseImport, toCsv } from '../../../core/schema';
import { clearAll, exportAll, importAll } from '../../../storage';

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

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DataView() {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const exportJson = async () => {
    const bundle = await exportAll();
    download(
      `overstay-backup-${stamp()}.json`,
      JSON.stringify(bundle, null, 2),
      'application/json',
    );
  };

  const exportCsv = async () => {
    const bundle = await exportAll();
    download(`overstay-usage-${stamp()}.csv`, toCsv(bundle.usage), 'text/csv');
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const bundle = parseImport(await file.text());
      const days = Object.keys(bundle.usage).length;
      if (
        !confirm(
          `Replace ALL current data with this backup (${days} days of history, ${bundle.limits.length} limits)?`,
        )
      )
        return;
      await importAll(bundle);
      setMessage({
        kind: 'ok',
        text: `Imported ${days} days of history and ${bundle.limits.length} limits.`,
      });
    } catch (e) {
      setMessage({
        kind: 'error',
        text: e instanceof ImportError ? e.message : 'Could not read that file.',
      });
    }
  };

  const wipe = async () => {
    await clearAll();
    setConfirmText('');
    setMessage({ kind: 'ok', text: 'All data deleted.' });
  };

  return (
    <div class="stack" style={{ gap: 16 }}>
      <div class="page-head">
        <div>
          <h1>Your data</h1>
          <p class="muted">
            Everything Overstay knows is stored in this browser only. It never leaves your device
            unless you export it.
          </p>
        </div>
      </div>

      {message && (
        <p
          class={`card ${message.kind === 'error' ? 'input-error' : ''}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
          data-testid="data-message"
        >
          {message.text}
        </p>
      )}

      <section class="card stack">
        <h2>Export</h2>
        <p class="muted">
          The JSON backup contains settings, limits and history, and can be imported again. The CSV
          has seconds per site per hour, for spreadsheets.
        </p>
        <div class="row wrap">
          <button class="btn primary" onClick={() => void exportJson()}>
            Download backup (JSON)
          </button>
          <button class="btn" onClick={() => void exportCsv()}>
            Download history (CSV)
          </button>
        </div>
      </section>

      <section class="card stack">
        <h2>Import</h2>
        <p class="muted">Restore an Overstay backup. This replaces everything currently stored.</p>
        <label class="btn" style={{ alignSelf: 'flex-start' }}>
          Choose backup file…
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
      </section>

      <section class="card stack" style={{ borderColor: 'var(--danger)' }}>
        <h2>Delete everything</h2>
        <p class="muted">
          Permanently erase all history, limits and settings. This cannot be undone. Type{' '}
          <strong>delete</strong> to confirm.
        </p>
        <div class="row wrap">
          <label class="sr-only" for="confirm-delete">
            Type delete to confirm
          </label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onInput={(e) => setConfirmText(e.currentTarget.value)}
            style={{ maxWidth: 200 }}
            autocomplete="off"
          />
          <button
            class="btn danger solid"
            disabled={confirmText.trim().toLowerCase() !== 'delete'}
            onClick={() => void wipe()}
          >
            Delete all data
          </button>
        </div>
      </section>
    </div>
  );
}
