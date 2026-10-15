import { useEffect, useRef } from 'react';
import { content, FRAGMENT_COUNT } from '../content/apology';
import { ControlsPreview } from './TouchControls';

/** Persian digits: 3 → «۳». */
export const fa = (n: number) => n.toLocaleString('fa-IR');
const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');

// ───────────────────────── Intro ─────────────────────────

export function IntroOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="overlay overlay--intro" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="card card--intro scrollable">
        <Envelope />
        <h1 id="intro-title" className="intro-title">
          {content.title}
        </h1>
        <p className="intro-lines">
          {content.intro.lines.map((line, i) => (
            <span key={i} className="intro-line" style={{ animationDelay: `${300 + i * 700}ms` }}>
              {line}
            </span>
          ))}
        </p>
        <ControlsPreview />
        <p className="intro-instruction">{content.intro.instruction}</p>
        <button type="button" className="btn btn--primary" onClick={onStart} autoFocus>
          {content.intro.startButton}
        </button>
      </div>
    </div>
  );
}

function Envelope() {
  return (
    <svg className="intro-envelope" viewBox="0 0 64 44" aria-hidden="true">
      <rect x="3" y="3" width="58" height="38" rx="5" fill="#FFF8EE" stroke="#B9857F" strokeWidth="2.4" />
      <path d="M4 6 L32 25 L60 6" fill="none" stroke="#B9857F" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="32" cy="26" r="5" fill="#D68C9A" />
    </svg>
  );
}

// ───────────────────────── HUD ─────────────────────────

export function ProgressHud({ collected }: { collected: number }) {
  const label = fill(content.hud.progress, { n: fa(collected), total: fa(FRAGMENT_COUNT) });
  return (
    <div className="hud" role="status" aria-label={`${content.hud.progressAria}: ${label}`}>
      <div className="hud-pieces" aria-hidden="true">
        {Array.from({ length: FRAGMENT_COUNT }, (_, i) => (
          <span key={i} className={`hud-piece${i < collected ? ' is-found' : ''}`} />
        ))}
      </div>
      <span className="hud-count">{label}</span>
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  return (
    <div className={`toast${text ? ' is-visible' : ''}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

// ───────────────────────── Fragment dialog ─────────────────────────

export function FragmentDialog({ index, collected, onContinue }: { index: number; collected: number; onContinue: () => void }) {
  return (
    <div className="overlay overlay--dim" role="dialog" aria-modal="true" aria-labelledby="fragment-heading">
      <div className="card card--fragment scrollable">
        <p id="fragment-heading" className="fragment-heading">
          {fill(content.fragmentDialog.heading, { n: fa(index + 1) })}
        </p>
        <div className="paper paper--piece">
          <p className="fragment-text">{content.fragments[index]}</p>
        </div>
        <div className="dots" aria-hidden="true">
          {Array.from({ length: FRAGMENT_COUNT }, (_, i) => (
            <span key={i} className={`dot${i < collected ? ' is-on' : ''}`} />
          ))}
        </div>
        <button type="button" className="btn btn--primary" onClick={onContinue} autoFocus>
          {content.fragmentDialog.continueButton}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Final letter ─────────────────────────

export function FinalLetter({
  views,
  onReread,
  onRestart,
  onClose,
}: {
  views: number;
  onReread: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const L = content.finalLetter;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [views]);

  useEffect(() => {
    if (L.isPlaceholder) {
      console.warn('[letter] The final letter still uses placeholder text — edit src/content/apology.ts before publishing.');
    }
  }, [L.isPlaceholder]);

  // Build the lines of the letter (each fades in, one after another).
  const blocks: Array<{ text: string; cls: string }> = [{ text: L.greeting, cls: 'letter-greeting' }];
  if (L.includeFragments) blocks.push({ text: content.fragments.join(' '), cls: 'letter-p letter-p--pieces' });
  L.paragraphs.forEach((p) => blocks.push({ text: p, cls: 'letter-p' }));
  blocks.push({ text: L.signOff, cls: 'letter-signoff' });
  blocks.push({ text: L.signature, cls: 'letter-signature' });

  return (
    <div className="overlay overlay--letter" role="dialog" aria-modal="true" aria-labelledby="letter-heading">
      <div className="letter-scroll scrollable" ref={scrollRef}>
        <article className="paper paper--letter" key={views}>
          <button type="button" className="icon-btn letter-close" onClick={onClose} aria-label={content.buttons.closeLetter}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          {import.meta.env.DEV && L.isPlaceholder && <p className="placeholder-badge">{content.placeholderBadge}</p>}
          <h2 id="letter-heading" className="letter-heading">
            {L.heading}
          </h2>
          {blocks.map((b, i) => (
            <p key={i} className={`${b.cls} reveal`} style={{ animationDelay: `${250 + i * 420}ms` }}>
              {b.text}
            </p>
          ))}
        </article>
        <div className="letter-actions">
          <button type="button" className="btn btn--primary" onClick={onReread} autoFocus>
            {content.buttons.reread}
          </button>
          {content.buttons.restart && (
            <button type="button" className="btn btn--ghost" onClick={onRestart}>
              {content.buttons.restart}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Shown after the letter is closed: the cat sits by the door; reopen anytime. */
export function AfterLetterBar({ onReread, onRestart }: { onReread: () => void; onRestart: () => void }) {
  return (
    <div className="after-bar">
      <button type="button" className="btn btn--primary" onClick={onReread} autoFocus>
        {content.buttons.reread}
      </button>
      {content.buttons.restart && (
        <button type="button" className="btn btn--ghost btn--on-scene" onClick={onRestart}>
          {content.buttons.restart}
        </button>
      )}
    </div>
  );
}
