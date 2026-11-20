import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { checkTyping } from '../../core/sentences';
import { formatDuration, nextResetAt } from '../../core/time';
import { parseBlockedParams } from '../../shared/blocked-url';
import { send, type ChallengeInfo } from '../../shared/messages';
import { getSettings } from '../../storage';
import { Wordmark } from '../../ui/components';
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
  'Send a message to someone you haven’t talked to in a while.',
  'Take a ten-minute walk without your phone.',
  'Do five minutes of the thing you’ve been putting off.',
  'Read a few pages of a book.',
  'Close your eyes and take ten slow breaths.',
];

function opensAt(resetHour: number): string {
  return resetHour === 0 ? 'midnight' : `${String(resetHour).padStart(2, '0')}:00`;
}

function BlockedPage() {
  useTheme();
  const { limitId, original } = useMemo(() => parseBlockedParams(location.search), []);
  const [info, setInfo] = useState<ChallengeInfo | null | undefined>(undefined);
  const [resetHour, setResetHour] = useState(0);
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
      send({ type: 'overstay:challenge', limitId }),
      getSettings(),
    ]);
    setInfo(res);
    setResetHour(settings.resetHour);
    // The block may already be over (grace running, day reset or limit raised).
    if (res && !res.stillBlocked && original) goBack();
  };

  useEffect(() => {
    void load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.title = info ? `${info.limitName} is closed for today` : 'Closed for today';
  }, [info]);

  // Anti-paste: native listeners see the real `inputType` and `isTrusted`.
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
      <main class="closed">
        <div class="closed-inner enter">
          <Wordmark size={18} />
          <h1>This site was closed by a limit that no longer exists.</h1>
          {original && (
            <div>
              <button class="btn solid" onClick={goBack}>
                Continue to the site
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  const progress = info.text ? checkTyping(info.text, typed) : null;
  const target = info.text ?? '';
  const correct = progress?.correct ?? 0;
  const errorAt = progress?.hasError ? correct : -1;
  const over = info.usedMs - info.dailyMs;
  const resetsIn = nextResetAt(now, resetHour) - now;

  const submit = async () => {
    if (!progress?.complete || busy) return;
    setBusy(true);
    const res = await send({ type: 'overstay:unlock', limitId: info.limitId, typed });
    setBusy(false);
    if (res.ok) {
      if (original) location.replace(original);
      else setNotice(`Open for ${formatDuration(info.graceMs)}.`);
    } else if (res.reason === 'mismatch') {
      setNotice('That isn’t quite it. Check capitals and punctuation.');
    } else {
      await load();
    }
  };

  return (
    <main class="closed">
      <div class="closed-inner">
        <div class="enter">
          <Wordmark size={18} />
        </div>

        <section class="stack enter" style={{ gap: 16 }}>
          <h1>
            You’ve overstayed on <em>{info.limitName}</em>.
          </h1>
          <p class="closed-facts">
            {info.dailyMs === 0
              ? `You decided to keep ${info.limitName} closed today.`
              : `${formatDuration(info.usedMs)} today, against the ${formatDuration(info.dailyMs)} you gave yourself${
                  over >= 60_000 ? ` — ${formatDuration(over)} over` : ''
                }.`}{' '}
            It opens again at {opensAt(resetHour)}, in {formatDuration(resetsIn)}.
          </p>
        </section>

        <section class="idea enter-2" aria-label="A suggestion">
          <span class="label">Maybe instead</span>
          <p>{idea}</p>
        </section>

        <div class="row wrap enter-2" style={{ gap: 18 }}>
          <button class="btn solid" onClick={() => window.close()}>
            Close this tab
          </button>
          <button class="btn link" onClick={() => void browser.runtime.openOptionsPage()}>
            See today’s time
          </button>
        </div>

        <hr class="rule enter-3" />

        {info.strict ? (
          <p class="small muted enter-3">
            Strict mode is on, so there’s no way around this one. Tomorrow-you says thanks.
          </p>
        ) : !open ? (
          <div class="enter-3 stack" style={{ gap: 6 }}>
            <button
              class="btn link"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setOpen(true)}
              data-testid="open-challenge"
            >
              I still want in…
            </button>
            {info.level > 1 && (
              <span class="small faint">
                You’ve already let yourself back in {info.level - 1}× today.
              </span>
            )}
          </div>
        ) : (
          <section class="challenge enter" aria-label="Typing challenge">
            <p class="small muted">
              Type {info.level > 1 ? `these ${info.level} sentences` : 'this'} exactly to open{' '}
              {info.limitName} for {formatDuration(info.graceMs)}.
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
              rows={3}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              data-gramm="false"
              placeholder="Start typing…"
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
            <div class="spread wrap" style={{ alignItems: 'center' }}>
              <span
                class={`small num ${notice || progress?.hasError ? 'over' : 'faint'}`}
                aria-live="polite"
              >
                {notice ??
                  (progress?.hasError
                    ? 'A typo — fix the marked letter to carry on.'
                    : `${Math.min(correct, target.length)} of ${target.length} characters`)}
              </span>
              <button
                class="btn clay"
                disabled={!progress?.complete || busy}
                onClick={() => void submit()}
                data-testid="unlock"
              >
                Let me in for {formatDuration(info.graceMs)}
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

render(<BlockedPage />, document.getElementById('app')!);
