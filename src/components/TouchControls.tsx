import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { CONTROL } from '../game/engine';
import type { Controller } from './GameCanvas';

export default function TouchControls({ controller, active, unlock }: { controller: RefObject<Controller>; active: boolean; unlock: () => void }) {
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId || !active) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - bounds.left - bounds.width / 2, y = e.clientY - bounds.top - bounds.height / 2;
    const d = Math.hypot(x, y); if (d > 31) { x *= 31 / d; y *= 31 / d; }
    setStick({ x, y });
    let bits = 0;
    if (x < -10) bits |= CONTROL.LEFT; if (x > 10) bits |= CONTROL.RIGHT;
    if (y < -10) bits |= CONTROL.UP; if (y > 10) bits |= CONTROL.DOWN;
    controller.current.touch = (controller.current.touch & 48) | bits;
  };
  const release = () => { pointer.current = null; setStick({ x: 0, y: 0 }); controller.current.touch &= 48; };
  const action = (e: PointerEvent<HTMLButtonElement>, bit: number) => { if (!active) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); controller.current.touch |= bit; controller.current.pulse |= bit; unlock(); };
  return <div className={`touch-controls ${!active ? 'inactive' : ''}`} aria-label="Touch controls">
    <div className="joystick" onPointerDown={e => { if (!active) return; e.preventDefault(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); unlock(); }} onPointerMove={move} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} aria-hidden="true">
      <ArrowUp className="stick-up" size={13}/><ArrowDown className="stick-down" size={13}/><ArrowLeft className="stick-left" size={13}/><ArrowRight className="stick-right" size={13}/>
      <div className="stick-thumb" style={{ transform: `translate(${stick.x}px, ${stick.y}px)` }} />
    </div>
    <span className="touch-caption">MOVE & AIM</span>
    <div className="touch-actions">
      <button className="touch-pass" disabled={!active} onPointerDown={e => action(e, CONTROL.PASS)} onPointerUp={() => { controller.current.touch &= ~CONTROL.PASS; }} onPointerCancel={() => { controller.current.touch &= ~CONTROL.PASS; }} onLostPointerCapture={() => { controller.current.touch &= ~CONTROL.PASS; }} aria-label="Pass or switch player">A<span>PASS</span></button>
      <button className="touch-shoot" disabled={!active} onPointerDown={e => action(e, CONTROL.SHOOT)} onPointerUp={() => { controller.current.touch &= ~CONTROL.SHOOT; }} onPointerCancel={() => { controller.current.touch &= ~CONTROL.SHOOT; }} onLostPointerCapture={() => { controller.current.touch &= ~CONTROL.SHOOT; }} aria-label="Shoot or tackle">B<span>SHOOT</span></button>
    </div>
  </div>;
}
