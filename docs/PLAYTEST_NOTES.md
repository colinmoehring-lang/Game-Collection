# MetroVille Playtest Notes

**Datum:** 2026-09-29  
**Scope:** Reiner Browser-Playtest, keine Code-, Konfigurations- oder Produktänderungen.  
**Sessions:** Vier getrennte Browser-Origin-Sessions (Host A, Spieler B, Spieler C, Spieler D).  
**Ergebnis:** Eine vollständige Blitz-Partie war mit dem aktuellen UI nicht startbar; der reproduzierbare Blocker ist unten dokumentiert. Der erreichbare Standardfluss wurde bis in mehrere Runden gespielt.

## Bugs

### Kritisch

1. **Blitz-Preset ist im Spielstart nicht auswählbar**
   - **Reproduktion:** Lobby öffnen, MetroVille auswählen und die Startoptionen prüfen. Es gibt nur die Spielauswahl, aber kein Preset-/Variantenfeld. `START_GAME` startet anschließend mit leerer Konfiguration.
   - **Auswirkung:** Der angeforderte Blitz-Modus mit Startgrundstücken und Rundenlimit kann nicht über die Spieleroberfläche gestartet werden. Eine vollständige Blitz-Partie war dadurch nicht testbar.

### Mittel

1. **Normale Klicks auf Lobby-Aktionen reagieren im Browser-Test nicht zuverlässig**
   - **Reproduktion:** Raum erstellen oder Raum beitreten in mehreren Sessions anklicken. Der Button war sichtbar und aktiviert, der normale Browser-Klick wartete jedoch wiederholt auf einen stabilen Zustand und lief in ein Timeout. Ein erzwungener Klick funktionierte anschließend.
   - **Auswirkung:** Für echte Spieler kann sich der Start wie ein nicht reagierender Button anfühlen. Die Ursache kann eine laufende Transition oder ein Browser-/Automation-Randfall sein und sollte mit realer Mausbedienung gegengeprüft werden.

2. **Auktions-/Handelsflows konnten im erreichbaren kurzen Durchlauf nicht vollständig belastbar gespielt werden**
   - **Reproduktion:** Der Standardfluss wurde automatisiert über mehrere Runden geführt; der Blitz-Blocker verhinderte den geplanten kurzen End-to-End-Pfad. Kaufen, Miete, Gemeinschaftskarte und Bahnhöfe wurden erreicht, eine komplette Auktion mit mehreren manuellen Geboten jedoch nicht.
   - **Auswirkung:** Kein bestätigter Laufzeitfehler, aber eine offene Testlücke vor Etappe 9.

### Gering

1. **Mehrere Tabs im selben Browser-Profil erscheinen als derselbe Spieler**
   - **Reproduktion:** Vier Tabs auf derselben Origin öffnen. Der lokal gespeicherte Session-Token wird geteilt; Reconnect remappt die Tabs auf denselben Host.
   - **Auswirkung:** Für echte separate Browser-Kontexte ist das erwartbar, aber für Nutzer, die mehrere Tabs zum Testen verwenden, ist die Identität verwirrend.

## UX-Probleme

1. **Nächste Aktion ist nur indirekt erkennbar**
   - Der Status „Du bist am Zug“ und die aktivierten Buttons helfen, aber deaktivierte Aktionen erklären nicht, warum sie noch nicht möglich sind. Besonders Kaufen, Bauen, Handeln und Zugabschluss könnten einen kurzen Grund oder Kontext anzeigen.

2. **Das Stadtprotokoll ist kompakt, aber Ereignisse sind schwer zu gruppieren**
   - Würfelwurf, Landung, Kauf/Miete und Zugwechsel erscheinen als einzelne Zeilen. Bei Paschfolgen muss man die Reihenfolge aus mehreren Zeilen rekonstruieren.

3. **Spielerperspektive bei Warten ist ausreichend, aber nicht vollständig informativ**
   - „Warten auf Spieler X“ zeigt den aktiven Spieler, aber nicht dessen Feld, Aktion oder verbleibende Entscheidung.

4. **Karten- und Besitzänderungen sind sichtbar, aber nicht als Transaktion zusammengefasst**
   - Der Kartenbestand aktualisiert sich korrekt nach Käufen. Eine kurze zusammenhängende Meldung wie „Atomreaktor gekauft, 150 Taler bezahlt“ wäre leichter zu verfolgen als nur Log plus Spielerwert.

## Feature-Vorschläge

1. Preset-Auswahl mit sichtbarer Kurzbeschreibung und Startparametern direkt in der Lobby ergänzen.
2. Einen optionalen Zugassistenten anbieten: „Würfeln“, „Kaufen“, „Auktion“, „Zug beenden“ mit erklärendem Kontext.
3. Ein dauerhaftes Ereignisprotokoll mit Filtern für Würfel, Geld, Besitz, Karten und Handel anbieten.
4. Für Auktionen eine klare Gebotschronik und sichtbare Bieterreihenfolge anzeigen.
5. Einen privaten Statusbereich für das eigene Vermögen, Grundstücke und aktive Kartenwirkungen ergänzen.
6. Für längere Partien einen kompakten Rundenfortschritt und Nettovermögensvergleich anzeigen.

## Design-Abweichungen

1. **Moodboard C ist bei Karten deutlich besser getroffen als beim Gesamtspielrahmen**
   - Grundstückskarten mit Papierfläche, dunklem Mono-Header, Syne-Titel, Farbstreifen und gepunkteten Preiszeilen passen gut zur Vorlage.
   - Der eigentliche Spielrahmen wirkt im Vergleich weiterhin stärker wie ein funktionales Dashboard: Sidebar-Panels und viele kleine Controls dominieren gegenüber dem haptischen Tischspielgefühl.

2. **Spielfeldtexte bleiben auf kleinen Tiles sehr dicht**
   - Namen, Preise und Marker sind auf normaler Desktopgröße lesbar, verlieren aber bei kleiner Darstellung schnell an Ruhe. Die Kartenansicht kompensiert das teilweise.

3. **Materialität ist vorhanden, aber subtil**
   - Papierkörnung und Creme-/Terrakotta-/Teal-Palette sind erkennbar. Eine stärker sichtbare Druck-/Letterpress-Hierarchie für wichtige Spielmomente würde die Moodboard-C-Identität noch klarer machen.

## Nicht abschließend geprüft

- Vollständiger Blitz-End-to-End-Lauf: blockiert durch fehlende Preset-Auswahl.
- Vollständige manuelle Auktion mit mehreren konkurrierenden Geboten.
- Vollständiger Handel zwischen zwei realen Browser-Sessions.
- Gefängnis-, Bauen-, Bankrott- und Spielende-Flow in einer kompletten Partie.
- Messung von Frame-Rate und längeren Speicher-/Performanceprofilen.