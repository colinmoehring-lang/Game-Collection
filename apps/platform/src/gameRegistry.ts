import type { GameModule } from '@metroville/game-sdk';
import { TicTacToeModule } from '@metroville/game-tictactoe';

export const GAME_REGISTRY: Record<string, GameModule<any, any>> = {
  [TicTacToeModule.manifest.id]: TicTacToeModule
};

export function getAvailableGames() {
  return Object.values(GAME_REGISTRY).map(m => m.manifest);
}

export function getGameModule(gameId: string) {
  return GAME_REGISTRY[gameId] || null;
}
