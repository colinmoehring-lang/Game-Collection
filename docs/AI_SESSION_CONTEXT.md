# KI-Session-Kontext: Game Collection

Diese Übersicht erklärt vor allem, welche Spiele die Game Collection enthält und wie eine Partie abläuft. Sie ist als Kontext für eine neue KI-Session gedacht. Lies für aktuelle Entwicklungsdetails außerdem `README.md`; prüfe vor Änderungen den aktuellen Git-Status und den betroffenen Code.

## Was ist das Projekt?

Die Game Collection ist eine browserbasierte Multiplayer-Spielesammlung. Spieler erstellen oder betreten einen gemeinsamen **Raum**, wählen dort ein Spiel, warten auf Mitspieler und starten gemeinsam. Ein Raum hat einen kurzen Beitrittscode und einen teilbaren Link; ein QR-Code erleichtert den Beitritt. Der Host kann die Partie starten, wenn genug Spieler bereit sind, und Bots hinzufügen. Bei Verbindungsproblemen unterstützt das System den erneuten Beitritt.

Während einer Partie sehen die verbundenen Spieler denselben synchronisierten Spielstand. Wer am Zug ist, führt eine Aktion aus; der Server prüft sie und aktualisiert den Zustand für alle. Manche Kartendaten oder verdeckten Pokerkarten sind nur für die betreffende Spielerperspektive sichtbar.

## Die Spiele

### MetroVille: City of Fortune

Ein Brett- und Wirtschaftsspiel für **2 bis 6 Spieler**. Alle bewegen sich über ein Brett mit 40 Feldern. Das Ziel ist, durch Grundstücke und Miete ein Vermögen aufzubauen und die anderen wirtschaftlich zu überstehen.

- **Grundstücke kaufen:** Auf freien Straßen, Bahnhöfen und Versorgungswerken kann man beim Landen kaufen. Wer nicht kauft, löst je nach Preset eine Versteigerung aus.
- **Quartiere vervollständigen:** Grundstücke gehören zu Farbgruppen. Wer eine ganze Gruppe besitzt, erhält höhere Grundmiete und kann dort Gebäude errichten.
- **Bauen:** Auf vollständigen Straßengruppen können Wohnblöcke und schließlich ein Wolkenkratzer gebaut werden. Die Häuserzahl steigert die Miete deutlich; Bauen und Verkaufen unterliegt den Spielregeln für gleichmäßige Bebauung.
- **Bahnhöfe und Versorgungswerke:** Mehrere Bahnhöfe erhöhen die Miete. Die Miete für Versorgungswerke hängt von Würfelwurf und Besitz ab.
- **Geld und Besitz verwalten:** Grundstücke können beliehen oder wieder ausgelöst werden. Bei Geldnot werden unbelastete Grundstücke automatisch beliehen; reicht das nicht, kann ein Spieler bankrottgehen.
- **Handel:** Spieler können anderen Geld und Grundstücke anbieten oder von ihnen anfordern. Wenn die Option im Preset aktiviert ist, kann ein Grundstück auch gegen eine einmalige Zahlung für eine feste Zahl vollständiger Tischrunden verpachtet werden. Eigentum bleibt beim Verpächter, der Pächter erhält die Miete; Pacht endet bei Ablauf oder Bankrott des Pächters.
- **Stadtpark-Jackpot und Förderprogramm:** Als einzeln aktivierbare Regeln sammeln sich Steuerzahlungen und die Gebäudesanierungs-Abgabe im Jackpot, den man beim Freien Stadtpark gewinnt. Beim Passieren des Stadttors kann außerdem der eindeutige Spieler mit dem geringsten Gesamtvermögen einen Bonus erhalten. Diese Regeln sind in der aktuellen Konfiguration standardmäßig deaktiviert.
- **Bot-Handel:** Als einzeln aktivierbare Regel können Bots gezielt um das letzte Grundstück für ein vollständiges Farbquartier verhandeln. Angebote berücksichtigen Grundstückswerte und den Vorteil eines kompletten Quartiers; die Bots beantworten Angebote nach ihrem geschätzten Gegenwert. Standardmäßig ist der Bot-Handel deaktiviert.
- Gehalt beim Stadttor und ein Steuermultiplikator lassen sich über die Spielkonfiguration überschreiben. Die bisherigen Defaults (200 Taler Gehalt, Steuermultiplikator 1,0) und Preset-Einstellungen bleiben unverändert.
- **Ereignisse und Sonderfelder:** Zwei getrennte, gemischte Kartenstapel („Chance“/Expresskurier und Gemeinschaft/Stadtrat) lösen Ereignisse aus. Dazu kommen Steuern, Sicherheitszone/Gefängnis, Gefängniskarten und das Stadttor mit Gehalt beim Vorbeikommen.
- **Züge:** Würfeln, gegebenenfalls erneut nach einem Pasch, Feldaktion ausführen und den Zug beenden. Im Gefängnis kann man eine Karte nutzen, die Geldstrafe zahlen oder einen Ausbruchsversuch würfeln.

**Presets in der Lobby:**

- **Blitz:** 1.000 Taler Startkapital, drei zufällig zugeteilte Grundstücke pro Spieler und ein Limit von 40 abgeschlossenen Spielerzügen (bei vier Spielern ungefähr zehn volle Runden). Am Limit gewinnt das höchste Vermögen.
- **Standard:** klassischer Aufbau mit 1.500 Talern und Auktionen, wenn ein Kauf abgelehnt wird.
- **Klassisch Light:** 1.200 Taler und keine Auktion, wenn ein Kauf abgelehnt wird.

MetroVille hat einen Bot mit den Schwierigkeitsstufen `easy`, `medium` und `hard`. Je nach Phase würfelt, kauft, bietet, baut oder beendet er den Zug. Die genaue Strategie ist implementiert und kann sich ändern; bei Bot-Aufgaben immer den aktuellen Code und die Tests prüfen.

### Tic-Tac-Toe

Das klassische **3×3-Spiel für genau zwei Spieler**. Die Spieler setzen abwechselnd X und O. Wer zuerst drei Symbole waagerecht, senkrecht oder diagonal in einer Reihe hat, gewinnt; ist das Brett voll, ohne dass jemand gewinnt, endet die Partie unentschieden.

Es gibt einen Bot mit drei Schwierigkeitsstufen. Er kann freie Züge zufällig wählen, unmittelbare Gewinnzüge nutzen und gegnerische Gewinnzüge blockieren; die höchste Stufe bevorzugt außerdem Zentrum und Ecken.

### Texas Hold’em

Poker für **2 bis 8 Spieler**. Zu Beginn werden Small Blind und Big Blind gesetzt; standardmäßig sind es 10 und 20 Chips. Jeder erhält zwei verdeckte Handkarten. Im Verlauf kommen fünf Gemeinschaftskarten auf den Tisch: Flop (drei Karten), Turn und River (je eine Karte).

Zwischen den Kartenrunden setzen die Spieler. Je nach Situation können sie checken, mitgehen, erhöhen, aussteigen oder alle Chips setzen. Beim Showdown zählt für jeden verbliebenen Spieler die beste Fünf-Karten-Hand aus seinen zwei Handkarten und den fünf Gemeinschaftskarten. Der Pot wird an die beste Hand verteilt; bei unterschiedlich hohen Einsätzen sind auch Side Pots möglich.

### Five Card Draw

Ebenfalls Poker für **2 bis 8 Spieler**, aber ohne Gemeinschaftskarten. Jeder erhält fünf verdeckte Karten. Nach der ersten Setzrunde gibt es eine Tauschrunde: Spieler wählen, welche Karten sie ablegen und ersetzen möchten. Danach folgt die zweite Setzrunde und, falls mehrere Spieler verbleiben, der Showdown mit der besten Fünf-Karten-Pokerhand.

Beide Pokervarianten unterstützen Bots und verwenden dieselbe Handbewertung. Die verfügbaren Aktionen umfassen Aussteigen, Checken, Mitgehen, Erhöhen und All-in; nach einer beendeten Hand kann die nächste gestartet werden.

## Kurz zur Technik

- **Plattform:** `apps/platform` enthält Browser-Oberfläche, Lobby und Spielansichten.
- **Server und Räume:** `apps/server` verwendet Colyseus. Ein Raum hält Lobby/Spieler und den autoritativen Spielstand zusammen; Aktionen werden dort geprüft und anschließend an alle Clients synchronisiert.
- **Spielregeln:** `packages/games/<spiel>` enthält jeweils die unabhängig testbare Regel-Engine und den Bot.
- **Gemeinsame Bausteine:** `packages/game-sdk` enthält Typen und Hilfen, die mehrere Spiele verwenden.

Die Plattform und der Server führen beide eine Spielregistrierung. Wenn ein Spiel ergänzt wird, muss es in der Oberfläche auswählbar und im Server registriert sein.

## Starten und testen

Voraussetzungen: Node.js mit Corepack. Im Repository-Root:

```powershell
corepack pnpm install
corepack pnpm dev
```

Die Plattform läuft standardmäßig unter `http://localhost:5173`; der Server lauscht auf Port `2567` und bietet `/health`.

```powershell
corepack pnpm build
corepack pnpm test
```

Gezielte Tests laufen mit `corepack pnpm --filter @metroville/game-metroville test`, `@metroville/game-tictactoe` oder `@metroville/game-texasholdem`. Der Multiplayer-E2E-Smoke-Test für Tic-Tac-Toe ist `node test-multiplayer-e2e.mjs` und benötigt laufenden Server, Plattform und einen installierten Playwright-Browser.

## Hinweise für die KI, die am Projekt arbeitet

- Lies bei einer konkreten Aufgabe die betroffenen Regel-Engine-, UI- oder Raumdateien und ihre Tests, statt dich nur auf diese Übersicht zu verlassen.
- Spielregeln gehören in das jeweilige Spielepaket, Darstellung in die Plattform und Raum-/Synchronisationslogik in den Server.
- Regeländerungen sollen Zustände nicht unbeabsichtigt mutieren. Seed-basierter Zufall muss reproduzierbar bleiben.
- Ergänze passende Regressionstests und führe den kleinsten relevanten Test- und Build-Befehl aus.
- Erhalte vorhandene Änderungen im Arbeitsbaum. Keine nicht angefragten Änderungen zurücksetzen oder Commits umschreiben.
- `docs/CONVENTIONS.md` beschreibt Architektur- und UI-Konventionen; `docs/PLAYTEST_NOTES.md` dokumentiert bekannte UX-Befunde und noch nicht vollständig manuell geprüfte Spielabläufe.

## Startprompt zum Kopieren

> Du arbeitest an der Game Collection. Lies zuerst `docs/AI_SESSION_CONTEXT.md` und `README.md`; prüfe danach `git status --short` und erhalte vorhandene Änderungen. Das Projekt enthält MetroVille (2–6 Spieler, Grundstücke, Auktionen, Handel, Bauen, Karten und drei Presets), Tic-Tac-Toe (zwei Spieler), Texas Hold’em und Five Card Draw (je 2–8 Spieler). Spieler treffen sich in Lobby-Räumen per Code oder Link; ein Colyseus-Server verwaltet und synchronisiert den gemeinsamen Spielstand. Technisch liegen die Browser-Oberfläche in `apps/platform`, Raum-/Serverlogik in `apps/server` und reine Spielregeln samt Bots in `packages/games/*`. Lies vor einer Änderung den betroffenen Code und seine Tests, arbeite gezielt, bewahre Immutabilität und reproduzierbaren Zufall und ergänze passende Regressionstests. Prüfe die Änderung mit den kleinsten passenden Tests und Builds und fasse Ergebnis und Prüfungen knapp zusammen.
