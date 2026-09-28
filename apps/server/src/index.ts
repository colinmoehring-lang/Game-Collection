import colyseus from 'colyseus';
const { Server } = colyseus;
import { WebSocketTransport } from '@colyseus/ws-transport';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { MultiplayerGameRoom } from './MultiplayerGameRoom.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'metroville-backend', timestamp: Date.now() });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

// Register generic multiplayer game room with roomCode filter
gameServer.define('game_room', MultiplayerGameRoom).filterBy(['roomCode']);

const port = Number(process.env.PORT || 2567);
server.listen(port, () => {
  console.log(`[MetroVille Server] Listening on http://localhost:${port}`);
});

export { gameServer };
