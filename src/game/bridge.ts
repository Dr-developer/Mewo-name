/**
 * A tiny typed event bus between React (overlays, touch buttons) and the
 * Phaser scene. One instance per mounted game; the scene unsubscribes on
 * shutdown so restarts never stack duplicate listeners.
 */

/** Events the scene sends to React. */
export interface SceneEvents {
  collect: { index: number };
  doorReached: void;
  doorLocked: { remaining: number };
  endingDone: void;
  hint: { kind: 'findNext' | 'goToDoor' | 'windy' } | null;
}

/** Commands React sends to the scene. */
export interface SceneCommands {
  /** Begin play (from intro) or resume after a dialog. */
  resume: void;
  /** Freeze gameplay and release any held input. */
  pause: void;
  /** Re-frame the camera (screen layout changed). */
  relayout: void;
}

type Handler<T> = (payload: T) => void;
type AnyMap = object;

class Emitter<M extends AnyMap> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof M>(event: K, ...payload: M[K] extends void ? [] : [M[K]]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of [...set]) (h as Handler<M[K] | undefined>)(payload[0]);
  }

  clear(): void {
    this.handlers.clear();
  }
}

/**
 * Shared, mutable input state. Touch buttons write it, keyboard (internal,
 * desktop convenience) writes it too, and the scene reads it every frame.
 */
export class InputState {
  left = false;
  right = false;
  /** Timestamp (performance.now) of the latest jump press; consumed by the scene. */
  jumpPressedAt = -Infinity;
  /** Any input since this time resets the idle-hint timer. */
  lastInputAt = performance.now();

  pressJump(): void {
    this.jumpPressedAt = performance.now();
    this.touch();
  }

  touch(): void {
    this.lastInputAt = performance.now();
  }

  reset(): void {
    this.left = false;
    this.right = false;
    this.jumpPressedAt = -Infinity;
  }
}

export class GameBridge {
  readonly toReact = new Emitter<SceneEvents>();
  readonly toScene = new Emitter<SceneCommands>();
  readonly input = new InputState();
  /**
   * Screen facts the scene needs for framing the camera:
   * device pixel ratio used for the canvas, and how many CSS px at the
   * bottom are reserved for the touch controls.
   */
  layout = { dpr: 1, reserveCss: 150 };
  /** Set when React asked for play before the scene finished booting. */
  playRequested = false;

  requestPlay(): void {
    this.playRequested = true;
    this.toScene.emit('resume');
  }

  destroy(): void {
    this.toReact.clear();
    this.toScene.clear();
    this.input.reset();
  }
}
