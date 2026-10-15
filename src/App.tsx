import { useCallback, useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { content } from './content/apology';
import { GameBridge, type SceneEvents } from './game/bridge';
import { GameCanvas } from './game/GameCanvas';
import { gameReducer, initialGameState, type GameAction, type GameState } from './game/gameState';
import { TouchControls } from './components/TouchControls';
import { AfterLetterBar, FinalLetter, FragmentDialog, IntroOverlay, ProgressHud, Toast } from './components/Overlays';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);

  useEffect(() => {
    document.title = content.title;
  }, []);

  // A new runId remounts the whole session → a fresh Phaser game, no leftovers.
  return <GameSession key={state.runId} state={state} dispatch={dispatch} />;
}

function GameSession({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  const [bridge] = useState(() => new GameBridge());
  const [hint, setHint] = useState<SceneEvents['hint']>(null);
  const [doorNote, setDoorNote] = useState(false);
  const doorTimer = useRef<number | undefined>(undefined);

  // Scene → React
  useEffect(() => {
    const offs = [
      bridge.toReact.on('collect', ({ index }) => dispatch({ type: 'COLLECT', index })),
      bridge.toReact.on('doorReached', () => dispatch({ type: 'REACH_DOOR' })),
      bridge.toReact.on('endingDone', () => dispatch({ type: 'ENDING_DONE' })),
      bridge.toReact.on('hint', (h) => setHint(h)),
      bridge.toReact.on('doorLocked', () => {
        setDoorNote(true);
        window.clearTimeout(doorTimer.current);
        doorTimer.current = window.setTimeout(() => setDoorNote(false), 3200);
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      window.clearTimeout(doorTimer.current);
    };
  }, [bridge, dispatch]);

  // React → Scene: play only in the `playing` phase; otherwise release input.
  useEffect(() => {
    if (state.phase === 'playing') {
      bridge.requestPlay();
    } else {
      bridge.input.reset();
      bridge.toScene.emit('pause');
      setHint(null);
    }
  }, [state.phase, bridge]);

  const start = useCallback(() => dispatch({ type: 'START' }), [dispatch]);
  const cont = useCallback(() => dispatch({ type: 'CONTINUE' }), [dispatch]);
  const reread = useCallback(() => dispatch({ type: 'REOPEN_LETTER' }), [dispatch]);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [dispatch]);
  const close = useCallback(() => dispatch({ type: 'CLOSE_LETTER' }), [dispatch]);

  const { phase, collected } = state;
  const showHud = phase === 'playing' || phase === 'fragment';
  const toastText = doorNote && phase === 'playing' ? content.hints.doorNotYet : hint ? content.hints[hint.kind] : null;

  return (
    <div className={`app phase-${phase}`}>
      <GameCanvas bridge={bridge} />

      {showHud && <ProgressHud collected={collected.length} />}
      {phase === 'playing' && <Toast text={toastText} />}

      {phase === 'playing' && <TouchControls input={bridge.input} />}

      {phase === 'intro' && <IntroOverlay onStart={start} />}
      {phase === 'fragment' && state.openFragment !== null && (
        <FragmentDialog index={state.openFragment} collected={collected.length} onContinue={cont} />
      )}
      {phase === 'letter' && (
        <FinalLetter views={state.letterViews} onReread={reread} onRestart={restart} onClose={close} />
      )}
      {phase === 'afterLetter' && <AfterLetterBar onReread={reread} onRestart={restart} />}
    </div>
  );
}
