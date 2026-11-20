import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { checkTyping } from '../../core/sentences';
import { formatDuration, nextResetAt } from '../../core/time';
import { parseBlockedParams } from '../../shared/blocked-url';
import { send, type ChallengeInfo } from '../../shared/messages';
import { getSettings } from '../../storage';
import { Logo } from '../../ui/components';
import { useTheme } from '../../ui/hooks';
import '../../ui/styles.css';
import './blocked.css';

/** Input types that would let someone skip the typing. */
const REJECTED_INPUT = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
  'insertReplacementText',
]);

const IDEAS = [
  'Stand up, stretch, and drink a glass of water.',
  'Send a message to someone you have not talked to in a while.',
  'Take a ten minute walk without your phone.',
  'Pick the one task you have been avoiding and do five minutes of it.',
  'Read a few pages of a book.',
  'Close your eyes and take ten slow breaths.',
];

function BlockedPage() {
  useTheme();
  const { limitId, original } = useMemo(() => parseBlockedParams(location.search), []);
  const [info, setInfo] = useState<ChallengeInfo | null | undefined>(undefined);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const idea = useMemo(() => IDEAS[Math.floor(Math.random() * IDEAS.length)]!, []);

  const goBack = () => {
    if (original) location.replace(original);
  };

  const load = async () => {
    if (!limitId) {
      setInfo(null);
      return;
    }
    const [res, settings] = await Promise.all([
      send({ type: 'dwell:challenge', limitId }),
      getSettings(),
    ]);
    setInfo(res);
    setResetAt(nextResetAt(Date.now(), settings.resetHour));
    // The block may already be over (grace running, day reset or limit raised).
    if (res && !res.stillBlocked && original) goBack();
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = info ? `${info.limitName} is blocked — Dwell` : 'Blocked — Dwell';
  }, [info]);

  // Anti-paste: attach native listeners so we see the real `inputType` and `isTrusted`.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const reject = (e: Event, message: string) => {
      e.preventDefault();
      e.stopPropagation();
      setNotice(message);
    };
    const onBeforeInput = (e: InputEvent) => {
      if (!e.isTrusted) return reject(e, 'Only real typing counts.');
      if (REJECTED_INPUT.has(e.inputType))
        return reject(e, 'Nice try. Pasting does not count — type it.');
      if (e.inputType === 'insertText' && (e.data?.length ?? 0) > 3 && !e.isComposing)
        return reject(e, 'Type it out, letter by letter.');
    };
    const onPaste = (e: Event) => reject(e, 'Nice try. Pasting does not count — type it.');
    const onDrop = (e: Event) => reject(e, 'Dropping text does not count — type it.');
    el.addEventListener('beforeinput', onBeforeInput);
    el.addEventListener('paste', onPaste);
    el.addEventListener('drop', onDrop);
    el.focus();
    return () => {
      el.removeEventListener('beforeinput', onBeforeInput);
      el.removeEventListener('paste', onPaste);
      el.removeEventListener('drop', onDrop);
    };
  }, [open]);

  if (info === undefined) return null;

  if (info === null) {
    return (
      <main class="blocked">
        <div class="blocked-card card stack">
          <h1>This site is blocked</h1>
          <p class="muted">The limit that blocked this page no longer exists.</p>
          {original && (
            <button class="btn primary" onClick={goBack}>
              Continue
            </button>
          )}
        </div>
      </main>
    );
  }

  const progress = info.text ? checkTyping(info.text, typed) : null;

  const submit = async () => {
    if (!progress?.complete || busy) return;
    setBusy(true);
    const res = await send({ type: 'dwell:unlock', limitId: info.limitId, typed });
    setBusy(false);
    if (res.ok) {
      if (original) location.replace(original);
      else setNotice(`Unlocked for ${formatDuration(info.graceMs)}.`);
    } else if (res.reason === 'mismatch') {
      setNotice('That does not match exactly. Check punctuation and capital letters.');
    } else {
      await load();
    }
  };

  const target = info.text ?? '';
  const correct = progress?.correct ?? 0;
  const errorAt = progress?.hasError ? correct : -1;

  return (
    <main class="blocked">
      <div class="blocked-card card stack" style={{ gap: 20 }}>
        <div class="row">
          <Logo size={28} />
          <span class="subtle">Dwell</span>
        </div>
        <div class="stack" style={{ gap: 8 }}>
          <h1>Time's up for {info.limitName} today.</h1>
          <p class="muted">
            You set a limit of <strong>{formatDuration(info.dailyMs)}</strong> and have spent{' '}
            <strong>{formatDuration(info.usedMs)}</strong>.
            {resetAt && <> It resets in {formatDuration(resetAt - now)}.</>}
          </p>
        </div>

        <div class="idea">
          <span class="subtle">Instead, try this</span>
          <p>{idea}</p>
        </div>

        {info.strict ? (
          <p class="muted">
            Strict mode is on, so there is no way around this block. Your future self says thank
            you.
          </p>
        ) : !open ? (
          <div class="spread wrap">
            <button class="btn ghost" onClick={() => setOpen(true)} data-testid="open-challenge">
              I really need to get in…
            </button>
            {info.level > 1 && (
              <span class="subtle">You already gave in {info.level - 1}× today.</span>
            )}
          </div>
        ) : (
          <div class="stack challenge">
            <p class="muted">
              Type the {info.level > 1 ? `${info.level} sentences` : 'sentence'} below exactly to
              unlock {info.limitName} for {formatDuration(info.graceMs)}.
              {info.level > 1 && ' It gets longer every time you give in today.'}
            </p>
            <p class="target" aria-label="Sentence to type" data-testid="challenge-text">
              <span class="done">{target.slice(0, correct)}</span>
              {errorAt >= 0 && <span class="wrong">{target.charAt(errorAt) || ' '}</span>}
              <span class="todo">{target.slice(errorAt >= 0 ? errorAt + 1 : correct)}</span>
            </p>
            <label class="sr-only" for="typing">
              Type the sentence
            </label>
            <textarea
              id="typing"
              ref={inputRef}
              value={typed}
              rows={4}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              data-gramm="false"
              class={progress?.hasError ? 'has-error' : ''}
              onInput={(e) => {
                setTyped(e.currentTarget.value);
                setNotice(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submit();
                }
              }}
              data-testid="challenge-input"
            />
            <div class="spread wrap">
              <span class="subtle tabular" aria-live="polite">
                {notice ??
                  (progress?.hasError
                    ? 'Typo — fix the red letter to continue.'
                    : `${Math.min(correct, target.length)} / ${target.length} characters`)}
              </span>
              <button
                class="btn danger solid"
                disabled={!progress?.complete || busy}
                onClick={() => void submit()}
                data-testid="unlock"
              >
                Unlock for {formatDuration(info.graceMs)}
              </button>
            </div>
          </div>
        )}

        <div class="row wrap" style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <button class="btn" onClick={() => window.close()}>
            Close this tab
          </button>
          <button class="btn ghost" onClick={() => void browser.runtime.openOptionsPage()}>
            Open dashboard
          </button>
        </div>
      </div>
    </main>
  );
}

render(<BlockedPage />, document.getElementById('app')!);
