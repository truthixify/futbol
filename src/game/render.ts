import { FIELD, HEIGHT, UNIT, WIDTH, type MatchState, type Player } from './engine';
import { getTeam } from './teams';

// Original procedural pixel artwork. Keeping visual randomness out of the rules
// means a renderer change cannot change a replay's result.
const PALETTE = {
  apron: '#b4c2a3', apronDark: '#9eaf8e', fence: '#324a38', concrete: '#dad8bd',
  grass: '#42774c', stripe: '#477f50', line: '#c7ddad', shadow: '#254b35',
  white: '#fff7dc', orange: '#ec7a4b', dark: '#223c2a',
};

function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, flip = 1) {
  rect(ctx, '#889c7a', x + 8, y + 18, 25, 6);
  rect(ctx, '#6d7050', x, y, 6, 35);
  const leaves = [[-24, -7, 24, 7], [-15, -14, 31, 8], [6, -7, 25, 8], [-31, 0, 29, 8], [6, 2, 30, 7], [-24, 8, 14, 8], [17, 9, 13, 7]];
  for (const [dx, dy, w, h] of leaves) rect(ctx, '#305f3d', x + dx * flip, y + dy, w, h);
  rect(ctx, '#50794a', x - 10, y - 9, 20, 7);
}

function makeStadium(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d')!;
  rect(c, PALETTE.apron, 0, 0, WIDTH, HEIGHT);
  // The repeating, offset paving and grandstand give the pitch a small-club scale.
  for (let y = 0; y < HEIGHT; y += 12) for (let x = (y % 24 ? 6 : 0); x < WIDTH; x += 24) {
    rect(c, PALETTE.apronDark, x, y, 1, 1);
  }
  rect(c, '#879b7d', 42, 54, 824, 446);
  rect(c, PALETTE.concrete, 36, 48, 824, 446);
  rect(c, PALETTE.fence, 48, 61, 802, 420);
  rect(c, PALETTE.grass, 54, 67, 790, 408);
  for (let i = 0; i < 10; i++) if (i % 2 === 0) rect(c, PALETTE.stripe, FIELD.left + i * 76, 67, 76, 408);
  for (let i = 0; i < 540; i++) {
    const x = 59 + (i * 127 % 779), y = 72 + (i * 79 % 397);
    rect(c, i % 2 ? '#498151' : '#3e7249', x, y, 2, 1);
  }
  // The field is rendered in world units, independently of display resolution.
  c.strokeStyle = PALETTE.line; c.lineWidth = 2; c.strokeRect(FIELD.left, FIELD.top, 760, 388);
  c.beginPath(); c.moveTo(450, 76); c.lineTo(450, 464); c.stroke();
  c.beginPath(); c.arc(450, 270, 58, 0, Math.PI * 2); c.stroke();
  rect(c, PALETTE.line, 448, 268, 4, 4);
  c.strokeRect(70, 170, 120, 200); c.strokeRect(710, 170, 120, 200);
  c.strokeRect(70, 222, 43, 96); c.strokeRect(787, 222, 43, 96);
  rect(c, PALETTE.line, 154, 268, 3, 3); rect(c, PALETTE.line, 743, 268, 3, 3);
  c.beginPath(); c.arc(157, 270, 50, -0.84, 0.84); c.stroke();
  c.beginPath(); c.arc(743, 270, 50, Math.PI - 0.84, Math.PI + 0.84); c.stroke();
  for (const [x, y] of [[70, 76], [830, 76], [70, 464], [830, 464]]) {
    rect(c, '#f2e6bc', x - 1, y - 10, 2, 12); rect(c, PALETTE.orange, x + 1, y - 10, 8, 5);
  }
  for (const x of [47, 830]) {
    rect(c, '#d0d4bd', x, 219, 23, 102);
    for (let gridX = x; gridX < x + 24; gridX += 5) rect(c, '#a2b29c', gridX, 220, 1, 100);
    for (let y = 220; y < 322; y += 6) rect(c, '#a2b29c', x, y, 23, 1);
    c.strokeStyle = PALETTE.white; c.lineWidth = 3; c.strokeRect(x, 219, 23, 102);
  }
  // Benches, spectators, and advertising boards are drawn rather than loaded.
  for (let row = 0; row < 3; row++) {
    rect(c, row % 2 ? '#8f9e83' : '#9fae92', 136, 12 + row * 10, 628, 8);
    for (let col = 0; col < 77; col++) {
      if ((col * 7 + row * 3) % 11 < 3) continue;
      const colors = ['#eee8c9', '#e1b658', '#344e3c', '#e18d63', '#71999a'];
      const x = 142 + col * 8, y = 9 + row * 10;
      rect(c, '#7b654e', x + 1, y, 3, 3);
      rect(c, colors[(col * 13 + row) % colors.length], x, y + 3, 5, 5);
    }
  }
  rect(c, '#e6dfc3', 228, 49, 160, 13); rect(c, '#e6dfc3', 514, 49, 160, 13);
  c.fillStyle = '#42623e'; c.font = 'bold 8px monospace'; c.textAlign = 'center';
  c.fillText('THE BEAUTIFUL LITTLE GAME', 308, 58); c.fillText('SUNDAY IS FOR FOOTBALL', 594, 58);
  rect(c, '#8d7651', 218, 496, 86, 6); rect(c, '#8d7651', 596, 496, 86, 6);
  rect(c, '#f5e9c8', 400, 497, 100, 17);
  c.fillStyle = PALETTE.dark; c.font = 'bold 10px monospace'; c.fillText('F U T B O L', 450, 509);
  tree(c, 36, 29); tree(c, 860, 30, -1); tree(c, 26, 493); tree(c, 872, 496, -1);
  return canvas;
}

function player(c: CanvasRenderingContext2D, p: Player, s: MatchState, controlled: boolean) {
  const x = Math.round(p.x / UNIT), y = Math.round(p.y / UNIT);
  const team = getTeam(p.team === 0 ? s.options.home : s.options.away);
  const kit = p.keeper ? '#95bfe3' : team.color;
  const shorts = p.keeper ? '#3c5687' : team.secondary;
  const running = p.vx || p.vy;
  const stride = running ? Math.floor(s.tick / 4) % 2 ? 2 : -2 : 0;
  rect(c, PALETTE.shadow, x - 6, y + 4, 15, 5);
  if (controlled) {
    c.strokeStyle = '#fff2ae'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y + 4, 13, 5, 0, 0, Math.PI * 2); c.stroke();
    rect(c, '#fff2ae', x - 4, y - 27, 8, 3); rect(c, '#fff2ae', x - 2, y - 24, 4, 3);
  }
  const skin = ['#d9a36f', '#9b694a', '#c18c61', '#e7b681', '#80533c'][p.id % 5];
  rect(c, shorts, x - 5, y - 1, 10, 5);
  rect(c, '#e7e1c6', x - 5, y + 3, 3, 4 + stride);
  rect(c, '#e7e1c6', x + 2, y + 3, 3, 4 - stride);
  rect(c, '#25382a', x - 6, y + 6 + stride, 4, 3); rect(c, '#25382a', x + 2, y + 6 - stride, 4, 3);
  rect(c, skin, x - 8, y - 10 - stride, 3, 7); rect(c, skin, x + 5, y - 10 + stride, 3, 7);
  rect(c, kit, x - 6, y - 13, 12, 12); rect(c, kit, x - 8, y - 12, 16, 5);
  if (team.symbol === 'stripe' && !p.keeper) rect(c, team.secondary, x - 1, y - 13, 3, 12);
  rect(c, skin, x - 4, y - 20, 8, 8); rect(c, '#3c3327', x - 4, y - 21, 8, 3);
  if (p.faceY > 0) { rect(c, '#3c3327', x - 2, y - 16, 1, 1); rect(c, '#3c3327', x + 2, y - 16, 1, 1); }
  else if (p.faceY < 0) rect(c, '#3c3327', x - 4, y - 21, 8, 7);
  else rect(c, '#3c3327', x + (p.faceX > 0 ? 3 : -4), y - 16, 1, 1);
  if (p.stun) { rect(c, '#ffe697', x - 10, y - 20, 3, 3); rect(c, '#ffe697', x + 9, y - 16, 3, 3); }
}

export function createRenderer(canvas: HTMLCanvasElement) {
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not open the pitch. Try a browser with Canvas support.');
  const stadium = makeStadium();
  const trail: [number, number][] = [];
  return (s: MatchState, demo = false) => {
    ctx.imageSmoothingEnabled = false; ctx.drawImage(stadium, 0, 0);
    const bx = Math.round(s.ball.x / UNIT), by = Math.round(s.ball.y / UNIT);
    if (s.ball.owner === -1 && s.phase === 'playing') {
      trail.push([bx, by]); if (trail.length > 5) trail.shift();
      trail.forEach(([x, y], i) => { ctx.globalAlpha = i * 0.09; rect(ctx, '#fff2c5', x - 2, y - 2, 4, 4); });
      ctx.globalAlpha = 1;
    } else trail.length = 0;
    for (const p of [...s.players].sort((a, b) => a.y - b.y)) player(ctx, p, s, !demo && p.id === s.selected);
    rect(ctx, PALETTE.shadow, bx - 3, by + 4, 8, 3);
    rect(ctx, '#f7f2d9', bx - 4, by - 4, 8, 8); rect(ctx, '#f7f2d9', bx - 5, by - 2, 10, 4);
    rect(ctx, '#384634', bx - 1, by - 1, 3, 3); rect(ctx, '#384634', bx - 4, by + 1, 2, 2); rect(ctx, '#384634', bx + 2, by - 4, 2, 2);
    if (!demo) {
      const p = s.players[s.selected];
      ctx.fillStyle = '#fff2c5'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      ctx.fillText('YOU', Math.round(p.x / UNIT), Math.round(p.y / UNIT) + 23);
    }
  };
}
