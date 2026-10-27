import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, CircleHelp, Download, Flag, Maximize2, Pause, Play, RotateCcw, Shield, Trophy, Volume2, VolumeX, X } from 'lucide-react';
import GameCanvas, { type Controller, type GameSession, type Hud } from './components/GameCanvas';
import TouchControls from './components/TouchControls';
import { createMatch, DIFFICULTIES, type Difficulty, type MatchState, type Replay } from './game/engine';
import { MatchAudio } from './game/audio';
import { advanceCup, createCup, loadProgress, saveProgress, type CupProgress } from './game/storage';
import { getTeam, TEAMS, type Team } from './game/teams';

const ROUNDS = ['Quarter-final', 'Semi-final', 'The final'];
const INITIAL_HUD: Hud = { score: [0, 0], remaining: 120, phase: 'kickoff', countdown: 2, overtime: false, event: null, tick: 0 };
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

function BallMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'ball-mark small' : 'ball-mark'} viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" d="M15 2h10v3h6v6h4v6h3v9h-4v6h-7v5H14v-4H7v-7H3V15h4V8h8z"/><path fill="var(--paper)" d="m20 12 8 6-3 9H15l-3-9zm-7-7h12v5H13zM5 17h5v9H5zm25 0h5v9h-5zM12 30h7v5h-7zm10 0h7v5h-7z"/></svg>;
}

function Crest({ team, small = false }: { team: Team; small?: boolean }) {
  const style = { '--kit': team.color, '--kit-dark': team.dark, '--kit-secondary': team.secondary } as CSSProperties;
  return <div className={`crest ${small ? 'small' : ''}`} style={style} aria-hidden="true"><svg viewBox="0 0 60 68"><path d="M4 4h52v36c0 13-26 24-26 24S4 53 4 40Z" fill="var(--kit)" stroke="var(--kit-dark)" strokeWidth="3"/><path d="M9 10h42v7H9z" fill="var(--kit-dark)"/><text x="30" y="15" textAnchor="middle" fill="var(--kit)" fontSize="6" fontFamily="monospace" fontWeight="bold">{team.short} FC</text>{team.symbol === 'star' ? <path d="m30 23 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1Z" fill="var(--kit-dark)"/> : team.symbol === 'wave' ? <><path d="M13 31q9-10 17 0t17 0M13 40q9-10 17 0t17 0" fill="none" stroke="var(--kit-dark)" strokeWidth="5"/></> : team.symbol === 'stripe' ? <><path d="M19 24v27m11-27v33m11-33v27" stroke="var(--kit-dark)" strokeWidth="6"/></> : <><circle cx="30" cy="37" r="9" fill="var(--kit-dark)"/><path d="M30 23v-4m0 36v-4M16 37h-4m36 0h-4M20 27l-3-3m26 26-3-3m0-20 3-3M17 50l3-3" stroke="var(--kit-dark)" strokeWidth="3"/></>}</svg></div>;
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="help-dialog" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-heading"><span className="eyebrow">A MINUTE TO LEARN</span><button className="icon-button" onClick={onClose} aria-label="Close controls"><X size={20}/></button></div>
    <h2>Feet first.</h2><p>You're the player with the arrow. Your teammates find space, and your keeper takes care of the goal.</p>
    <div className="help-row"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><small>or arrow keys</small></span><div><strong>Move & aim</strong><p>Dribble into space. Move up or down as you shoot to pick a corner.</p></div></div>
    <div className="help-row"><span><kbd>J</kbd><small>or Z · touch A</small></span><div><strong>Pass / switch</strong><p>Aim toward a teammate and pass. Without the ball, switch to a nearby defender.</p></div></div>
    <div className="help-row"><span><kbd>K</kbd><small>or Space · touch B</small></span><div><strong>Shoot / tackle</strong><p>Shoot toward the other goal. Get close to an opponent to win the ball back.</p></div></div>
    <div className="help-row"><span><kbd>Esc</kbd><small>or P</small></span><div><strong>Take a breather</strong><p>Pause whenever you need. The match also pauses when you leave this tab.</p></div></div>
    <div className="rules-note"><Flag size={18}/><p>Two-minute games. The ball rebounds off the sidelines. Cup draws go to golden goal: next goal wins.</p></div>
    <p className="sound-credit">Goal shout: <a href="https://freesound.org/people/polmdx/sounds/219873/" target="_blank" rel="noreferrer">“goal shout.mp3” by polmdx</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Trimmed and mixed for the game.</p>
    <button className="primary-button" onClick={onClose}>Got it. Let's play. <ArrowRight size={18}/></button>
  </dialog>;
}

export default function App() {
  const [homeId, setHomeId] = useState('lagos');
  const [awayId, setAwayId] = useState('rio');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [mode, setMode] = useState<'quick' | 'cup'>('quick');
  const [progress, setProgress] = useState(loadProgress);
  const [activeCup, setActiveCup] = useState<CupProgress | null>(null);
  const [session, setSession] = useState<GameSession>(() => ({ id: 1, mode: 'demo', options: createMatch().options }));
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [help, setHelp] = useState(false);
  const [sound, setSound] = useState(true);
  const [result, setResult] = useState<{ state: MatchState; replay: Replay } | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [audio] = useState(() => new MatchAudio());
  const controller = useRef<Controller>({ touch: 0, held: new Set(), pulse: 0 });
  const arenaRef = useRef<HTMLElement>(null);
  const nextId = useRef(1);
  const home = getTeam(session.mode === 'demo' ? homeId : session.options.home);
  const away = getTeam(session.mode === 'demo' ? awayId : session.options.away);
  const inGame = session.mode === 'match' && !result;
  const watchingReplay = session.mode === 'replay';
  const lobby = session.mode === 'demo';
  const displayedScore = result && !watchingReplay ? result.state.score : hud.score;
  const displayedTime = result && !watchingReplay ? 0 : hud.remaining;
  const continuingCup = mode === 'cup' && !!progress.cup && !progress.cup.completed;
  const cupWins = progress.cup?.wins ?? activeCup?.wins ?? 0;

  useEffect(() => { audio.enabled = sound; }, [audio, sound]);
  useEffect(() => { setSaveError(!saveProgress(progress)); }, [progress]);
  useEffect(() => () => audio.close(), [audio]);

  const changeClub = (direction: number) => {
    const index = TEAMS.findIndex(t => t.id === homeId);
    const next = TEAMS[(index + direction + TEAMS.length) % TEAMS.length].id;
    const nextAway = next === awayId ? homeId : awayId;
    setHomeId(next); setAwayId(nextAway);
    setSession({ id: ++nextId.current, mode: 'demo', options: createMatch({ home: next, away: nextAway, difficulty }).options });
  };
  const changeOpponent = () => {
    const options = TEAMS.filter(t => t.id !== homeId);
    const next = options[(options.findIndex(t => t.id === awayId) + 1) % options.length].id;
    setAwayId(next);
    setSession({ id: ++nextId.current, mode: 'demo', options: createMatch({ home: homeId, away: next, difficulty }).options });
  };
  const start = (cup?: CupProgress) => {
    audio.unlock(); setResult(null); setPaused(false); setHud(INITIAL_HUD);
    setActiveCup(cup ?? null);
    const options = createMatch({ home: cup?.team ?? homeId, away: cup ? cup.opponents[cup.round] : awayId, difficulty: cup?.difficulty ?? difficulty, seed: Math.floor(Math.random() * 2147483646) + 1, goldenGoal: !!cup }).options;
    setSession({ id: ++nextId.current, mode: 'match', options });
    if (cup) setProgress(p => ({ ...p, cup }));
  };
  const kickOff = () => {
    if (mode === 'cup') {
      const saved = progress.cup;
      start(saved && !saved.completed ? saved : createCup(homeId, difficulty));
    } else start();
  };
  const chooseMode = (next: 'quick' | 'cup') => {
    setMode(next);
    const cup = progress.cup;
    if (next === 'cup' && cup && !cup.completed) {
      setHomeId(cup.team); setAwayId(cup.opponents[cup.round]); setDifficulty(cup.difficulty);
      setSession({ id: ++nextId.current, mode: 'demo', options: createMatch({ home: cup.team, away: cup.opponents[cup.round], difficulty: cup.difficulty }).options });
    }
  };
  const backToLobby = () => {
    setResult(null); setPaused(false); setActiveCup(null); setHud(INITIAL_HUD);
    setSession({ id: ++nextId.current, mode: 'demo', options: createMatch({ home: homeId, away: awayId, difficulty }).options });
  };
  const finish = useCallback((state: MatchState, replay: Replay) => {
    setResult({ state, replay });
    setProgress(p => {
      const won = state.winner === 0;
      const cup = activeCup ? won ? advanceCup(activeCup) : null : p.cup;
      return { played: p.played + 1, won: p.won + Number(won), goals: p.goals + state.score[0], cups: p.cups + Number(!!activeCup && activeCup.round === 2 && won), cup };
    });
  }, [activeCup]);
  const autoPause = useCallback(() => { setPaused(true); }, []);
  const togglePause = useCallback(() => { if (inGame) setPaused(p => !p); }, [inGame]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (help) return;
      if (e.code === 'Escape' || e.code === 'KeyP') { if (inGame) { e.preventDefault(); togglePause(); } }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [help, inGame, togglePause]);
  useEffect(() => { if (paused) { controller.current.held.clear(); controller.current.touch = 0; controller.current.pulse = 0; audio.stop(); } }, [paused, audio]);
  useEffect(() => {
    if (inGame && !paused && !help) arenaRef.current?.querySelector('canvas')?.focus({ preventScroll: true });
  }, [inGame, paused, help]);
  useEffect(() => {
    if (session.mode === 'match' && !result) arenaRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [session.id]);

  const showHelp = () => { if (inGame) setPaused(true); setHelp(true); };
  const toggleSound = () => {
    audio.enabled = !sound;
    if (!sound) audio.unlock();
    setSound(value => !value);
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (arenaRef.current?.requestFullscreen) await arenaRef.current.requestFullscreen();
      else setFullscreenError(true);
    } catch { setFullscreenError(true); }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.replay)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `futbol-${result.state.options.home}-${result.state.options.away}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const replay = () => {
    if (!result) return;
    setPaused(false); setHud(INITIAL_HUD);
    setSession({ id: ++nextId.current, mode: 'replay', options: result.replay.options, replay: result.replay });
  };
  const resultTitle = result ? activeCup && result.state.winner === 0 && activeCup.round === 2 ? 'CUP WINNERS!' : result.state.winner === 0 ? 'GET IN!' : result.state.winner === 1 ? 'NEXT ONE’S OURS.' : 'HONOURS EVEN.' : '';
  const winningGoal = hud.event?.type === 'goal' ? getTeam(hud.event.team === 0 ? session.options.home : session.options.away).name : '';

  return <div className="app-shell">
    <header className="site-header"><a className="wordmark" href="/" aria-label="Futbol home" onClick={e => { e.preventDefault(); if (inGame) setPaused(true); else backToLobby(); }}><BallMark/><span>futbol<span className="wordmark-dot">.</span></span></a><span className="header-caption">THE BEAUTIFUL LITTLE GAME</span><div className="header-actions"><button className="text-button" onClick={showHelp}><CircleHelp size={17}/><span>How to play</span></button></div></header>
    <main>
      <section className="intro"><div><div className="eyebrow"><span className="live-dot"/> LACE UP. LOG OFF FROM EVERYTHING ELSE.</div><h1>SMALL PITCH<span className="orange">.</span> BIG GAME<span className="orange">.</span></h1><p>A little old-school football. Just pick your club and play.</p></div><div className="intro-stamp"><span>5</span><div>A SIDE<br/><strong>ALL HEART.</strong></div><BallMark small/></div></section>
      <div className="game-layout">
        <aside className="clubhouse" aria-label="Match setup">
          <div className="sidebar-heading"><span className="eyebrow">THE CLUBHOUSE</span><span className="tiny-square"/></div>
          <div className="mode-switch" aria-label="Match mode"><button aria-pressed={mode === 'quick'} disabled={!lobby} className={mode === 'quick' ? 'selected' : ''} onClick={() => chooseMode('quick')}><Flag size={15}/>Quick match</button><button aria-pressed={mode === 'cup'} disabled={!lobby} className={mode === 'cup' ? 'selected' : ''} onClick={() => chooseMode('cup')}><Trophy size={15}/>Cup run</button></div>
          <span className="field-label">YOUR CLUB</span>
          <div className="club-picker"><button className="icon-button" aria-label="Previous club" disabled={!lobby || continuingCup} onClick={() => changeClub(-1)}><ChevronLeft size={20}/></button><Crest team={home}/><button className="icon-button" aria-label="Next club" disabled={!lobby || continuingCup} onClick={() => changeClub(1)}><ChevronRight size={20}/></button></div>
          <div className="club-name"><h2>{home.name}</h2><span className="eyebrow">{home.city}</span></div>
          {mode === 'quick' ? <div className="opponent-row"><div><span className="field-label">THE OPPOSITION</span><strong><span style={{ background: away.color }} className="kit-dot"/>{away.name}</strong></div><button className="icon-button" aria-label="Change opponent" disabled={!lobby} onClick={changeOpponent}><RotateCcw size={16}/></button></div> : <div className="cup-info"><div><Trophy size={16}/><strong>The Sunday Cup</strong></div><p>Three matches. One little trophy.</p><div className="cup-route">{['QF', 'SF', 'FINAL'].map((r, i) => <span key={r} className={cupWins > i ? 'won' : ''}>{cupWins > i ? <Check size={13}/> : r}</span>)}</div>{progress.cup && !progress.cup.completed && lobby && <p className="saved-cup">Continue {getTeam(progress.cup.team).name}'s {ROUNDS[progress.cup.round].toLowerCase()}.</p>}</div>}
          <fieldset className="difficulty" disabled={!lobby || (mode === 'cup' && !!progress.cup && !progress.cup.completed)}><legend className="field-label">DIFFICULTY</legend><div className="difficulty-options">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(level => <label key={level} className={difficulty === level ? 'active' : ''}><input type="radio" name="difficulty" value={level} checked={difficulty === level} onChange={() => setDifficulty(level)}/><span>{DIFFICULTIES[level].label}</span></label>)}</div><p>{DIFFICULTIES[difficulty].description}</p></fieldset>
          <div className="match-meta"><span><span className="meta-number">02:00</span> minutes</span><span><span className="meta-number">5 v 5</span> players</span></div>
          {lobby ? <button className="primary-button kick-off" onClick={kickOff}>{mode === 'cup' && progress.cup && !progress.cup.completed ? 'CONTINUE CUP' : 'LET’S PLAY'}<ArrowRight size={20}/></button> : <button className="primary-button kick-off" onClick={result ? backToLobby : togglePause}>{result ? 'BACK TO CLUBHOUSE' : paused ? 'BACK TO THE GAME' : 'TAKE A BREATHER'}{result ? <ArrowLeft size={18}/> : paused ? <Play size={18}/> : <Pause size={18}/>}</button>}
          <p className="setup-note"><span className="live-dot"/>{lobby ? 'No sign-up. Just football.' : watchingReplay ? 'Watch the match back.' : activeCup ? `SUNDAY CUP · ${ROUNDS[activeCup.round].toUpperCase()}` : 'YOU’RE PLAYING AT HOME'}</p>
          <div className="clubhouse-footer"><span>YOUR FORM</span><strong>{progress.played}<small>PLAYED</small></strong><strong>{progress.won}<small>WON</small></strong><strong>{progress.goals}<small>GOALS</small></strong></div>
        </aside>
        <section ref={arenaRef} className={`arena ${inGame ? 'is-playing' : ''}`} aria-label="Football game">
          <div className="arena-topline"><div><span className="live-dot"/><span>{watchingReplay ? 'MATCH REPLAY' : lobby ? 'THE SUNDAY GROUND' : activeCup ? `SUNDAY CUP · ${ROUNDS[activeCup.round].toUpperCase()}` : 'QUICK MATCH'}</span></div><div className="arena-tools"><button className="icon-button" onClick={toggleSound} aria-label={sound ? 'Mute match sound' : 'Enable match sound'} aria-pressed={sound}>{sound ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button><button className="icon-button" onClick={fullscreen} aria-label="Toggle fullscreen"><Maximize2 size={17}/></button></div></div>
          <div className="scoreboard"><div className="score-team home"><Crest team={home} small/><div><strong>{home.short}</strong><span>HOME{!lobby && !watchingReplay ? ' · YOU' : ''}</span></div></div><div className="score-center"><span className="score-value">{lobby ? '0' : displayedScore[0]}</span><div className="score-time"><span>{lobby ? 'FRIENDLY' : result && !watchingReplay ? 'FULL TIME' : hud.overtime ? 'GOLDEN GOAL' : watchingReplay ? 'REPLAY' : 'MATCH TIME'}</span><strong>{lobby ? '02:00' : hud.overtime && !result ? '+ EXTRA' : timeLabel(displayedTime)}</strong></div><span className="score-value">{lobby ? '0' : displayedScore[1]}</span></div><div className="score-team away"><div><strong>{away.short}</strong><span>AWAY · CPU</span></div><Crest team={away} small/></div></div>
          <div className="pitch-wrap">
            <GameCanvas session={session} paused={(paused || help || (!!result && !watchingReplay)) && !lobby} controller={controller} audio={audio} onHud={setHud} onFinish={finish} onPause={autoPause}/>
            {lobby && <div className="pitch-ready"><span><span className="live-dot"/>THE PITCH IS YOURS</span><strong>Nothing beats<br/>a kickabout.</strong><button onClick={kickOff}>Kick off <ArrowRight size={17}/></button></div>}
            {!lobby && !paused && !result && hud.phase === 'kickoff' && <div className="match-banner" role="status"><span>{hud.tick < 61 ? 'BOOTS ON. GAME ON.' : 'BACK TO THE CENTRE'}</span><strong>{hud.countdown > 0 ? hud.countdown : 'PLAY!'}</strong><p>Attack right <ArrowRight size={17}/></p></div>}
            {!lobby && !paused && (!result || watchingReplay) && hud.phase === 'goal' && <div className="match-banner goal-banner" role="status"><span>{winningGoal}</span><strong>GOOOAL!</strong><p>{hud.score[0]} — {hud.score[1]}</p></div>}
            {paused && inGame && <div className="pitch-overlay"><div className="pause-card"><span className="eyebrow">HALF AN ORANGE?</span><h2>TAKE A BREATHER.</h2><p>Your match is right where you left it.</p><button className="primary-button" onClick={() => setPaused(false)}>Keep playing <Play size={17}/></button><button className="text-button" onClick={showHelp}><CircleHelp size={16}/>Controls</button><button className="text-button quiet" onClick={backToLobby}>Leave match</button><small>Leaving ends this match. Your cup round stays saved.</small></div></div>}
            {result && !watchingReplay && <div className="pitch-overlay"><div className="result-card"><span className="eyebrow">{activeCup ? ROUNDS[activeCup.round].toUpperCase() : 'FULL TIME'}</span>{activeCup?.round === 2 && result.state.winner === 0 && <Trophy className="cup-trophy" size={38}/>}<h2>{resultTitle}</h2><div className="result-score"><Crest team={home} small/><strong>{result.state.score[0]} <span>:</span> {result.state.score[1]}</strong><Crest team={away} small/></div><div className="result-stats"><span>{result.state.shots[0]}<small>SHOTS</small>{result.state.shots[1]}</span><span>{result.state.passes[0]}<small>PASSES</small>{result.state.passes[1]}</span><span>{Math.round(result.state.possession[0] / Math.max(1, result.state.possession[0] + result.state.possession[1]) * 100)}%<small>POSSESSION</small>{100 - Math.round(result.state.possession[0] / Math.max(1, result.state.possession[0] + result.state.possession[1]) * 100)}%</span></div><button className="primary-button" onClick={() => activeCup && result.state.winner === 0 && activeCup.round < 2 && progress.cup ? start(progress.cup) : activeCup ? backToLobby() : start()}>{activeCup ? result.state.winner === 0 && activeCup.round < 2 ? 'ON TO THE NEXT ROUND' : 'BACK TO THE CLUBHOUSE' : 'ONE MORE MATCH'}<ArrowRight size={17}/></button><div className="result-links"><button className="text-button" onClick={replay}><RotateCcw size={15}/>Watch replay</button><button className="text-button" onClick={download}><Download size={15}/>Save replay</button></div></div></div>}
            {watchingReplay && <div className="replay-label"><span>{hud.phase === 'finished' ? 'REPLAY FINISHED' : 'MATCH REPLAY'}</span><button className="text-button" onClick={() => { setSession(s => ({ ...s, mode: 'match' })); setPaused(true); }}>Back to result <ArrowRight size={14}/></button></div>}
          </div>
          <div className="pitch-caption"><span><span className="kit-dot" style={{ background: home.color }}/>{lobby ? 'GOOD WEATHER. GREAT COMPANY.' : watchingReplay ? 'EVERY PASS. EVERY TACKLE. EVERY GOAL.' : 'YOU ATTACK RIGHT →'}</span><span>GRASS ROOTS. GOOD TIMES.</span></div>
          <TouchControls controller={controller} active={inGame && !paused && !help} unlock={() => audio.unlock()}/>
          <div className="keyboard-controls"><div><span className="arrow-keys"><kbd><ArrowUp size={11}/></kbd><span><kbd><ArrowLeft size={11}/></kbd><kbd><ArrowDown size={11}/></kbd><kbd><ArrowRight size={11}/></kbd></span></span><span><strong>Move & aim</strong><small>or WASD</small></span></div><div><kbd>J</kbd><span><strong>Pass / switch</strong><small>Find your teammate</small></span></div><div><kbd>K</kbd><span><strong>Shoot / tackle</strong><small>or Space</small></span></div><div><kbd>esc</kbd><span><strong>Pause</strong><small>Take a breather</small></span></div></div>
          {fullscreenError && <p className="inline-note">Fullscreen isn’t available here. Rotate your phone for a larger pitch.</p>}
        </section>
      </div>
      <section className="below-game"><div><span className="section-number">01 /</span><div><strong>Easy to pick up.</strong><p>Two buttons. A ball. You know the rest.</p></div></div><div><span className="section-number">02 /</span><div><strong>Always one more match.</strong><p>Two minutes to make yourself a local legend.</p></div></div><div><span className="section-number">03 /</span><div><strong>A little bit of the old days.</strong><p>For the love of the game. And the tiny pixels.</p></div></div></section>
      {saveError && <p className="inline-note" role="status">This browser couldn’t save your results. You can still play; progress will last until this tab closes.</p>}
    </main>
    <footer className="site-footer"><span><BallMark small/> MADE FOR THE LOVE OF THE GAME.</span><span><Shield size={13}/> {progress.cups ? `${progress.cups} SUNDAY CUP${progress.cups === 1 ? '' : 'S'} WON` : 'YOUR CLUB. YOUR LITTLE CORNER OF FOOTBALL.'}</span><span>FUTBOL © 2026</span></footer>
    {help && <HelpDialog onClose={() => setHelp(false)}/>}
    <div className="sr-only" aria-live="polite">{!lobby ? hud.phase === 'goal' ? `Goal! ${home.name} ${hud.score[0]}, ${away.name} ${hud.score[1]}.` : hud.phase === 'finished' ? `Full time. ${home.name} ${hud.score[0]}, ${away.name} ${hud.score[1]}.` : '' : ''}</div>
  </div>;
}
