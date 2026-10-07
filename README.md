# MetroVille Game Collection

Eine browserbasierte Multiplayer-Spielesammlung in einem pnpm-/Turborepo-Monorepo. Der aktuelle Stand enthält MetroVille, Tic-Tac-Toe, Texas Hold’em und Five Card Draw. Die Plattform verwaltet Lobby und Spielansicht; ein Colyseus-Server synchronisiert Räume und autoritative Spielzustände.

## Schnellstart

Voraussetzungen: Node.js mit Corepack. Die benötigte pnpm-Version ist im Root-`package.json` festgelegt.

```powershell
corepack pnpm install
corepack pnpm dev
```

Danach ist die Plattform unter [http://localhost:5173](http://localhost:5173) erreichbar. Der Server lauscht standardmäßig auf Port `2567`; sein Health-Endpunkt ist [http://localhost:2567/health](http://localhost:2567/health).

Falls du Plattform und Server getrennt starten möchtest, führe die Befehle in zwei Terminals im Repository-Root aus:

```powershell
corepack pnpm --filter @metroville/server dev
```

```powershell
corepack pnpm --filter @metroville/platform dev
```

## Deployment

Render-Setup mit GitHub-Verknüpfung: [docs/DEPLOY_RENDER.md](docs/DEPLOY_RENDER.md). Der Repository-Root enthält den zugehörigen `render.yaml` Blueprint; die Syntax-Hinweise zu statischen Sites und zur Node-Version stehen dort im Abschnitt „Blueprint-Syntax“.

## Spiele

- **MetroVille: City of Fortune:** Multiplayer-Brettspiel mit Grundstücken, Besitz, Mieten, Auktionen, Handel, Gebäuden, Hypotheken und Bots. Das Preset wird in der Lobby ausgewählt: Blitz, Standard oder Klassisch Light.
- **Tic-Tac-Toe:** Einfaches rundenbasiertes Multiplayer-Spiel.
- **Texas Hold’em:** Multiplayer-Poker für 2 bis 8 Personen mit privaten Hole Cards, Blinds, No-Limit-Einsätzen und Showdown.
- **Five Card Draw:** Poker für 2 bis 8 Personen mit fünf Karten, einer Tauschrunde und zwei Setzrunden.

## Entwicklung

Die üblichen Workspace-Befehle werden über Turborepo ausgeführt:

```powershell
corepack pnpm build
corepack pnpm test
```

Gezielte Paketbefehle sind ebenfalls verfügbar:

```powershell
corepack pnpm --filter @metroville/game-metroville test
corepack pnpm --filter @metroville/game-metroville build
```

Der Multiplayer-E2E-Smoke-Test für Tic-Tac-Toe prüft die Kette Raum erstellen → Beitritt über Raumlink → Bereit → Start → Zug-Synchronisation → Sieg. Er benötigt laufende Plattform und Server sowie einen installierten Playwright-Browser:

```powershell
node test-multiplayer-e2e.mjs
```

Der Test nutzt zwei Browser-Sitzungen, weil Tic-Tac-Toe genau zwei Spieler zulässt. `E2E_PLATFORM_URL` richtet ihn auf eine andere Plattform-Adresse aus (etwa die deployte Render-URL), `PLAYWRIGHT_CHANNEL=chrome` verwendet den lokal installierten Chrome statt des mitgelieferten Chromium.

## Projektstruktur

- `apps/platform/`: Vite-Webplattform, Lobby, Spielansichten und Styles.
- `apps/server/`: Colyseus-Server, Multiplayer-Räume und synchronisierter Room-State.
- `packages/game-sdk/`: gemeinsame Spieltypen und Hilfsfunktionen.
- `packages/games/metroville/`: MetroVille-Regel-Engine, Karten, Brett und Tests.
- `packages/games/texasholdem/`: Texas-Hold’em- und Five-Card-Draw-Regel-Engine mit Tests.
- `packages/games/tictactoe/`: Tic-Tac-Toe-Spielmodul und Tests.
- `docs/`: Konventionen, Fortschritt und aktuelle Playtest-Notizen.
- `moodboards/`: Art-Direction-Referenzen.

## Projektstand

Die geplanten Etappen 1 bis 9 sind abgeschlossen. Die dokumentierten offenen Playtest-Punkte und nicht vollständig geprüften Spielabläufe stehen in [docs/PLAYTEST_NOTES.md](docs/PLAYTEST_NOTES.md). Architektur- und Beitragskonventionen stehen in [docs/CONVENTIONS.md](docs/CONVENTIONS.md); den Etappenverlauf findest du in [docs/PROGRESS.md](docs/PROGRESS.md). Für den Start einer neuen KI-Session gibt es [docs/AI_SESSION_CONTEXT.md](docs/AI_SESSION_CONTEXT.md).
