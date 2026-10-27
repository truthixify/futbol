import { useEffect, useRef, type RefObject } from 'react';
import { CONTROL, createMatch, HZ, remainingSeconds, step, type MatchOptions, type MatchState, type Replay } from '../game/engine';
import { createRenderer } from '../game/render';
import type { MatchAudio } from '../game/audio';

export interface GameSession { id: number; mode: 'demo' | 'match' | 'replay'; options: MatchOptions; replay?: Replay }
export interface Controller { touch: number; held: Set<string>; pulse: number }
export interface Hud { score: [number, number]; remaining: number; phase: MatchState['phase']; countdown: number; overtime: boolean; event: MatchState['event']; tick: number }
interface Props {
  session: GameSession; paused: boolean; controller: RefObject<Controller>; audio: MatchAudio;
  onHud: (hud: Hud) => void; onFinish: (state: MatchState, replay: Replay) => void; onPause: () => void;
}
const KEY_BITS: Record<string, number> = { ArrowLeft: CONTROL.LEFT, KeyA: CONTROL.LEFT, ArrowRight: CONTROL.RIGHT, KeyD: CONTROL.RIGHT, ArrowUp: CONTROL.UP, KeyW: CONTROL.UP, ArrowDown: CONTROL.DOWN, KeyS: CONTROL.DOWN, KeyJ: CONTROL.PASS, KeyZ: CONTROL.PASS, KeyK: CONTROL.SHOOT, KeyX: CONTROL.SHOOT, Space: CONTROL.SHOOT };

export default function GameCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef(props); current.current = props;
  useEffect(() => {
    const canvas = canvasRef.current!;
    const draw = createRenderer(canvas);
    const { session, controller } = current.current;
    let state = createMatch(session.options), frame = 0, accumulator = 0, last = 0, eventTick = -1, lastHud = -1, ended = false, replayIndex = 0;
    const inputs: number[] = [];
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    controller.current.held.clear(); controller.current.touch = 0; controller.current.pulse = 0;
    if (session.mode === 'match') canvas.focus({ preventScroll: true });
    const clear = () => { controller.current.held.clear(); controller.current.touch = 0; controller.current.pulse = 0; };
    const down = (e: KeyboardEvent) => {
      if (session.mode !== 'match' || current.current.paused) return;
      if (e.target instanceof HTMLElement && (e.target.closest('input, select, dialog') || (e.code === 'Space' && e.target.closest('button')))) return;
      if (KEY_BITS[e.code]) {
        e.preventDefault(); controller.current.held.add(e.code);
        if (!e.repeat) controller.current.pulse |= KEY_BITS[e.code];
        current.current.audio.unlock();
      }
    };
    const up = (e: KeyboardEvent) => { controller.current.held.delete(e.code); };
    const hidden = () => { if (document.hidden) { clear(); if (session.mode === 'match') current.current.onPause(); } };
    const blur = () => { clear(); if (session.mode === 'match') current.current.onPause(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
    const update = (now: number) => {
      if (!last) last = now;
      const dt = Math.min(100, now - last); last = now;
      const stopped = current.current.paused || document.hidden || (session.mode === 'demo' && reducedMotion.matches);
      if (!stopped) {
        accumulator += dt;
        while (accumulator >= 1000 / HZ) {
          accumulator -= 1000 / HZ;
          let input = controller.current.touch | controller.current.pulse;
          controller.current.pulse = 0;
          for (const key of controller.current.held) input |= KEY_BITS[key] ?? 0;
          if (session.mode === 'replay') input = session.replay?.inputs[replayIndex++] ?? 0;
          if (state.phase !== 'finished') {
            if (session.mode === 'match') inputs.push(input);
            step(state, input, session.mode === 'demo');
          }
          if (state.phase === 'finished' && session.mode === 'demo') state = createMatch({ ...session.options, seed: state.rng });
          if (state.event && state.event.tick !== eventTick && session.mode !== 'demo') { current.current.audio.play(state.event.type); eventTick = state.event.tick; }
          if (session.mode !== 'demo' && state.phase === 'playing' && state.tick % 11 === 0 && state.ball.owner >= 0) {
            const carrier = state.players[state.ball.owner];
            if (carrier.vx || carrier.vy) current.current.audio.play('dribble');
          }
          if (state.phase === 'finished' && !ended && session.mode === 'match') {
            ended = true;
            current.current.onFinish(structuredClone(state), { format: 'futbol-replay-v1', options: { ...state.options }, inputs: [...inputs], score: [...state.score] });
          }
        }
      } else accumulator = 0;
      if (now - lastHud > 100) {
        lastHud = now;
        current.current.onHud({ score: [...state.score], remaining: remainingSeconds(state), phase: state.phase, countdown: Math.ceil(state.phaseTicks / HZ), overtime: state.overtime, event: state.event, tick: state.tick });
      }
      if (!document.hidden) draw(state, session.mode === 'demo');
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); clear(); current.current.audio.stop(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); };
  }, [props.session.id]);
  return <canvas ref={canvasRef} className="game-canvas" tabIndex={props.session.mode === 'match' ? 0 : -1} aria-label="Football pitch. Move with arrow keys or WASD. J passes or switches player. K or Space shoots or tackles. Escape pauses." />;
}
