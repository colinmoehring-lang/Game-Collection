import type { GameModule } from '@metroville/game-sdk';
import { MetrovilleModule } from '@metroville/game-metroville';
import { MenschAergereDichNichtModule } from '@metroville/game-mensch';
import { TicTacToeModule } from '@metroville/game-tictactoe';
import { TexasHoldemModule } from '@metroville/game-texasholdem';
import { FiveCardDrawModule } from '@metroville/game-texasholdem';

export const GAME_REGISTRY: Record<string, GameModule<any, any>> = {
  [TicTacToeModule.manifest.id]: TicTacToeModule,
  [MetrovilleModule.manifest.id]: MetrovilleModule,
  [MenschAergereDichNichtModule.manifest.id]: MenschAergereDichNichtModule,
  [TexasHoldemModule.manifest.id]: TexasHoldemModule,
  [FiveCardDrawModule.manifest.id]: FiveCardDrawModule
};

export function getAvailableGames() {
  return Object.values(GAME_REGISTRY).map(m => m.manifest);
}

export function getGameModule(gameId: string) {
  return GAME_REGISTRY[gameId] || null;
}
