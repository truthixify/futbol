# Match audio

`goal-call.mp3` is a real human goal shout from ["goal shout.mp3" by polmdx](https://freesound.org/people/polmdx/sounds/219873/), published on Freesound on 20 February 2014 under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). The author describes recording it at Universitat Pompeu Fabra. Attribution is also available in the game's How to play dialog.

The bundled adaptation uses the author's [HQ preview](https://cdn.freesound.org/previews/219/219873_4071086-hq.mp3). Changes: trimmed leading/trailing silence (0.18–2.43 seconds), lowered volume by 2 dB, added an 80 ms fade-out, and converted to mono MP3 at 44.1 kHz / 128 kbps. The natural voice's pitch and timing are unchanged. The recording ships with the game; playback does not contact Freesound or a speech service.

Ball contact, kicks, gloves, rebounds, whistles, claps, and the crowd swell are original Web Audio synthesis in `src/game/audio.ts`. Mixing and randomness only affect sound. They never change the game simulation.

Sound begins after a play/input gesture. The speaker button mutes everything immediately; pausing stops active sounds. The game remains playable if audio is unavailable. If the voice file cannot load, only the crowd effects play; there is no synthesized voice fallback.
