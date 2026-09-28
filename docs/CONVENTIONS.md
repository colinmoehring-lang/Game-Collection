# MetroVille & Game Collection – Architecture & Conventions

## Code Conventions
- Monorepo structure managed by \`pnpm\` workspaces and \`turbo\`.
- All game logic modules belong under \`packages/games/<gamename>\`.
- All shared interfaces belong in \`packages/game-sdk\`.
- Pure game logic: Game engines must not import DOM, Node-specific packages, or browser APIs.
- State machines: All state transitions are modeled through \`createInitialState\`, \`validateAction\`, and \`applyAction\`.
- Randomness: All PRNG calls must accept or use a seed to guarantee deterministic replaying.

## Styling & Art Direction (Option C: Mid-Century Modern)
- Primary fonts: \`Syne\` (700/800) for Display, \`DM Sans\` (300/500) for body, \`DM Mono\` (400/500) for tables and stats.
- Palette:
  - Terracotta: \`#C84B2F\`
  - Teal: \`#1D7A72\`
  - Mustard: \`#D4930A\`
  - Sky Blue: \`#3B7FC4\`
  - Sand background: \`#F7F0E3\`
  - Paper card background: \`#EEE4CE\`
