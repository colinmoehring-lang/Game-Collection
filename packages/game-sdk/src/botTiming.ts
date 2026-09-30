/** Base delay before a bot submits an action (ms). */
export const BOT_ACTION_DELAY_MS = 1600;

/** MetroVille: extra delay per board step after a dice roll (ms). */
export const BOT_METRO_MOVE_STEP_DELAY_MS = 260;

/** MetroVille: auto-dismiss drawn card for bots (ms). */
export const BOT_METRO_CARD_DISMISS_MS = 3200;

/** If a bot turn makes no progress within this window, force a safe fallback action (ms). */
export const BOT_TURN_WATCHDOG_MS = 14_000;