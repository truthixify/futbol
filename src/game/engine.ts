/**
 * Pure integer simulation. 30 ticks/second, positions in 1/16-pixel units.
 * No wall clock, browser state, random globals, or rendering dependencies.
 * Input bits and a seed reproduce an entire match. See docs/architecture.md.
 */
export const HZ = 30;
export const UNIT = 16;
export const WIDTH = 900;
export const HEIGHT = 540;
export const FIELD = { left: 70, right: 830, top: 76, bottom: 464, centerX: 450, centerY: 270, goalHalf: 51 };
export const CONTROL = { LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8, PASS: 16, SHOOT: 32 } as const;
export type Side = 0 | 1;
export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES = {
  easy: { label: 'Easy', description: 'Time to react. Room to score. Still a proper match.', speed: 54, keeperSpeed: 38, keeperReaction: 6, keeperReach: 16, shotSpread: 29, tackleCooldown: 46, tackleReaction: 6 },
  normal: { label: 'Normal', description: 'A balanced match. Make your passes count.', speed: 58, keeperSpeed: 48, keeperReaction: 4, keeperReach: 17, shotSpread: 17, tackleCooldown: 38, tackleReaction: 4 },
  hard: { label: 'Hard', description: 'Quick reactions. Tight marking. Earn every goal.', speed: 68, keeperSpeed: 65, keeperReaction: 2, keeperReach: 18, shotSpread: 7, tackleCooldown: 26, tackleReaction: 2 },
} as const;
export type Phase = 'kickoff' | 'playing' | 'goal' | 'finished';
export type EventType = 'kickoff' | 'pass' | 'shot' | 'tackle' | 'save' | 'goal' | 'finish' | 'bounce';
export interface GameEvent { type: EventType; tick: number; team: Side }
export interface Player {
  id: number; team: Side; slot: number; keeper: boolean;
  x: number; y: number; vx: number; vy: number; faceX: number; faceY: number;
  cooldown: number; stun: number; reaction: number; pressure: number;
}
export interface MatchOptions {
  home: string; away: string; difficulty: Difficulty; seed: number;
  duration: number; goldenGoal: boolean;
}
export interface MatchState {
  options: MatchOptions;
  tick: number; clock: number; phase: Phase; phaseTicks: number;
  rng: number; previousInput: number; selected: number; kickoffTeam: Side;
  score: [number, number]; possession: [number, number]; shots: [number, number]; passes: [number, number]; tackles: [number, number];
  players: Player[];
  ball: { x: number; y: number; vx: number; vy: number; owner: number; grace: number; lastTouch: number; passFrom: number; passTo: number; receiveInput: number; receiveTicks: number };
  event: GameEvent | null;
  winner: Side | null;
  overtime: boolean;
}
export interface Replay { format: 'futbol-replay-v1'; options: MatchOptions; inputs: number[]; score: [number, number] }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const px = (value: number) => value * UNIT;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.floor(Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2));
const vector = (x: number, y: number, speed: number): [number, number] => {
  const length = Math.floor(Math.sqrt(x * x + y * y));
  return length ? [Math.trunc(x * speed / length), Math.trunc(y * speed / length)] : [0, 0];
};
const random = (s: MatchState, limit: number) => { s.rng = s.rng * 16807 % 2147483647; return s.rng % limit; };
const attack = (team: Side) => team === 0 ? 1 : -1;
const opponent = (team: Side): Side => team === 0 ? 1 : 0;
const event = (s: MatchState, type: EventType, team: Side) => { s.event = { type, tick: s.tick, team }; };

export function createMatch(options: Partial<MatchOptions> = {}): MatchState {
  const config: MatchOptions = { home: 'lagos', away: 'rio', difficulty: 'normal', seed: 73129, duration: 120, goldenGoal: false, ...options };
  config.seed = clamp(Math.floor(config.seed) || 73129, 1, 2147483646);
  config.duration = clamp(Math.floor(config.duration) || 120, 1, 600);
  const s: MatchState = {
    options: config, tick: 0, clock: 0, phase: 'kickoff', phaseTicks: HZ * 2, rng: config.seed,
    previousInput: 0, selected: 4, kickoffTeam: 0, score: [0, 0], possession: [0, 0], shots: [0, 0], passes: [0, 0], tackles: [0, 0],
    players: [], ball: { x: 0, y: 0, vx: 0, vy: 0, owner: -1, grace: 0, lastTouch: -1, passFrom: -1, passTo: -1, receiveInput: 0, receiveTicks: 0 },
    event: null, winner: null, overtime: false,
  };
  for (let team = 0; team < 2; team++) for (let slot = 0; slot < 5; slot++) {
    s.players.push({ id: team * 5 + slot, team: team as Side, slot, keeper: slot === 0, x: 0, y: 0, vx: 0, vy: 0, faceX: attack(team as Side), faceY: 0, cooldown: 0, stun: 0, reaction: 0, pressure: 0 });
  }
  resetKickoff(s, 0);
  return s;
}

function resetKickoff(s: MatchState, team: Side) {
  const formation = [[104, 270], [260, 270], [342, 160], [342, 380], [425, 270]];
  for (const p of s.players) {
    const [x, y] = formation[p.slot];
    p.x = px(p.team === 0 ? x : WIDTH - x); p.y = px(y);
    if (p.slot === 4 && p.team !== team) p.x = px(p.team === 0 ? 342 : WIDTH - 342);
    p.vx = 0; p.vy = 0; p.cooldown = 0; p.stun = 0; p.reaction = 0; p.pressure = 0; p.faceX = attack(p.team); p.faceY = 0;
  }
  s.kickoffTeam = team; s.selected = 4; s.phase = 'kickoff'; s.phaseTicks = HZ * 2;
  s.ball = { x: px(450), y: px(270), vx: 0, vy: 0, owner: team * 5 + 4, grace: 25, lastTouch: team * 5 + 4, passFrom: -1, passTo: -1, receiveInput: 0, receiveTicks: 0 };
  s.players[s.ball.owner].x = px(team === 0 ? 437 : 463);
}

function takeBall(s: MatchState, p: Player) {
  const from = s.players[s.ball.passFrom];
  if (from && from.team === p.team && from.id !== p.id) s.passes[p.team]++;
  s.ball.owner = p.id; s.ball.lastTouch = p.id; s.ball.passFrom = -1; s.ball.passTo = -1; s.ball.receiveTicks = 0;
  s.ball.grace = 10; s.ball.vx = 0; s.ball.vy = 0;
  if (p.team === 0 && !p.keeper) s.selected = p.id;
  p.cooldown = Math.max(p.cooldown, p.keeper ? 16 : 4);
}

function passBall(s: MatchState, p: Player, aimX = 0, aimY = 0) {
  let best: Player | undefined; let bestScore = -Infinity;
  for (const friend of s.players) {
    if (friend.team !== p.team || friend.id === p.id || friend.keeper) continue;
    const d = distance(friend, p);
    const direction = vector(friend.x - p.x, friend.y - p.y, 100);
    const alignment = aimX || aimY ? (direction[0] * aimX + direction[1] * aimY) * 14 : direction[0] * attack(p.team) * 5;
    const space = Math.min(...s.players.filter(e => e.team !== p.team).map(e => distance(e, friend))) / UNIT;
    const rank = alignment + space - d / UNIT * 0.28;
    if (rank > bestScore) { bestScore = rank; best = friend; }
  }
  if (!best) return;
  const lead = p.team === 0 ? 0 : 8;
  [s.ball.vx, s.ball.vy] = vector(best.x + best.vx * lead - s.ball.x, best.y + best.vy * lead - s.ball.y, 180);
  s.ball.owner = -1; s.ball.grace = 5; s.ball.lastTouch = p.id; s.ball.passFrom = p.id; p.cooldown = 16;
  s.ball.passTo = best.id; s.ball.receiveInput = (aimX < 0 ? CONTROL.LEFT : aimX > 0 ? CONTROL.RIGHT : 0) | (aimY < 0 ? CONTROL.UP : aimY > 0 ? CONTROL.DOWN : 0);
  s.ball.receiveTicks = HZ;
  if (p.team === 0) s.selected = best.id;
  event(s, 'pass', p.team);
}

function shoot(s: MatchState, p: Player, aimY = 0) {
  const keeper = s.players[opponent(p.team) * 5];
  const goalX = px(p.team === 0 ? FIELD.right + 12 : FIELD.left - 12);
  const corner = aimY ? aimY * 40 : keeper.y >= px(FIELD.centerY) ? -36 : 36;
  const spread = p.team === 0 ? 9 : DIFFICULTIES[s.options.difficulty].shotSpread;
  const goalY = px(FIELD.centerY + corner + random(s, spread * 2 + 1) - spread);
  [s.ball.vx, s.ball.vy] = vector(goalX - s.ball.x, goalY - s.ball.y, p.team === 0 ? 292 : 266);
  s.ball.owner = -1; s.ball.grace = 4; s.ball.lastTouch = p.id; s.ball.passFrom = -1; s.ball.passTo = -1; s.ball.receiveTicks = 0;
  keeper.reaction = keeper.team === 1 ? DIFFICULTIES[s.options.difficulty].keeperReaction : 4;
  p.cooldown = 24; s.shots[p.team]++; event(s, 'shot', p.team);
}

function tackle(s: MatchState, p: Player, manual: boolean) {
  if (p.cooldown || p.keeper) return;
  const carrier = s.players[s.ball.owner];
  p.cooldown = manual ? 24 : p.team === 1 ? DIFFICULTIES[s.options.difficulty].tackleCooldown : 38;
  if (manual) { p.x += p.faceX * px(9); p.y += p.faceY * px(9); }
  if (carrier && carrier.team !== p.team && !carrier.keeper && s.ball.grace === 0 && distance(p, carrier) < px(manual ? 38 : 25)) {
    carrier.stun = 10; takeBall(s, p); s.tackles[p.team]++; event(s, 'tackle', p.team);
  }
}

function move(p: Player, targetX: number, targetY: number, speed: number) {
  const d = distance(p, { x: targetX, y: targetY });
  [p.vx, p.vy] = d > speed ? vector(targetX - p.x, targetY - p.y, speed) : [targetX - p.x, targetY - p.y];
  if (p.vx || p.vy) { p.faceX = Math.sign(p.vx); p.faceY = Math.sign(p.vy); }
  p.x += p.vx; p.y += p.vy;
}

function bot(s: MatchState, p: Player, demo: boolean) {
  const dir = attack(p.team);
  const speed = p.team === 0 ? 60 : DIFFICULTIES[s.options.difficulty].speed;
  const carrier = s.players[s.ball.owner];
  if (p.keeper) {
    const goalX = px(p.team === 0 ? 105 : 795);
    const targetY = clamp(s.ball.y, px(FIELD.centerY - 45), px(FIELD.centerY + 45));
    // A keeper sees the shot before adjusting, but can still save a ball hit at them.
    if (p.reaction > 0) { p.reaction--; p.vx = 0; p.vy = 0; }
    else move(p, goalX, targetY, p.team === 1 ? DIFFICULTIES[s.options.difficulty].keeperSpeed : 48);
    if (s.ball.owner === p.id && !p.cooldown) passBall(s, p);
    return;
  }
  if (s.ball.owner === p.id) {
    p.pressure = 0;
    const goalX = px(p.team === 0 ? FIELD.right : FIELD.left);
    const closestEnemy = Math.min(...s.players.filter(e => e.team !== p.team && !e.keeper).map(e => distance(p, e)));
    if (!p.cooldown && Math.abs(p.x - goalX) < px(240) && Math.abs(p.y - px(FIELD.centerY)) < px(140)) { shoot(s, p); return; }
    if (!p.cooldown && closestEnemy < px(62) && (s.tick + p.id * 7) % 19 === 0) { passBall(s, p); return; }
    const lane = FIELD.centerY + (p.slot === 2 ? -40 : p.slot === 3 ? 40 : 0);
    move(p, goalX, px(lane), Math.floor(speed * 0.93));
    return;
  }
  if (!carrier && s.ball.passTo === p.id && s.ball.receiveTicks > 0) {
    p.pressure = 0;
    move(p, s.ball.x + s.ball.vx * 3, s.ball.y + s.ball.vy * 3, speed);
    return;
  }
  const candidates = s.players.filter(other => other.team === p.team && !other.keeper && !(!demo && other.team === 0 && other.id === s.selected));
  const nearest = candidates.reduce((best, candidate) => distance(candidate, s.ball) < distance(best, s.ball) ? candidate : best, candidates[0]);
  if ((!carrier || carrier.team !== p.team) && p.id === nearest.id) {
    move(p, s.ball.x + s.ball.vx * 3, s.ball.y + s.ball.vy * 3, speed);
    p.pressure = carrier && distance(p, carrier) < px(35) ? p.pressure + 1 : 0;
    const reaction = p.team === 1 ? DIFFICULTIES[s.options.difficulty].tackleReaction : 4;
    if (carrier && p.pressure >= reaction && distance(p, carrier) < px(27)) tackle(s, p, false);
  } else {
    p.pressure = 0;
    const attacking = carrier?.team === p.team;
    const progress = (s.ball.x / UNIT - FIELD.centerX) * 0.40;
    const baseX = p.slot === 1 ? 270 : p.slot === 4 ? 535 : 440;
    const baseY = p.slot === 2 ? 149 : p.slot === 3 ? 391 : FIELD.centerY;
    const targetX = (p.team === 0 ? baseX : WIDTH - baseX) + progress + (attacking ? dir * 45 : -dir * 50);
    const targetY = baseY + (s.ball.y / UNIT - FIELD.centerY) * 0.12;
    move(p, px(clamp(Math.round(targetX), 180, 720)), px(clamp(Math.round(targetY), 110, 430)), Math.floor(speed * 0.85));
  }
}

function goal(s: MatchState, team: Side) {
  s.score[team]++; s.phase = 'goal'; s.phaseTicks = HZ * 2;
  s.kickoffTeam = opponent(team); s.ball.owner = -1; s.ball.vx = 0; s.ball.vy = 0;
  event(s, 'goal', team);
}

function finish(s: MatchState) {
  s.phase = 'finished'; s.winner = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1;
  event(s, 'finish', s.winner ?? 0);
}

function updateBall(s: MatchState) {
  const b = s.ball;
  if (b.grace > 0) b.grace--;
  if (b.receiveTicks > 0) b.receiveTicks--;
  if (b.owner >= 0) {
    const p = s.players[b.owner];
    const [dx, dy] = vector(p.faceX || attack(p.team), p.faceY, px(12));
    b.x = p.x + dx; b.y = p.y + dy;
    return;
  }
  const oldX = b.x, oldY = b.y;
  b.x += b.vx; b.y += b.vy;
  b.vx = Math.trunc(b.vx * 986 / 1000); b.vy = Math.trunc(b.vy * 986 / 1000);
  for (const line of [FIELD.left, FIELD.right]) {
    const boundary = px(line);
    const crosses = line === FIELD.left ? oldX >= boundary && b.x < boundary : oldX <= boundary && b.x > boundary;
    if (crosses) {
      const crossingY = oldY + Math.trunc((b.y - oldY) * (boundary - oldX) / (b.x - oldX));
      if (Math.abs(crossingY - px(FIELD.centerY)) < px(FIELD.goalHalf - 4)) { goal(s, line === FIELD.left ? 1 : 0); return; }
    }
  }
  if (b.y < px(FIELD.top + 4) || b.y > px(FIELD.bottom - 4)) { b.y = clamp(b.y, px(FIELD.top + 4), px(FIELD.bottom - 4)); b.vy = -Math.trunc(b.vy * 8 / 10); event(s, 'bounce', s.players[b.lastTouch]?.team ?? 0); }
  // Let the ball travel through the mouth to the goal line. The end-wall
  // collision is four pixels inside it and must not block valid slow shots.
  const inGoalMouth = Math.abs(b.y - px(FIELD.centerY)) < px(FIELD.goalHalf - 4);
  if ((b.x < px(FIELD.left + 4) || b.x > px(FIELD.right - 4)) && (!inGoalMouth || b.x < px(FIELD.left) || b.x > px(FIELD.right))) {
    b.x = clamp(b.x, px(FIELD.left + 4), px(FIELD.right - 4)); b.vx = -Math.trunc(b.vx * 8 / 10); event(s, 'bounce', s.players[b.lastTouch]?.team ?? 0);
  }
  if (b.grace) return;
  for (const p of s.players) {
    if (p.stun || (p.id === b.lastTouch && p.cooldown > 0)) continue;
    const reach = p.keeper ? p.team === 1 ? DIFFICULTIES[s.options.difficulty].keeperReach : 17 : 14;
    if (distance(p, b) < px(reach)) {
      const isSave = p.keeper && Math.abs(b.vx) + Math.abs(b.vy) > 100;
      takeBall(s, p); if (isSave) event(s, 'save', p.team); break;
    }
  }
}

/** Mutates one game by exactly one tick. Inputs are six-bit control masks. */
export function step(s: MatchState, input = 0, demo = false): void {
  if (s.phase === 'finished') return;
  input = input & 63;
  s.tick++;
  if (s.phase === 'kickoff' || s.phase === 'goal') {
    s.phaseTicks--;
    if (s.phaseTicks <= 0) {
      if (s.phase === 'goal') {
        if (!s.overtime && s.clock >= s.options.duration * HZ && s.options.goldenGoal && s.score[0] === s.score[1]) {
          s.overtime = true; resetKickoff(s, s.kickoffTeam);
        } else if (s.overtime || s.clock >= s.options.duration * HZ) finish(s);
        else resetKickoff(s, s.kickoffTeam);
      } else { s.phase = 'playing'; event(s, 'kickoff', s.kickoffTeam); }
    }
    s.previousInput = input;
    return;
  }
  s.clock++;
  const owner = s.players[s.ball.owner];
  if (owner) s.possession[owner.team]++;
  const x = Number(!!(input & CONTROL.RIGHT)) - Number(!!(input & CONTROL.LEFT));
  const y = Number(!!(input & CONTROL.DOWN)) - Number(!!(input & CONTROL.UP));
  const pressed = input & ~s.previousInput;
  if (!demo && pressed & CONTROL.PASS) {
    const p = s.players[s.selected];
    if (s.ball.owner === p.id) passBall(s, p, x, y);
    else {
      const candidates = s.players.filter(other => other.team === 0 && !other.keeper && other.id !== s.selected);
      s.selected = candidates.sort((a, b) => distance(a, s.ball) - distance(b, s.ball))[0].id;
    }
  }
  if (!demo && pressed & CONTROL.SHOOT) {
    const p = s.players[s.selected];
    if (s.ball.owner === p.id) shoot(s, p, y); else tackle(s, p, true);
  }
  for (const p of s.players) {
    if (p.cooldown > 0) p.cooldown--;
    if (p.stun > 0) { p.stun--; p.vx = 0; p.vy = 0; continue; }
    if (!demo && p.id === s.selected) {
      const speed = s.ball.owner === p.id ? 70 : 77;
      const receiving = s.ball.owner < 0 && s.ball.passTo === p.id && s.ball.receiveTicks > 0;
      // Holding the pass direction should not make the new receiver run away.
      // A deliberate change of direction immediately takes back manual control.
      if (receiving && (!(input & 15) || (input & 15) === s.ball.receiveInput)) {
        move(p, s.ball.x + s.ball.vx * 3, s.ball.y + s.ball.vy * 3, speed);
      } else {
        if (receiving) s.ball.receiveTicks = 0;
        const [vx, vy] = vector(x, y, speed);
        p.vx = vx; p.vy = vy; p.x += vx; p.y += vy;
        if (x || y) { p.faceX = x; p.faceY = y; }
      }
    } else bot(s, p, demo);
    p.x = clamp(p.x, px(FIELD.left + 13), px(FIELD.right - 13));
    p.y = clamp(p.y, px(FIELD.top + 13), px(FIELD.bottom - 13));
  }
  // Separate bodies so tackles and blocked lanes have a physical footprint.
  for (let a = 0; a < s.players.length; a++) for (let b = a + 1; b < s.players.length; b++) {
    const p = s.players[a], q = s.players[b], d = distance(p, q);
    if (d < px(15) && d > 0 && !p.keeper && !q.keeper) {
      const [dx, dy] = vector(q.x - p.x, q.y - p.y, Math.ceil((px(15) - d) / 2));
      p.x -= dx; p.y -= dy; q.x += dx; q.y += dy;
    }
  }
  for (const p of s.players) {
    p.x = clamp(p.x, px(FIELD.left + 13), px(FIELD.right - 13));
    p.y = clamp(p.y, px(FIELD.top + 13), px(FIELD.bottom - 13));
  }
  updateBall(s);
  s.previousInput = input;
  if (s.clock >= s.options.duration * HZ && s.phase === 'playing' && !s.overtime) {
    if (s.options.goldenGoal && s.score[0] === s.score[1]) s.overtime = true;
    else finish(s);
  }
}

export function replayMatch(replay: Replay): MatchState {
  if (replay.format !== 'futbol-replay-v1' || replay.inputs.length > 54000 || replay.inputs.some(i => !Number.isInteger(i) || i < 0 || i > 63)) throw new Error('Invalid replay');
  const state = createMatch(replay.options);
  for (const input of replay.inputs) step(state, input);
  return state;
}

export const remainingSeconds = (s: MatchState) => Math.max(0, s.options.duration - Math.floor(s.clock / HZ));
