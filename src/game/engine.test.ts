import { describe, expect, it } from 'vitest';
import { CONTROL, createMatch, FIELD, HZ, replayMatch, step, UNIT, type Difficulty } from './engine';
import { advanceCup, createCup, parseProgress } from './storage';

function playing() {
  const s = createMatch();
  for (let i = 0; i < HZ * 2; i++) step(s);
  return s;
}

function openShot(difficulty: Difficulty, seed: number, x: number) {
  const s = createMatch({ difficulty, seed });
  s.phase = 'playing';
  for (const p of s.players) if (!p.keeper) {
    p.stun = 300; p.x = 200 * UNIT; p.y = (100 + p.id * 30) * UNIT;
  }
  Object.assign(s.players[4], { stun: 0, x: x * UNIT, y: FIELD.centerY * UNIT });
  Object.assign(s.ball, { owner: 4, x: (x + 12) * UNIT, y: FIELD.centerY * UNIT });
  step(s, CONTROL.SHOOT);
  for (let i = 0; i < 100 && s.phase === 'playing' && s.ball.owner === -1; i++) step(s);
  return s;
}

describe('football rules', () => {
  it('gives each side four outfield players and one goalkeeper', () => {
    const s = createMatch();
    expect(s.players).toHaveLength(10);
    expect(s.players.filter(p => p.keeper)).toHaveLength(2);
    expect(s.phase).toBe('kickoff');
    expect(s.ball.owner).toBe(s.selected);
  });
  it('moves the controlled player and dribbles with the ball', () => {
    const s = playing(), x = s.players[s.selected].x;
    for (let i = 0; i < 10; i++) step(s, CONTROL.RIGHT);
    expect(s.players[s.selected].x).toBeGreaterThan(x);
    expect(s.ball.owner).toBe(s.selected);
    expect(s.ball.x).toBeGreaterThan(s.players[s.selected].x);
  });
  it('passes toward a teammate and switches control to the receiver', () => {
    const s = playing(), passer = s.selected;
    step(s, CONTROL.PASS | CONTROL.UP);
    expect(s.ball.owner).toBe(-1);
    expect(s.ball.passFrom).toBe(passer);
    expect(s.selected).not.toBe(passer);
    expect(s.players[s.selected].team).toBe(0);
    expect(s.ball.vy).toBeLessThan(0);
  });
  it('meets a clear pass while the user keeps holding the pass direction', () => {
    const s = playing();
    step(s, CONTROL.PASS | CONTROL.UP);
    const receiver = s.selected;
    for (let i = 0; i < HZ && s.ball.owner === -1; i++) step(s, CONTROL.UP);
    expect(s.ball.owner).toBe(receiver);
    expect(s.passes[0]).toBe(1);
  });
  it('lets the user override the receiver assist immediately', () => {
    const s = playing();
    step(s, CONTROL.PASS | CONTROL.UP);
    const receiver = s.players[s.selected], before = receiver.x;
    step(s, CONTROL.RIGHT);
    expect(receiver.x).toBeGreaterThan(before);
    expect(receiver.vy).toBe(0);
    expect(s.ball.receiveTicks).toBe(0);
  });
  it('counts a goal once, pauses the clock, and gives the other side kickoff', () => {
    const s = playing();
    Object.assign(s.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: FIELD.centerY * UNIT, vx: 250, vy: 0, grace: 10 });
    step(s);
    expect(s.score).toEqual([1, 0]);
    expect(s.phase).toBe('goal');
    const clock = s.clock;
    for (let i = 0; i < HZ * 2; i++) step(s);
    expect(s.phase).toBe('kickoff');
    expect(s.clock).toBe(clock);
    expect(s.players[s.ball.owner].team).toBe(1);
    expect(s.score).toEqual([1, 0]);
  });
  it('rebounds shots outside the goal mouth rather than awarding goals', () => {
    const s = playing();
    Object.assign(s.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: (FIELD.centerY - 100) * UNIT, vx: 250, vy: 0, grace: 10 });
    step(s);
    expect(s.score).toEqual([0, 0]);
    expect(s.ball.vx).toBeLessThan(0);
  });
  it('lets slow and fast balls cross either goal mouth without an invisible rebound', () => {
    for (const side of [0, 1] as const) for (const speed of [UNIT, 5 * UNIT, 18 * UNIT]) {
      const s = playing();
      const line = side === 0 ? FIELD.right : FIELD.left, direction = side === 0 ? 1 : -1;
      Object.assign(s.ball, { owner: -1, x: (line - direction * 5) * UNIT, y: FIELD.centerY * UNIT, vx: speed * direction, vy: 0, grace: 30 });
      for (let i = 0; i < 15 && s.phase === 'playing'; i++) step(s);
      expect(s.score[side]).toBe(1);
      expect(s.phase).toBe('goal');
    }
  });
  it('awards a diagonal goal using the goal-line crossing, and rebounds outside the posts', () => {
    const goal = playing(), miss = playing();
    Object.assign(goal.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: (FIELD.centerY + 44) * UNIT, vx: 20 * UNIT, vy: 8 * UNIT, grace: 30 });
    Object.assign(miss.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: (FIELD.centerY + 50) * UNIT, vx: 20 * UNIT, vy: -8 * UNIT, grace: 30 });
    step(goal); step(miss);
    expect(goal.score).toEqual([1, 0]);
    expect(miss.score).toEqual([0, 0]);
    expect(miss.ball.vx).toBeLessThan(0);
  });
  it('allows a close tackle but never a tackle from across the pitch', () => {
    const s = playing();
    s.ball.owner = 9; s.ball.grace = 0;
    s.players[9].x = s.players[4].x + 25 * UNIT; s.players[9].y = s.players[4].y;
    step(s, CONTROL.SHOOT);
    expect(s.tackles[0]).toBe(1);
    expect(s.ball.owner).toBe(4);
    const far = playing();
    far.ball.owner = 7; far.ball.grace = 0;
    step(far, CONTROL.SHOOT);
    expect(far.tackles[0]).toBe(0);
  });
  it('ends a normal match after regulation and leaves its result frozen', () => {
    const s = playing(); s.clock = s.options.duration * HZ - 1;
    step(s);
    expect(s.phase).toBe('finished');
    const before = JSON.stringify(s);
    for (let i = 0; i < 100; i++) step(s, 63);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('resolves tied cup games with a golden goal', () => {
    const s = playing(); s.options.goldenGoal = true; s.clock = s.options.duration * HZ - 1;
    step(s);
    expect(s.overtime).toBe(true);
    Object.assign(s.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: FIELD.centerY * UNIT, vx: 250, vy: 0, grace: 10 });
    step(s);
    for (let i = 0; i < HZ * 2; i++) step(s);
    expect(s.phase).toBe('finished'); expect(s.winner).toBe(0);
  });
  it('keeps a cup alive when an equaliser is scored on the last tick', () => {
    const s = playing(); s.options.goldenGoal = true; s.score = [0, 1]; s.clock = s.options.duration * HZ - 1;
    Object.assign(s.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: FIELD.centerY * UNIT, vx: 250, vy: 0, grace: 10 });
    step(s);
    for (let i = 0; i < HZ * 2; i++) step(s);
    expect(s.score).toEqual([1, 1]); expect(s.overtime).toBe(true); expect(s.phase).toBe('kickoff');
  });
  it('ends regulation after a last-tick goal without playing another kick-off', () => {
    const s = playing(); s.clock = s.options.duration * HZ - 1;
    Object.assign(s.ball, { owner: -1, x: (FIELD.right - 5) * UNIT, y: FIELD.centerY * UNIT, vx: 250, vy: 0, grace: 10 });
    step(s);
    for (let i = 0; i < HZ * 2; i++) step(s);
    expect(s.phase).toBe('finished'); expect(s.winner).toBe(0);
  });
  it('makes opponent keeper reactions progressively faster without changing the player', () => {
    const reactions: number[] = [];
    const movement: number[] = [];
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const s = playing(); s.options.difficulty = difficulty;
      s.ball.owner = -1; s.ball.x = 700 * UNIT; s.ball.y = 225 * UNIT; s.ball.grace = 100;
      const beforeKeeper = s.players[5].y, beforePlayer = s.players[4].x;
      step(s, CONTROL.RIGHT);
      reactions.push(beforeKeeper - s.players[5].y); movement.push(s.players[4].x - beforePlayer);
    }
    expect(reactions[1]).toBeGreaterThan(reactions[0]); expect(reactions[2]).toBeGreaterThan(reactions[1]);
    expect(new Set(movement).size).toBe(1);
  });
  it('makes good Easy chances scoreable while saving some shots and covering long shots', () => {
    const conversions = (difficulty: Difficulty, x: number) => Array.from({ length: 100 }, (_, i) => openShot(difficulty, i + 1, x).score[0]).reduce((a, b) => a + b, 0);
    const edgeOfBox = conversions('easy', 600);
    expect(edgeOfBox).toBeGreaterThan(25);
    expect(edgeOfBox).toBeLessThan(75);
    expect(conversions('easy', 640)).toBeGreaterThan(edgeOfBox);
    expect(conversions('easy', 520)).toBeLessThan(15);
    expect(conversions('normal', 640)).toBeLessThan(conversions('easy', 640));
    expect(conversions('hard', 640)).toBeLessThan(conversions('normal', 640));
  });
  it('still saves a shot directly at the Easy keeper during their reaction window', () => {
    const s = playing(); s.options.difficulty = 'easy';
    s.players[5].reaction = 6;
    Object.assign(s.ball, { owner: -1, x: 775 * UNIT, y: FIELD.centerY * UNIT, vx: 292, vy: 0, grace: 0, lastTouch: 4 });
    step(s);
    expect(s.ball.owner).toBe(5);
    expect(s.event?.type).toBe('save');
    expect(s.score).toEqual([0, 0]);
  });
  it('gives time to react on Easy but tackles a player who stands in pressure', () => {
    const s = playing(); s.options.difficulty = 'easy'; s.ball.grace = 0;
    const attacker = s.players[4], defender = s.players[9];
    defender.x = attacker.x + 30 * UNIT; defender.y = attacker.y;
    step(s);
    expect(s.ball.owner).toBe(4);
    for (let i = 0; i < HZ && s.ball.owner === 4; i++) step(s);
    expect(s.tackles[1]).toBeGreaterThan(0);
    expect(s.players[s.ball.owner].team).toBe(1);
  });
  it('can still attack and score on Easy when the user does not defend', () => {
    const s = createMatch({ difficulty: 'easy', duration: 30, seed: 731 });
    for (let i = 0; i < 3000 && s.phase !== 'finished'; i++) step(s);
    expect(s.phase).toBe('finished');
    expect(s.shots[1]).toBeGreaterThan(1);
    expect(s.score[1]).toBeGreaterThan(0);
  });
  it('replays a full input tape to exactly the same state', () => {
    const s = createMatch({ seed: 911 });
    const inputs: number[] = [];
    for (let i = 0; i < 12000 && s.phase !== 'finished'; i++) {
      const input = (i % 160 < 100 ? CONTROL.RIGHT : CONTROL.UP) | (i % 61 === 0 ? CONTROL.SHOOT : 0) | (i % 117 === 0 ? CONTROL.PASS : 0);
      inputs.push(input); step(s, input);
    }
    expect(s.phase).toBe('finished');
    const replay = replayMatch({ format: 'futbol-replay-v1', options: s.options, inputs, score: s.score });
    expect(replay).toEqual(s);
    expect(s.players.every(p => [p.x, p.y, p.vx, p.vy].every(Number.isInteger))).toBe(true);
  });
  it('AI matches produce shots and finish on all difficulty levels', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const s = createMatch({ difficulty, duration: 120 });
      for (let i = 0; i < 12000 && s.phase !== 'finished'; i++) step(s, 0, true);
      expect(s.phase).toBe('finished');
      expect(s.shots[0] + s.shots[1]).toBeGreaterThan(2);
    }
  });
});

describe('local progress', () => {
  it('progresses through three cup rounds and marks the final win', () => {
    let cup = createCup('lagos', 'normal');
    expect(new Set(cup.opponents).size).toBe(3);
    expect(cup.opponents).not.toContain(cup.team);
    cup = advanceCup(cup); expect(cup.round).toBe(1);
    cup = advanceCup(cup); expect(cup.round).toBe(2);
    cup = advanceCup(cup); expect(cup.completed).toBe(true); expect(cup.wins).toBe(3);
  });
  it('recovers from corrupted local storage and invalid cup references', () => {
    expect(parseProgress('{broken').played).toBe(0);
    expect(parseProgress(JSON.stringify({ played: -1 })).played).toBe(0);
    const stored = { played: 5, won: 2, goals: 7, cups: 0, cup: { team: 'not-a-club' } };
    expect(parseProgress(JSON.stringify(stored))).toEqual({ ...stored, cup: null });
  });
});
