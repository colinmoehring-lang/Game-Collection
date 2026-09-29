# MetroVille & Game Collection – Architecture & Conventions

## Code Conventions
- Monorepo structure managed by \`pnpm\` workspaces and \`turbo\`.
- All game logic modules belong under \`packages/games/<gamename>\`.
- All shared interfaces belong in \`packages/game-sdk\`.
- Pure game logic: Game engines must not import DOM, Node-specific packages, or browser APIs.
- State machines: All state transitions are modeled through \`createInitialState\`, \`validateAction\`, and \`applyAction\`.
- Randomness: All PRNG calls must accept or use a seed to guarantee deterministic replaying.
- MetroVille state stores `seed` and `randomIndex`; action application must derive random values from these fields and must not use `Math.random()`.
- State transitions return copied player, property, auction, trade and log data so applying an action does not mutate the previous state.
- Actions that are planned for a later stage must be rejected by `validateAction` instead of silently changing nothing.
- Trade offers receive deterministic `trade-N` IDs from state and must be validated for ownership, balances, target player and duplicate properties before they are stored.
- Server room turn state mirrors the active auction bidder; reconnects must remap session IDs in player order, runtime players, properties and pending trades.

## Styling & Art Direction (Option C: Mid-Century Modern)
- Primary fonts: \`Syne\` (700/800) for Display, \`DM Sans\` (300/500) for body, \`DM Mono\` (400/500) for tables and stats.
- Palette:
  - Terracotta: \`#C84B2F\`
  - Teal: \`#1D7A72\`
  - Mustard: \`#D4930A\`
  - Sky Blue: \`#3B7FC4\`
  - Sand background: \`#F7F0E3\`
  - Paper card background: \`#EEE4CE\`

## MetroVille UI
- The board uses an 11x11 CSS grid with the 40 fields arranged around the outside ring; the center is reserved for turn context and event messaging.
- The platform renderer keeps game-specific DOM under a dedicated `game-surface` and sends only typed action payloads through the authoritative room.
- Desktop uses a board/sidebar composition; below 900px the sidebar stacks below the board and below 620px tile content collapses to stable compact labels.
- Sound is optional and must fail silently when browser audio is blocked; user mute and volume preferences are persisted locally.
- State feedback uses short, meaningful animations only; every animation must have a `prefers-reduced-motion: reduce` fallback.
- Interactive controls require visible `:focus-visible` styles, semantic labels/live regions and a non-color-only fallback through text, borders or patterns.
