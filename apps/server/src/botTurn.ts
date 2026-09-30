import {
  BOT_ACTION_DELAY_MS,
  BOT_METRO_CARD_DISMISS_MS,
  BOT_METRO_MOVE_STEP_DELAY_MS,
  BOT_TURN_WATCHDOG_MS
} from '@metroville/game-sdk';

export {
  BOT_ACTION_DELAY_MS,
  BOT_METRO_CARD_DISMISS_MS,
  BOT_METRO_MOVE_STEP_DELAY_MS,
  BOT_TURN_WATCHDOG_MS
};

export function metroMoveStepCount(before: any, after: any): number {
  if (!before?.lastRollerId || before.lastRollerId !== after.lastRollerId) {
    const rollerId = after.lastRollerId;
    const beforePlayer = before.players?.find((p: any) => p.id === rollerId);
    const afterPlayer = after.players?.find((p: any) => p.id === rollerId);
    if (beforePlayer && afterPlayer && beforePlayer.position !== afterPlayer.position) {
      const from = beforePlayer.position;
      const to = afterPlayer.position;
      const forward = (to - from + 40) % 40;
      const backward = (from - to + 40) % 40;
      const steps = after.dice?.[0] + after.dice?.[1] || forward;
      if (forward <= steps && forward > 0) return forward;
      if (backward > 0 && backward < forward) return backward;
      return 1;
    }
  }
  return 0;
}

export function computeBotActionDelay(gameId: string, before: any, after: any): number {
  let delay = BOT_ACTION_DELAY_MS;
  if (gameId === 'metroville' && before && after) {
    delay += metroMoveStepCount(before, after) * BOT_METRO_MOVE_STEP_DELAY_MS;
    if (after.phase === 'card_reveal') {
      delay += BOT_METRO_CARD_DISMISS_MS;
    }
  }
  return delay;
}

export function metroBotFallbackAction(state: any): { type: string } | null {
  if (!state) return null;
  if (state.phase === 'card_reveal') return { type: 'DISMISS_CARD' };
  if (state.phase === 'turn_end') return { type: 'END_TURN' };
  if (state.phase === 'tile_action') return { type: 'DECLINE_BUY_PROPERTY' };
  if (state.phase === 'auction') return { type: 'PASS_AUCTION' };
  if (state.phase === 'roll') return { type: 'ROLL_DICE' };
  return null;
}
