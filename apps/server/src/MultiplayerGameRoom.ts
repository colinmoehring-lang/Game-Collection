import colyseus from 'colyseus';
import type { Client } from 'colyseus';
const { Room } = colyseus;
import { GameRoomState, PlayerSchema } from './schema/GameRoomState.js';
import { generateRoomCode, type GameModule, type Player } from '@metroville/game-sdk';
import {
  BOT_TURN_WATCHDOG_MS,
  computeBotActionDelay,
  metroBotFallbackAction
} from './botTurn.js';
import { MetrovilleModule } from '@metroville/game-metroville';
import { TicTacToeModule } from '@metroville/game-tictactoe';
import { TexasHoldemModule } from '@metroville/game-texasholdem';
import { FiveCardDrawModule } from '@metroville/game-texasholdem';

const GAME_MODULES: Record<string, GameModule<any, any>> = {
  [MetrovilleModule.manifest.id]: MetrovilleModule,
  [TicTacToeModule.manifest.id]: TicTacToeModule,
  [TexasHoldemModule.manifest.id]: TexasHoldemModule,
  [FiveCardDrawModule.manifest.id]: FiveCardDrawModule
};

const COLOR_PALETTE = ['#C84B2F', '#1D7A72', '#D4930A', '#3B7FC4', '#8E44AD', '#27AE60'];

export class MultiplayerGameRoom extends Room<GameRoomState> {
  maxClients = 8;
  private gameModule: GameModule<any, any> | null = null;
  private runtimeGameState: any = null;
  private botInstances: Map<string, any> = new Map();
  private gameStateRevision = 0;
  private botTurnTimer: ReturnType<typeof setTimeout> | null = null;
  private botWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private botTurnSnapshot: { playerId: string; phase: string; revision: number } | null = null;
  private botTurnRevision = 0;

  onCreate(options: any) {
    this.setState(new GameRoomState());

    const roomCode = options.roomCode || generateRoomCode();
    this.state.roomCode = roomCode;
    this.state.gameId = options.gameId || 'tictactoe';
    this.state.seed = 'seed-' + Math.random().toString(36).substring(2, 9);
    this.roomId = roomCode;

    this.gameModule = GAME_MODULES[this.state.gameId] || TicTacToeModule;

    console.log(`[Room ${roomCode}] Created with game ${this.state.gameId}`);

    // Message Handlers
    this.onMessage('SET_READY', (client, message: { ready: boolean }) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = !!message.ready;
      }
    });

    this.onMessage('SET_GAME_PRESET', (client, message: { preset: string }) => {
      const host = this.state.players.get(client.sessionId);
      const variants = this.gameModule?.manifest.variants || [];
      if (!host || !host.isHost || this.state.status !== 'lobby' || this.state.gameId !== 'metroville') return;
      if (!variants.some((variant) => variant.id === message.preset)) return;
      this.state.gamePreset = message.preset;
    });

    this.onMessage('ADD_BOT', (client) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost || this.state.status !== 'lobby') return;
      if (this.state.players.size >= (this.gameModule?.manifest.maxPlayers || this.maxClients)) return;

      const botId = 'bot-' + Math.random().toString(36).substring(2, 7);
      const botPlayer = new PlayerSchema();
      botPlayer.id = botId;
      botPlayer.name = `MetroBot ${this.state.players.size + 1}`;
      botPlayer.color = COLOR_PALETTE[this.state.players.size % COLOR_PALETTE.length];
      botPlayer.isBot = true;
      botPlayer.isReady = true;
      botPlayer.isConnected = true;

      this.state.players.set(botId, botPlayer);
      this.state.playerOrder.push(botId);

      if (this.gameModule && this.gameModule.createBot) {
        this.botInstances.set(botId, this.gameModule.createBot('medium'));
      }
    });

    this.onMessage('KICK_PLAYER', (client, message: { targetId: string }) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost || this.state.status !== 'lobby') return;

      const target = this.state.players.get(message.targetId);
      if (target && !target.isHost) {
        if (target.isBot) {
          this.state.players.delete(message.targetId);
          const idx = this.state.playerOrder.indexOf(message.targetId);
          if (idx !== -1) this.state.playerOrder.splice(idx, 1);
          this.botInstances.delete(message.targetId);
        } else {
          const targetClient = this.clients.find(c => c.sessionId === message.targetId);
          if (targetClient) {
            targetClient.leave();
          }
        }
      }
    });

    this.onMessage('START_GAME', (client) => {
      const host = this.state.players.get(client.sessionId);
      if (!host || !host.isHost) return;
      if (this.state.players.size < (this.gameModule?.manifest.minPlayers || 2)) return;
      if (this.state.players.size > (this.gameModule?.manifest.maxPlayers || this.maxClients)) return;

      this.startGame();
    });

    this.onMessage('GAME_ACTION', (client, action: any) => {
      if (this.state.status !== 'playing' || !this.gameModule) return;

      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      this.executeAction(action, player.id);
    });
  }

  onJoin(client: Client, options: any) {
    console.log(`[Room ${this.state.roomCode}] Client joined: ${client.sessionId}`);

    // Reconnect check
    let existingPlayer: PlayerSchema | undefined;
    if (options.sessionToken) {
      for (const [, p] of this.state.players.entries()) {
        if (p.sessionToken === options.sessionToken) {
          existingPlayer = p;
          break;
        }
      }
    }

    if (existingPlayer) {
      const previousSessionId = [...this.state.players.entries()]
        .find(([, player]) => player === existingPlayer)?.[0];
      if (previousSessionId && previousSessionId !== client.sessionId) {
        this.state.players.delete(previousSessionId);
        const orderIndex = this.state.playerOrder.indexOf(previousSessionId);
        if (orderIndex !== -1) this.state.playerOrder[orderIndex] = client.sessionId;
        this.remapRuntimePlayerId(previousSessionId, client.sessionId);
      }
      existingPlayer.isConnected = true;
      existingPlayer.isBot = false;
      existingPlayer.id = client.sessionId;
      this.state.players.set(client.sessionId, existingPlayer);
      this.botInstances.delete(previousSessionId || client.sessionId);
      this.syncTurnPlayerId();
      this.publishGameState();
      return;
    }

    if (this.state.status !== 'lobby' || this.state.players.size >= (this.gameModule?.manifest.maxPlayers || this.maxClients)) {
      client.leave();
      return;
    }

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.name = options.name || `Spieler ${this.state.players.size + 1}`;
    player.color = COLOR_PALETTE[this.state.players.size % COLOR_PALETTE.length];
    player.sessionToken = options.sessionToken || ('tok-' + Math.random().toString(36).substring(2, 9));
    player.isHost = this.state.players.size === 0;
    player.isReady = player.isHost; // Host starts ready
    player.isConnected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.push(client.sessionId);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.status === 'lobby') {
      this.state.players.delete(client.sessionId);
      const idx = this.state.playerOrder.indexOf(client.sessionId);
      if (idx !== -1) this.state.playerOrder.splice(idx, 1);

      // Reassign host if host left
      if (player.isHost && this.state.playerOrder.length > 0) {
        const nextHost = this.state.players.get(this.state.playerOrder[0]);
        if (nextHost) nextHost.isHost = true;
      }
      return;
    }

    // During active game: allow reconnect with 20s grace period
    player.isConnected = false;
    try {
      if (consented) {
        throw new Error('Consented leave');
      }
      await this.allowReconnection(client, 20);
      player.isConnected = true;
    } catch {
      // Reconnect failed or player left on purpose
      console.log(`[Room ${this.state.roomCode}] Reconnect expired for ${player.name}`);
      player.isConnected = false;
      if (this.state.status === 'playing' && !player.isBot && this.gameModule?.createBot) {
        player.isBot = true;
        this.botInstances.set(player.id, this.gameModule.createBot('medium'));
        this.syncTurnPlayerId();
        this.triggerBotTurnIfNeeded();
      }
    }
  }

  private startGame() {
    if (!this.gameModule) return;

    const playersArray: Player[] = (this.state.playerOrder as unknown as string[]).map((pid: string) => {
      const p = this.state.players.get(pid)!;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        isBot: p.isBot
      };
    });

    const config = this.state.gameId === 'metroville' ? { preset: this.state.gamePreset } : {};
    this.runtimeGameState = this.gameModule.createInitialState(config, playersArray, this.state.seed);
    this.state.status = 'playing';
    this.publishGameState();

    this.syncTurnPlayerId();

    this.triggerBotTurnIfNeeded();
  }

  private executeAction(action: any, playerId: string) {
    if (!this.gameModule || !this.runtimeGameState) return;

    const validation = this.gameModule.validateAction(this.runtimeGameState, action, playerId);
    if (!validation.valid) {
      console.warn(`[Room ${this.state.roomCode}] Action invalid from ${playerId}: ${action?.type} — ${validation.error}`);
      if (this.botInstances.has(playerId)) {
        const fallback = this.state.gameId === 'metroville'
          ? metroBotFallbackAction(this.runtimeGameState)
          : null;
        if (fallback && fallback.type !== action?.type) {
          console.warn(`[Room ${this.state.roomCode}] Bot fallback retry: ${fallback.type}`);
          this.executeAction(fallback, playerId);
        }
      }
      return;
    }

    const stateBefore = this.state.gameId === 'metroville'
      ? JSON.parse(JSON.stringify(this.runtimeGameState))
      : null;
    this.runtimeGameState = this.gameModule.applyAction(this.runtimeGameState, action);
    if (stateBefore && this.state.gameId === 'metroville') {
      console.log(
        `[Room ${this.state.roomCode}] Bot/state ${playerId}: ${action.type} → phase=${this.runtimeGameState.phase}`
      );
    }

    if (this.gameModule.isGameOver(this.runtimeGameState)) {
      this.state.status = 'gameover';
      const result = this.gameModule.computeResult(this.runtimeGameState);
      this.state.winnerId = result.winnerId || '';
      this.state.winReason = result.reason || '';
      this.publishGameState();
      return;
    }

    this.publishGameState();
    this.syncTurnPlayerId();

    this.scheduleBotTurn(stateBefore);
  }

  private clearBotTimers() {
    if (this.botTurnTimer) {
      clearTimeout(this.botTurnTimer);
      this.botTurnTimer = null;
    }
    if (this.botWatchdogTimer) {
      clearTimeout(this.botWatchdogTimer);
      this.botWatchdogTimer = null;
    }
  }

  private scheduleBotTurn(stateBefore: any = null) {
    this.clearBotTimers();
    if (this.state.status !== 'playing' || !this.state.currentTurnPlayerId) return;

    const botId = this.state.currentTurnPlayerId;
    const botInstance = this.botInstances.get(botId);
    if (!botInstance) return;

    const delay = computeBotActionDelay(this.state.gameId, stateBefore, this.runtimeGameState);
    const turnRevision = ++this.botTurnRevision;
    this.botTurnSnapshot = {
      playerId: botId,
      phase: this.runtimeGameState?.phase || '',
      revision: turnRevision
    };

    console.log(
      `[Room ${this.state.roomCode}] Bot ${botId} scheduled in ${delay}ms (phase=${this.botTurnSnapshot.phase})`
    );

    this.botTurnTimer = setTimeout(async () => {
      if (this.state.status !== 'playing' || this.state.currentTurnPlayerId !== botId) return;
      if (turnRevision !== this.botTurnRevision) return;
      const botAction = await botInstance.chooseAction(this.runtimeGameState, botId);
      if (botAction) {
        this.executeAction(botAction, botId);
      }
    }, delay);

    this.botWatchdogTimer = setTimeout(() => {
      if (this.state.status !== 'playing' || this.state.currentTurnPlayerId !== botId) return;
      if (!this.botTurnSnapshot || this.botTurnSnapshot.revision !== turnRevision) return;
      const phase = this.runtimeGameState?.phase;
      if (this.botTurnSnapshot.phase === phase) {
        const fallback = this.state.gameId === 'metroville'
          ? metroBotFallbackAction(this.runtimeGameState)
          : { type: 'CHECK' };
        console.warn(
          `[Room ${this.state.roomCode}] Bot watchdog: forcing ${fallback?.type} for ${botId} (stuck in ${phase})`
        );
        if (fallback) this.executeAction(fallback, botId);
      }
    }, BOT_TURN_WATCHDOG_MS);
  }

  private triggerBotTurnIfNeeded() {
    this.scheduleBotTurn(null);
  }

  private syncTurnPlayerId() {
    if (!this.runtimeGameState) return;
    if (this.state.gameId === 'tictactoe') {
      const turnSymbol = this.runtimeGameState.currentTurn;
      const turnPlayer = this.runtimeGameState.players[turnSymbol];
      this.state.currentTurnPlayerId = turnPlayer ? turnPlayer.id : '';
      return;
    }
    if (this.state.gameId === 'metroville') {
      const auction = this.runtimeGameState.auction;
      this.state.currentTurnPlayerId = auction
        ? auction.activePlayerIds[auction.currentBidderIndex] || ''
        : this.runtimeGameState.currentTurnPlayerId;
      return;
    }
    if (this.state.gameId === 'texasholdem' || this.state.gameId === 'five-card-draw') {
      this.state.currentTurnPlayerId = this.runtimeGameState.currentTurnPlayerId;
    }
  }

  private publishGameState() {
    if (!this.runtimeGameState || !this.gameModule) return;
    if (this.state.gameId !== 'texasholdem' && this.state.gameId !== 'five-card-draw') {
      this.state.gameStateJson = JSON.stringify(this.runtimeGameState);
      return;
    }

    const revision = ++this.gameStateRevision;
    const publicState = {
      ...this.runtimeGameState,
      revision,
      seed: '',
      randomIndex: 0,
      deck: [],
      players: this.runtimeGameState.players.map((player: any) => ({
        ...player,
        hand: this.runtimeGameState.showdown
          ? [...player.hand]
          : []
      }))
    };
    this.state.gameStateJson = JSON.stringify(publicState);

    for (const client of this.clients) {
      const player = this.state.players.get(client.sessionId);
      if (!player) continue;
      const privateView = this.gameModule.getPlayerView(this.runtimeGameState, player.id);
      client.send('PRIVATE_GAME_VIEW', JSON.stringify({ revision, state: privateView }));
    }
  }

  private remapRuntimePlayerId(previousId: string, nextId: string) {
    if (!this.runtimeGameState) return;
    if (this.state.gameId === 'tictactoe') {
      for (const symbol of ['X', 'O'] as const) {
        if (this.runtimeGameState.players[symbol]?.id === previousId) {
          this.runtimeGameState.players[symbol].id = nextId;
        }
      }
      return;
    }
    if (this.state.gameId === 'metroville') {
      const player = this.runtimeGameState.players.find((candidate: Player) => candidate.id === previousId);
      if (player) player.id = nextId;
      this.runtimeGameState.playerOrder = this.runtimeGameState.playerOrder.map((id: string) => id === previousId ? nextId : id);
      if (this.runtimeGameState.currentTurnPlayerId === previousId) {
        this.runtimeGameState.currentTurnPlayerId = nextId;
      }
      if (this.runtimeGameState.lastRollerId === previousId) {
        this.runtimeGameState.lastRollerId = nextId;
      }
      for (const property of Object.values(this.runtimeGameState.properties) as Array<{ ownerId: string | null }>) {
        if (property.ownerId === previousId) property.ownerId = nextId;
      }
      if (this.runtimeGameState.pendingTrade) {
        if (this.runtimeGameState.pendingTrade.fromPlayerId === previousId) this.runtimeGameState.pendingTrade.fromPlayerId = nextId;
        if (this.runtimeGameState.pendingTrade.toPlayerId === previousId) this.runtimeGameState.pendingTrade.toPlayerId = nextId;
      }
      return;
    }
    if (this.state.gameId === 'texasholdem' || this.state.gameId === 'five-card-draw') {
      this.runtimeGameState.players = this.runtimeGameState.players.map((player: any) =>
        player.id === previousId ? { ...player, id: nextId } : player
      );
      this.runtimeGameState.playerOrder = this.runtimeGameState.playerOrder.map((id: string) => id === previousId ? nextId : id);
      if (this.runtimeGameState.currentTurnPlayerId === previousId) this.runtimeGameState.currentTurnPlayerId = nextId;
      if (this.runtimeGameState.handWinner) {
        this.runtimeGameState.handWinner.playerIds = this.runtimeGameState.handWinner.playerIds.map((id: string) => id === previousId ? nextId : id);
      }
    }
  }
}
