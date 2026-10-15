import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { InputState } from '../game/bridge';
import { content } from '../content/apology';

type Dir = 'left' | 'right';

/**
 * Three large touch buttons: ← ↑ →.
 * Pointer events (not click) so press-and-hold works on touch, pen and mouse.
 * Each button captures its pointer, so sliding a finger off it doesn't
 * cancel the press; several fingers (e.g. hold → and tap ↑) work together.
 */
export function TouchControls({ input }: { input: InputState }) {
  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-group touch-group--move">
        <HoldButton dir="left" input={input} />
        <HoldButton dir="right" input={input} />
      </div>
      <div className="touch-group touch-group--jump">
        <JumpButton input={input} />
      </div>
    </div>
  );
}

function usePointerSet(onChange: (active: boolean) => void) {
  const pointers = useRef(new Set<number>());
  const [pressed, setPressed] = useState(false);

  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers throw for synthetic pointers; harmless */
    }
    const wasEmpty = pointers.current.size === 0;
    pointers.current.add(e.pointerId);
    if (wasEmpty) {
      setPressed(true);
      onChange(true);
    }
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pointers.current.delete(e.pointerId)) return;
    if (pointers.current.size === 0) {
      setPressed(false);
      onChange(false);
    }
  };
  return {
    pressed,
    handlers: {
      onPointerDown: down,
      onPointerUp: up,
      onPointerCancel: up,
      onLostPointerCapture: up,
    },
  };
}

function HoldButton({ dir, input }: { dir: Dir; input: InputState }) {
  const { pressed, handlers } = usePointerSet((active) => {
    input[dir] = active;
    input.touch();
  });
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`touch-btn${pressed ? ' is-pressed' : ''}`}
      aria-label={dir === 'left' ? content.controls.left : content.controls.right}
      {...handlers}
    >
      <ArrowIcon rotate={dir === 'left' ? 180 : 0} />
    </button>
  );
}

function JumpButton({ input }: { input: InputState }) {
  const { pressed, handlers } = usePointerSet((active) => {
    if (active) input.pressJump();
  });
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`touch-btn touch-btn--jump${pressed ? ' is-pressed' : ''}`}
      aria-label={content.controls.jump}
      {...handlers}
    >
      <ArrowIcon rotate={-90} />
    </button>
  );
}

function ArrowIcon({ rotate }: { rotate: number }) {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path
        d="M5 12h12.5M12.5 6.5 18 12l-5.5 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small static icons used on the intro screen to show the controls. */
export function ControlsPreview() {
  return (
    <div className="controls-preview" aria-hidden="true">
      <span className="controls-preview__key">
        <ArrowIcon rotate={180} />
      </span>
      <span className="controls-preview__key">
        <ArrowIcon rotate={-90} />
      </span>
      <span className="controls-preview__key">
        <ArrowIcon rotate={0} />
      </span>
    </div>
  );
}
