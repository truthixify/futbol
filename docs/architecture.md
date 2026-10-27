# Simulation and the UTXOPlay boundary

## Reference repositories inspected

The UTXOPlay author maintains independently hosted games. The following READMEs and implementation guides were read before building this first slice:

- [myelin-arcade README](https://github.com/UTXOPlay/myelin-arcade/blob/main/README.md): independent browser/native packages, per-account storage, signed guest identity, separate web and native builds.
- [Arcade browser engine](https://github.com/UTXOPlay/myelin-arcade/blob/main/games/arcade/web/engine.mjs) and [Rust session adapter](https://github.com/UTXOPlay/myelin-arcade/blob/main/games/arcade/src/session.rs): a 30 Hz integer input tape, browser prediction, native execution, and a pinned application profile.
- [myelin-sling README](https://github.com/UTXOPlay/myelin-sling/blob/main/README.md): the same standalone hosting boundary and immutable engine/verifier pair for signed exports.
- [myelin-teeworlds README](https://github.com/UTXOPlay/myelin-teeworlds/blob/master/README.md): a private runtime behind an authenticated web host. This repository uses `master`.
- [OpenStrike runtime guide](https://github.com/UTXOPlay/myelin-openstrike/blob/main/docs/RUNTIME.md): effective inputs recorded each tick, full native match replay, and an explicit distinction between host replay verification and blockchain settlement.
- [UTXOPlay vendor hosting](https://github.com/UTXOPlay/UTXOPlay/blob/main/vendor/README.md): game-owned HTTPS origins, launch tickets, account isolation, and a vendor-operated Myelin runtime.

No code or assets were copied from those games. Futbol's art, simulation, and controls are original.

## Implemented in this version

The simulation in `engine.ts` is independent of React, Canvas, the wall clock, and storage. It advances at 30 ticks per second. Positions and velocities use integers with sixteen units per pixel. The six input bits are left, right, up, down, pass, and shoot. Touch movement is quantized to the same directions as the keyboard.

The initial seed and configuration plus the input sequence reproduce the complete simulation, including AI and shot variation. A seeded Park–Miller generator supplies gameplay randomness. Rendering has its own procedural details and cannot change the result. Tests replay entire matches and compare the full state.

The Canvas loop uses a fixed-step accumulator. Pausing, tab hiding, and help dialogs stop simulation time. Short button presses are buffered so a tap between ticks is preserved. The HUD updates at 10 Hz; it does not drive the simulation. The attraction match stops for reduced-motion preferences.

Saved results and cup rounds use versioned browser-local storage with validation and recovery for malformed data. There are no claims of server authority or tamper resistance for this local prototype.

## Next platform integration

1. Port the small simulation to a native Rust crate, preserving integer rounding, input edges, randomness, and rule version. Establish tick-by-tick parity against the browser with shared replay fixtures before using it to verify results.
2. Add an authoritative game host and account-scoped state. Implement the `state`, `new`, `action`, `export`, and `replay` contract through the actual Myelin session runtime. Keep runtime and signing secrets on the server.
3. Pin the native engine, profile, lockfile, and verifier pair for each rules version. Retain the old pair for old signed matches.
4. Add UTXOPlay's scoped launch-ticket adapter and private service authentication. Do not trust a browser-supplied player identifier or assume guest progress becomes wallet progress automatically.
5. For private online matches, record both players' effective input in a server-ordered tape. Add timeout/reconnection behavior and a deterministic policy for missing input. Test prediction and reconciliation before exposing competitive results.

The first build deliberately has no placeholder wallet buttons, invented Myelin signatures, fabricated online opponents, or public deployment configuration. Live player testing should establish passing, possession, controls, and match pacing before the native rules are pinned.
