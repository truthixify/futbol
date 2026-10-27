import type { Difficulty } from './engine';
import { TEAMS } from './teams';

export interface CupProgress { team: string; opponents: string[]; round: number; wins: number; difficulty: Difficulty; completed: boolean }
export interface SavedProgress { played: number; won: number; goals: number; cups: number; cup: CupProgress | null }
export const emptyProgress = (): SavedProgress => ({ played: 0, won: 0, goals: 0, cups: 0, cup: null });

export function parseProgress(raw: string | null): SavedProgress {
  try {
    if (!raw) return emptyProgress();
    const data = JSON.parse(raw);
    if (!data || ['played', 'won', 'goals', 'cups'].some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)) return emptyProgress();
    if (data.cup) {
      const cup = data.cup;
      const validTeam = (id: unknown) => TEAMS.some(t => t.id === id);
      if (!validTeam(cup.team) || !Array.isArray(cup.opponents) || cup.opponents.length !== 3 || !cup.opponents.every(validTeam) || cup.opponents.includes(cup.team)
        || new Set(cup.opponents).size !== 3 || !Number.isInteger(cup.round) || cup.round < 0 || cup.round > 2 || !Number.isInteger(cup.wins) || cup.wins < 0 || cup.wins > 3
        || !['easy', 'normal', 'hard'].includes(cup.difficulty) || typeof cup.completed !== 'boolean') data.cup = null;
    }
    return { played: data.played, won: data.won, goals: data.goals, cups: data.cups, cup: data.cup ?? null };
  } catch { return emptyProgress(); }
}

export function loadProgress(): SavedProgress {
  try { return parseProgress(localStorage.getItem('futbol:progress:v1')); } catch { return emptyProgress(); }
}
export function saveProgress(progress: SavedProgress): boolean {
  try { localStorage.setItem('futbol:progress:v1', JSON.stringify(progress)); return true; } catch { return false; }
}
export function createCup(team: string, difficulty: Difficulty): CupProgress {
  const others = TEAMS.filter(t => t.id !== team).map(t => t.id);
  return { team, opponents: [others[0], others[3], others[6]], round: 0, wins: 0, difficulty, completed: false };
}
export function advanceCup(cup: CupProgress): CupProgress {
  return { ...cup, round: Math.min(2, cup.round + 1), wins: cup.wins + 1, completed: cup.round === 2 };
}
