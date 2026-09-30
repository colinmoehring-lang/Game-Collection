import { chromium } from 'playwright';

const PLATFORM_URL = (process.env.E2E_PLATFORM_URL || 'http://localhost:5173').replace(/\/+$/, '');

async function runMultiplayerTest() {
  console.log('🚀 Starting 2-session Tic-Tac-Toe multiplayer test...');
  const channel = process.env.PLAYWRIGHT_CHANNEL?.trim();
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  const failures = [];
  function check(label, condition, detail = '') {
    if (condition) {
      console.log(`✅ ${label}`);
      return;
    }
    failures.push(`${label}${detail ? ` (${detail})` : ''}`);
    console.error(`❌ ${label}${detail ? ` (${detail})` : ''}`);
  }

  try {
    // 1. Host (Player A) opens platform
    console.log(`1. Host A opens ${PLATFORM_URL}`);
    await pageA.goto(PLATFORM_URL);
    await pageA.fill('#player-name-input', 'Host Alice');
    await pageA.click('#game-select-trigger');
    await pageA.click('#game-option-tictactoe');
    check('Game mode picker selects Tic-Tac-Toe', (await pageA.inputValue('#game-select')) === 'tictactoe');
    await pageA.click('#btn-create-room');

    // Wait for Lobby view and get room code
    await pageA.waitForSelector('#view-lobby:not([style*="display: none"])', { timeout: 10000 });
    const roomCode = (await pageA.textContent('#lobby-room-code'))?.trim();
    check('Room created with code', Boolean(roomCode), `code=${roomCode}`);

    // Screenshot Lobby A
    await pageA.screenshot({ path: 'lobby-session-a.png' });

    // 2. Player B joins room (Tic-Tac-Toe allows exactly 2 players)
    console.log('2. Player B joins room', roomCode);
    await pageB.goto(`${PLATFORM_URL}/?room=${roomCode}`);
    await pageB.fill('#player-name-input', 'Player Bob');
    await pageB.click('#btn-join-room');
    await pageB.waitForSelector('#view-lobby:not([style*="display: none"])', { timeout: 10000 });
    console.log('✅ Player B joined lobby');

    // Screenshot both players in lobby
    await pageA.waitForTimeout(1000);
    await pageA.screenshot({ path: 'lobby-2-players.png' });

    // 3. Player B readies up
    console.log('3. Player B readies up');
    await pageB.click('#btn-toggle-ready');

    await pageA.waitForTimeout(1000);
    console.log('4. Host starts game');
    await pageA.click('#btn-start-game');

    // Verify both pages see Game View
    await pageA.waitForSelector('#view-game:not([style*="display: none"])', { timeout: 10000 });
    await pageB.waitForSelector('#view-game:not([style*="display: none"])', { timeout: 10000 });
    console.log('✅ Both sessions entered active game view!');

    // Helper to click a cell cleanly re-querying the selector
    async function clickCell(page, cellIndex) {
      await page.waitForSelector(`#multi-board .cell:nth-child(${cellIndex + 1}):not([disabled])`, { timeout: 5000 });
      await page.click(`#multi-board .cell:nth-child(${cellIndex + 1})`);
    }

    async function cellText(page, cellIndex) {
      return (await page.textContent(`#multi-board .cell:nth-child(${cellIndex + 1})`))?.trim();
    }

    // Play moves: Alice (X, turn 1) moves to cell 0
    console.log('5. Alice makes move at cell 0');
    await clickCell(pageA, 0);
    await pageB.waitForTimeout(700);

    const cell0OnB = await cellText(pageB, 0);
    check("Bob sees Alice's mark", cell0OnB === 'X', `cell 0 = "${cell0OnB}"`);

    // Bob (O) moves to cell 4 (center)
    console.log('6. Bob makes move at cell 4');
    await clickCell(pageB, 4);
    await pageA.waitForTimeout(700);

    const cell4OnA = await cellText(pageA, 4);
    check("Alice sees Bob's mark", cell4OnA === 'O', `cell 4 = "${cell4OnA}"`);

    // Alice (X) moves to cell 1
    console.log('7. Alice makes move at cell 1');
    await clickCell(pageA, 1);
    await pageB.waitForTimeout(700);

    // Bob (O) moves to cell 3
    console.log('8. Bob makes move at cell 3');
    await clickCell(pageB, 3);
    await pageA.waitForTimeout(700);

    // Alice (X) moves to cell 2 (Winning row [0, 1, 2]!)
    console.log('9. Alice makes winning move at cell 2');
    await clickCell(pageA, 2);
    await pageA.waitForTimeout(1000);

    // Verify the game over status on both screens
    const statusA = (await pageA.textContent('#game-status-bar'))?.trim();
    const statusB = (await pageB.textContent('#game-status-bar'))?.trim();
    check('Host sees the win', /Sieg für Host Alice/.test(statusA || ''), `status = "${statusA}"`);
    check('Opponent sees the win', /Sieg für Host Alice/.test(statusB || ''), `status = "${statusB}"`);
    check('Winning line is highlighted', (await pageA.locator('#multi-board .cell.winning').count()) === 3);

    await pageA.screenshot({ path: 'game-finished-host.png' });
    await pageB.screenshot({ path: 'game-finished-player-b.png' });

    if (failures.length > 0) {
      throw new Error(`${failures.length} assertion(s) failed:\n- ${failures.join('\n- ')}`);
    }
    console.log('🎉 2-Session Multiplayer Test successfully passed!');
  } finally {
    await browser.close();
  }
}

runMultiplayerTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
