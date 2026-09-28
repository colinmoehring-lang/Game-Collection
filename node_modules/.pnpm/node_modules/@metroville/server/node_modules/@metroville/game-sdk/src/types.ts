export interface Player {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  isHost?: boolean;
  isBot?: boolean;
  isConnected?: boolean;
}

export interface GameVariant {
  id: string;
  name: string;
  description: string;
  defaultConfig?: Record<string, unknown>;
}

export type SettingType = 'boolean' | 'number' | 'select';

export interface GameSettingSchema {
  id: string;
  name: string;
  description?: string;
  type: SettingType;
  default: boolean | number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string | number }>;
}

export interface GameManifest {
  id: string;
  name: string;
  description: Record<string, string>; // locale -> text
  minPlayers: number;
  maxPlayers: number;
  estimatedDurationMinutes: [number, number];
  coverArtwork?: string;
  variants: GameVariant[];
  settings: GameSettingSchema[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface GameResult {
  winnerId?: string | null; // null = draw / tie
  scores?: Record<string, number>;
  rankings?: string[]; // player IDs in order 1st, 2nd, etc.
  reason?: string;
}

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface BotStrategy<TState, TAction> {
  chooseAction(state: TState, playerId: string): Promise<TAction> | TAction;
}

export interface GameModule<TState, TAction, TConfig = Record<string, unknown>> {
  manifest: GameManifest;
  createInitialState(config: TConfig, players: Player[], seed: string): TState;
  validateAction(state: TState, action: TAction, playerId: string): ValidationResult;
  applyAction(state: TState, action: TAction): TState;
  getPlayerView(state: TState, playerId: string): unknown;
  isGameOver(state: TState): boolean;
  computeResult(state: TState): GameResult;
  createBot?(difficulty?: BotDifficulty): BotStrategy<TState, TAction>;
}
