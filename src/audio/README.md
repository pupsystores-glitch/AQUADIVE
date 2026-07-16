# src/audio

Audio system.

## Responsibility

Event-driven sound: an AudioManager wrapping WebAudio with channel groups
(music / sfx / ambience), per-channel volume and mute persistence, mobile
unlock-on-first-gesture, and depth-based ambience.

## Boundaries

- Purely reactive: subscribes to engine events (`round:crashed`,
  `cashout:confirmed`, …); no other system ever calls into audio directly.
- No game state, no rendering, no React.

## Planned contents (per the approved architecture blueprint)

AudioManager, channel groups, sound-bank manifest (roadmap Phase 7 /
refactor Stage 3 of milestone M3).
