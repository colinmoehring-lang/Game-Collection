import { METRO_DICE_ROLL_MS, METRO_MOVE_STEP_MS } from './metroConstants.js';

export type DisplayPositions = Record<string, number>;

export interface MetroPresentationState {
  displayPositions: DisplayPositions;
  diceDisplay: [number, number];
  diceRolling: boolean;
  movementLocked: boolean;
  pendingRuntime: any | null;
  hopTokenId: string | null;
}

export function createMetroPresentationState(): MetroPresentationState {
  return {
    displayPositions: {},
    diceDisplay: [1, 1],
    diceRolling: false,
    movementLocked: false,
    pendingRuntime: null,
    hopTokenId: null
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function boardPath(from: number, steps: number): number[] {
  const path: number[] = [];
  if (steps === 0) return path;
  const forward = steps > 0;
  const count = Math.abs(steps);
  for (let i = 1; i <= count; i++) {
    path.push(forward ? (from + i) % 40 : (from - i + 40) % 40);
  }
  return path;
}

function inferMoveSteps(before: any, after: any, rollerId: string | null): { playerId: string; from: number; steps: number; teleport: boolean } | null {
  if (!rollerId) return null;
  const beforePlayer = before.players.find((p: any) => p.id === rollerId);
  const afterPlayer = after.players.find((p: any) => p.id === rollerId);
  if (!beforePlayer || !afterPlayer) return null;
  if (beforePlayer.position === afterPlayer.position) return null;

  const from = beforePlayer.position;
  const to = afterPlayer.position;
  const diceSum = after.dice[0] + after.dice[1];
  const forward = (to - from + 40) % 40;
  const backward = (from - to + 40) % 40;

  if (forward === diceSum && diceSum > 0) {
    return { playerId: rollerId, from, steps: diceSum, teleport: false };
  }
  if (backward > 0 && backward <= 3) {
    return { playerId: rollerId, from, steps: -backward, teleport: false };
  }
  return { playerId: rollerId, from, steps: 0, teleport: true };
}

export async function syncMetroPresentation(
  presentation: MetroPresentationState,
  previousRuntime: any | null,
  nextRuntime: any,
  onFrame: () => void
): Promise<any> {
  if (!previousRuntime) {
    nextRuntime.players.forEach((player: any) => {
      presentation.displayPositions[player.id] = player.position;
    });
    presentation.diceDisplay = [...nextRuntime.dice];
    presentation.pendingRuntime = null;
    presentation.movementLocked = false;
    return nextRuntime;
  }

  const diceChanged = previousRuntime.dice[0] !== nextRuntime.dice[0]
    || previousRuntime.dice[1] !== nextRuntime.dice[1];

  if (diceChanged && !prefersReducedMotion()) {
    presentation.diceRolling = true;
    presentation.movementLocked = true;
    onFrame();
    const target: [number, number] = [nextRuntime.dice[0], nextRuntime.dice[1]];
    const ticks = Math.max(4, Math.round(METRO_DICE_ROLL_MS / 120));
    for (let i = 0; i < ticks; i++) {
      presentation.diceDisplay = [
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6)
      ];
      onFrame();
      await sleep(METRO_DICE_ROLL_MS / ticks);
    }
    presentation.diceDisplay = target;
    presentation.diceRolling = false;
    onFrame();
  } else if (diceChanged) {
    presentation.diceDisplay = [...nextRuntime.dice];
  }

  const rollerId = nextRuntime.lastRollerId;
  const move = inferMoveSteps(previousRuntime, nextRuntime, rollerId);

  if (move && !move.teleport && move.steps !== 0 && !prefersReducedMotion()) {
    presentation.movementLocked = true;
    onFrame();
    const path = boardPath(move.from, move.steps);
    let pos = move.from;
    presentation.displayPositions[move.playerId] = pos;
    for (const step of path) {
      pos = step;
      presentation.displayPositions[move.playerId] = pos;
      presentation.hopTokenId = move.playerId;
      onFrame();
      presentation.hopTokenId = null;
      await sleep(METRO_MOVE_STEP_MS);
    }
  } else {
    nextRuntime.players.forEach((player: any) => {
      presentation.displayPositions[player.id] = player.position;
    });
  }

  presentation.pendingRuntime = null;
  presentation.movementLocked = false;
  return nextRuntime;
}

export function getDisplayPosition(presentation: MetroPresentationState, playerId: string, fallback: number): number {
  return presentation.displayPositions[playerId] ?? fallback;
}
