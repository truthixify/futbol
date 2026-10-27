# Futbol

A small, playable five-a-side football game for the browser. Original pixel artwork, two-minute matches, eight fictional clubs, and a three-round Sunday Cup.

## Run

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. No wallet, account, or external service is needed for this local build. All art, audio, and fonts are included or generated locally.

```sh
npm test          # Gameplay, deterministic replay, and saved cup tests
npm run build    # Type check and build the static client into dist/
npm run preview  # Serve the production build locally
```

## Play

- Move and aim: WASD or arrow keys.
- Pass / switch defender: J or Z.
- Shoot / tackle: K, X, or Space.
- Pause: Escape or P. Leaving the tab pauses an active match.
- Touch: use the joystick and A/B buttons. Landscape fullscreen gives the pitch more space.

You control the player marked **YOU**. Pass to switch to the receiver; your other players and goalkeeper move automatically. The receiver briefly meets your pass if you keep holding the pass direction or release the controls. Change direction to take over immediately. Aim up or down when shooting to choose a corner. Side and end walls rebound the ball, except at the goal mouths.

Choose **Easy**, **Normal**, or **Hard** before kickoff. These change opponent movement speed, goalkeeper reaction time and reach, shot accuracy, and tackle timing. Easy gives defenders and the keeper a 0.2-second reaction window. Opponents still track runners, meet passes, tackle, and attack; open shots from nearer the box are much more effective than long shots. Your player's speed, shot power, and goal size stay the same.

Quick Match ends after two minutes of playing time. Cup draws use golden goal. Win a quarter-final, semi-final, and final to earn a cup. Results and the next cup round save in this browser. An unfinished individual match is not restored after reloading. Leaving a cup match preserves its round so it can be replayed.

At full time, watch the complete input replay or download it as JSON. These are local, unsigned replays.

Sound starts with your first play gesture. Goals include a bundled **real human goal shout** by [polmdx](https://freesound.org/people/polmdx/sounds/219873/) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), trimmed and mixed over a quieter crowd swell and applause. Passes, shots, dribbles, tackles, saves, rebounds, and whistles each have their own sound. Use the speaker button above the pitch to mute. See [audio provenance](src/assets/audio/README.md).

## Layout

```text
src/game/engine.ts          Pure integer simulation and input replay
src/game/engine.test.ts     Rules, replay, difficulty, and progress checks
src/game/render.ts          Original procedural Canvas pixel artwork
src/game/audio.ts           Procedural match sounds
src/game/teams.ts           Fictional clubs and kit colors
src/game/storage.ts         Validated local results and cup persistence
src/components/             Canvas lifecycle and touch input
src/App.tsx                 Clubhouse, match, cup, and result flows
docs/architecture.md       UTXOPlay reference research and integration boundary
```

## UTXOPlay status

The first playable slice runs locally and builds as a standalone static client. It is **not published on UTXOPlay**, and does not yet implement its authenticated host adapter, Rust/Myelin verifier, wallet libraries, or online matches.

The engine follows the author's separation of simulation, browser presentation, and recorded input, so those integrations can be added without putting platform authentication into the renderer. The specific reference repositories and the remaining integration work are documented in [docs/architecture.md](docs/architecture.md).
