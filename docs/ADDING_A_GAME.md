# Adding a New Game to the Platform

Follow these steps to integrate a new game into the platform:

1. **Create Package**:
   Create a new directory in \`packages/games/<game-id>\` with a \`package.json\` depending on \`@metroville/game-sdk: "workspace:*\`".

2. **Implement \`GameModule\` Interface**:
   - Provide a \`GameManifest\` specifying name, min/max players, variants, and config schemas.
   - Implement:
     - \`createInitialState(config, players, seed)\`
     - \`validateAction(state, action, playerId)\`
     - \`applyAction(state, action)\`
     - \`getPlayerView(state, playerId)\`
     - \`isGameOver(state)\`
     - \`computeResult(state)\`
     - (Optional) \`createBot(difficulty)\`

3. **Provide Unit Tests**:
   Write Vitest tests verifying state transitions, action validations, and terminal condition detection.

4. **Register in Platform**:
   Add the game module to the platform game registry (\`apps/platform/src/lib/gameRegistry.ts\`).
