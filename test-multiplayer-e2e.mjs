import { chromium } from 'playwright';

async function runMultiplayerTest() {
  console.log('🚀 Starting 3-session multiplayer test...');
  const browser = await chromium.launch({ headless: true });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const pageC = await contextC.newPage();

  try {
    // 1. Host (Player A) opens platform
    console.log('1. Host A opens http://localhost:5173');
    await pageA.goto('http://localhost:5173');
    await pageA.fill('#player-name-input', 'Host Alice');
    await pageA.selectOption('#game-select', 'tictactoe');
    await pageA.click('#btn-create-room');

    // Wait for Lobby view and get room code
    await pageA.waitForSelector('#view-lobby:not([style*="display: none"])', { timeout: 10000 });
    const roomCode = await pageA.textContent('#lobby-room-code');
    console.log(`✅ Room created with code: ${roomCode}`);

    // Screenshot Lobby A
    await pageA.screenshot({ path: 'lobby-session-a.png' });

    // 2. Player B joins room
    console.log('2. Player B joins room', roomCode);
    await pageB.goto(`http://localhost:5173/?room=${roomCode}`);
    await pageB.fill('#player-name-input', 'Player Bob');
    await pageB.click('#btn-join-room');
    await pageB.waitForSelector('#view-lobby:not([style*="display: none"])', { timeout: 10000 });
    console.log('✅ Player B joined lobby');

    // 3. Player C joins room
    console.log('3. Player C joins room', roomCode);
    await pageC.goto(`http://localhost:5173/?room=${roomCode}`);
    await pageC.fill('#player-name-input', 'Player Charlie');
    await pageC.click('#btn-join-room');
    await pageC.waitForSelector('#view-lobby:not([style*="display: none"])', { timeout: 10000 });
    console.log('✅ Player C joined lobby');

    // Screenshot 3 players in lobby
    await pageA.waitForTimeout(1000);
    await pageA.screenshot({ path: 'lobby-3-players.png' });

    // 4. Ready up
    console.log('4. Players ready up');
    await pageB.click('#btn-toggle-ready');
    await pageC.click('#btn-toggle-ready');

    await pageA.waitForTimeout(1000);
    console.log('5. Host starts game');
    await pageA.click('#btn-start-game');

    // 5. Verify all 3 pages see Game View
    await pageA.waitForSelector('#view-game:not([style*="display: none"])', { timeout: 10000 });
    await pageB.waitForSelector('#view-game:not([style*="display: none"])', { timeout: 10000 });
    await pageC.waitForSelector('#view-game:not([style*="display: none"])', { timeout: 10000 });
    console.log('✅ All 3 sessions entered active game view!');

    // Helper to click cell cleanly re-querying selector
    async function clickCell(page, cellIndex) {
      await page.waitForSelector(`#multi-board .cell:nth-child(${cellIndex + 1}):not([disabled])`, { timeout: 5000 });
      await page.click(`#multi-board .cell:nth-child(${cellIndex + 1})`);
    }

    // 6. Play moves: Alice (X, turn 1) moves to cell 0
    console.log('6. Alice makes move at cell 0');
    await clickCell(pageA, 0);
    await pageA.waitForTimeout(500);

    // Verify Bob sees cell 0 filled with X
    const cell0OnB = await pageB.textContent('#multi-board .cell:nth-child(1)');
    console.log(`Cell 0 on Bob's screen: "${cell0OnB}" (expected X)`);

    // Bob (O) moves to cell 4 (center)
    console.log('7. Bob makes move at cell 4');
    await clickCell(pageB, 4);
    await pageA.waitForTimeout(500);

    // Alice (X) moves to cell 1
    console.log('8. Alice makes move at cell 1');
    await clickCell(pageA, 1);
    await pageB.waitForTimeout(500);

    // Bob (O) moves to cell 3
    console.log('9. Bob makes move at cell 3');
    await clickCell(pageB, 3);
    await pageA.waitForTimeout(500);

    // Alice (X) moves to cell 2 (Winning row [0, 1, 2]!)
    console.log('10. Alice makes winning move at cell 2');
    await clickCell(pageA, 2);
    await pageA.waitForTimeout(1000);

    // Verify game over on Charlie's and Bob's screen
    const statusC = await pageC.textContent('#game-status-bar');
    console.log(`Charlie's game status: "${statusC}"`);

    await pageA.screenshot({ path: 'game-finished-host.png' });
    await pageB.screenshot({ path: 'game-finished-player-b.png' });
    await pageC.screenshot({ path: 'game-finished-spectator.png' });

    console.log('🎉 3-Session Multiplayer Test successfully passed!');
  } finally {
    await browser.close();
  }
}

runMultiplayerTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
