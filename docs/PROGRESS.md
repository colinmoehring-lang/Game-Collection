# Project Progress

## Etappen-Status

- [x] **Etappe 1: Implementation Plan** – Genehmigt
- [x] **Etappe 2: Art-Direction-Moodboards** – Option C (Mid-Century Modern) ausgewählt und im Detail verfeinert
- [x] **Etappe 3: Monorepo-Grundgerüst + Game-SDK + Tic-Tac-Toe lokal**
- [x] **Etappe 4: Server, Räume, Lobby, Multiplayer Tic-Tac-Toe**
  - [x] Colyseus Rooms mit `@colyseus/schema` State-Synchronisation
  - [x] 5-stelliger Raum-Code-Generator (`ACDEFGHJKLMNPQRTUVWXY`)
  - [x] Live-Lobby-UI mit Beitritts-/Bereit-Status & Host-Kick
  - [x] QR-Code & teilbarer Direktlink
  - [x] Bot-Slot mit Min-Max-Heuristik
  - [x] 3-Session E2E-Multiplayer-Test erfolgreich durchgeführt & Screenshots erfasst
- [x] **Etappe 5: MetroVille Regel-Engine + Unit-Tests**
  - [x] 40-Felder-Brett, Presets, Grundstücke, Mieten, Bahnhöfe und Versorgungswerke
  - [x] Deterministische Würfel- und Kartenstapel anhand des Spiel-Seeds
  - [x] Kaufen, Hypotheken, gleichmäßiges Bauen/Verkaufen, Gefängnis und Auktionen
  - [x] 12 fokussierte Unit-Tests inklusive 300 Bot-Simulationspartien
  - [x] TypeScript-Build des MetroVille-Pakets fehlerfrei
  - [x] Handel und Reconnect in Etappe 7 ergänzt
- [x] **Etappe 6: MetroVille Spielbrett & Spiel-UI**
  - [x] MetroVille als auswählbares Spielmodul in Lobby, Server und Plattform verdrahtet
  - [x] Responsives 40-Felder-Randbrett mit Besitzmarkern, Spielfiguren und Spielerübersicht
  - [x] Aktionsleiste für Würfeln, Kaufen, Passen, Zugabschluss, Gefängnis und Gebäude/Hypotheken
  - [x] Stadtprotokoll, Zugstatus und Desktop-/Mobile-Layout geprüft
  - [ ] Handel, Auktionserweiterung, Reconnect und vollständige Bot-Flows folgen in Etappe 7
- [x] **Etappe 7: Handel, Auktion, Bots, Reconnect**
  - [x] Atomare Handelsangebote mit Grundstücken und Geld inklusive Annahme/Ablehnung
  - [x] Mindestgebote, aktiver Bieter und UI für Auktionen
  - [x] Bot-Züge für MetroVille sowie Bot-Übernahme nach abgelaufener Reconnect-Frist
  - [x] Session-ID-Remapping bei Reconnect in Raum- und Runtime-State
  - [x] 14 MetroVille-Regeltests sowie Workspace- und Multiplayer-Regressionstests grün
- [ ] **Etappe 8: Sound, Animationen, Politur, Barrierefreiheit**
- [ ] **Etappe 9: Tests, README, Abschluss**
