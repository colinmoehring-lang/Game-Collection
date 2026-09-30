/** Duration of the dice roll animation (ms). */
export const METRO_DICE_ROLL_MS = 900;

/** Duration per board step during token movement (ms). */
export const METRO_MOVE_STEP_MS = 260;

/** Auto-hide card overlay for bots (display only; server uses BOT_METRO_CARD_DISMISS_MS). */
export const METRO_CARD_HUMAN_DISMISS_MS = 0;

/** Bot card overlay display time on clients watching bots. */
export const METRO_CARD_BOT_OVERLAY_MS = 3200;

/** How long each game event toast stays visible (ms). Keep <= bot action delay. */
export const METRO_EVENT_TOAST_MS = 1500;

/** Max queued event toasts; older ones are dropped if the queue grows beyond this. */
export const METRO_EVENT_TOAST_QUEUE_MAX = 4;