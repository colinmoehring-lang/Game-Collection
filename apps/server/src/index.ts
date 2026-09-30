import colyseus from 'colyseus';
const { Server } = colyseus;
import { WebSocketTransport } from '@colyseus/ws-transport';
import http from 'http';
import os from 'node:os';
import express from 'express';
import cors from 'cors';
import { MultiplayerGameRoom } from './MultiplayerGameRoom.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: 'metroville-backend', timestamp: Date.now() });
});

function getLanAddress(): string | null {
  const virtualInterface = /virtual|vEthernet|vmware|virtualbox|docker|wsl|bluetooth|hyper-v/i;
  const addresses = Object.entries(os.networkInterfaces()).flatMap(([interfaceName, entries]) =>
    (entries || [])
      .filter(entry => !entry.internal && entry.family === 'IPv4')
      .filter(entry => {
        const [first, second] = entry.address.split('.').map(Number);
        return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
      })
      .map(entry => ({ interfaceName, address: entry.address }))
  );
  addresses.sort((left, right) => Number(virtualInterface.test(left.interfaceName)) - Number(virtualInterface.test(right.interfaceName)));
  return addresses[0]?.address || null;
}

app.get('/network-address', (_req, res) => {
  res.json({ address: getLanAddress() });
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
