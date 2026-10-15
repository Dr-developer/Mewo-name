/**
 * The game's explicit state machine (React side).
 *
 *   intro ──START──▶ playing ──COLLECT──▶ fragment ──CONTINUE──▶ playing
 *                       │
 *                       └──REACH_DOOR (only when 4/4)──▶ ending
 *   ending ──ENDING_DONE──▶ letter ◀──REOPEN_LETTER── afterLetter
 *                            └──CLOSE_LETTER──────────▶ afterLetter
 *   any ──RESTART──▶ intro
 *
 * Phaser owns physics/positions; React owns which screen is showing.
 * Touch controls are visible only in `playing`.
 */
import { FRAGMENT_COUNT } from '../content/apology';

export type Phase = 'intro' | 'playing' | 'fragment' | 'ending' | 'letter' | 'afterLetter';

export interface GameState {
  phase: Phase;
  /** Indexes (0-based) of collected fragments, in collection order. */
  collected: number[];
  /** Fragment currently shown in the dialog (only meaningful in `fragment`). */
  openFragment: number | null;
  /** Increments every restart — used as a React key to remount cleanly. */
  runId: number;
  /** Increments every time the letter is (re)opened — replays its reveal. */
  letterViews: number;
}

export type GameAction =
  | { type: 'START' }
  | { type: 'COLLECT'; index: number }
  | { type: 'CONTINUE' }
  | { type: 'REACH_DOOR' }
  | { type: 'ENDING_DONE' }
  | { type: 'CLOSE_LETTER' }
  | { type: 'REOPEN_LETTER' }
  | { type: 'RESTART' };

export const initialGameState: GameState = {
  phase: 'intro',
  collected: [],
  openFragment: null,
  runId: 0,
  letterViews: 0,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return state.phase === 'intro' ? { ...state, phase: 'playing' } : state;

    case 'COLLECT': {
      // Ignore duplicates and anything outside active play: each piece is
      // shown exactly once per collection.
      if (state.phase !== 'playing') return state;
      if (action.index < 0 || action.index >= FRAGMENT_COUNT) return state;
      if (state.collected.includes(action.index)) return state;
      return {
        ...state,
        phase: 'fragment',
        collected: [...state.collected, action.index],
        openFragment: action.index,
      };
    }

    case 'CONTINUE':
      return state.phase === 'fragment' ? { ...state, phase: 'playing', openFragment: null } : state;

    case 'REACH_DOOR':
      // Guard: the ending can never start before every piece is collected.
      if (state.phase !== 'playing' || state.collected.length < FRAGMENT_COUNT) return state;
      return { ...state, phase: 'ending' };

    case 'ENDING_DONE':
      return state.phase === 'ending'
        ? { ...state, phase: 'letter', letterViews: state.letterViews + 1 }
        : state;

    case 'CLOSE_LETTER':
      return state.phase === 'letter' ? { ...state, phase: 'afterLetter' } : state;

    case 'REOPEN_LETTER':
      // "دوباره بخون" — reopen / replay the letter. Never resets progress.
      return state.phase === 'letter' || state.phase === 'afterLetter'
        ? { ...state, phase: 'letter', letterViews: state.letterViews + 1 }
        : state;

    case 'RESTART':
      return { ...initialGameState, runId: state.runId + 1 };

    default:
      return state;
  }
}
