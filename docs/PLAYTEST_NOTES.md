# MetroVille Playtest Notes

**Datum:** 2026-09-30
**Scope:** Browser-Playtest nach Preset- und Spielrahmen-Anpassungen; ergänzend Workspace-Regeltests.
**Sessions:** Zwei getrennte Browser-Origin-Sessions (Host auf `localhost`, Spieler B auf `127.0.0.1`).
**Ergebnis:** Presetauswahl, Blitz-Start, eine vollständige Mehrgebots-Auktion und ein Handel zwischen zwei Sessions wurden bestätigt. Gefängnis-, Bauen-, Bankrott- und Spielende-UI-Flows konnten nicht in einem vollständigen manuellen Browserlauf verifiziert werden.

## Durchgeführte Flows

1. **Preset-Auswahl und Start:** Host-Auswahl wurde synchron an Spieler B übertragen und war dort schreibgeschützt. Standard startete mit 1.500 Talern pro Spieler. Blitz startete mit 1.000 Talern und drei zufälligen Grundstücken pro Spieler; die Lobby zeigte ein Limit von 40 Spielerzügen.
2. **Auktion mit mehreren Geboten:** Spieler B lehnte Ratsherrenstraße ab. Host bot 10, B erhöhte auf 20, Host auf 30 und B passte. Das Grundstück ging für 30 Taler an Host.
3. **Handel zwischen Sessions:** B bot 10 Taler für Ratsherrenstraße; Host nahm an. Geld und Eigentum wurden in beiden Sessions aktualisiert.
4. **Lobby-Klicks:** Raum-Erstellung, Bereitmeldung und Spielstart ließen sich per Maus bedienen; ein echter Klick-Blocker wurde nicht reproduziert.
5. **Regeltests:** Der Workspace-Testlauf bestand mit 22 Tests. Die vorhandenen MetroVille-Tests decken unter anderem Gefängnisaktionen, gleichmäßiges Bauen/Verkaufen, Bankrott und Bot-Simulationen ab; diese Tests ersetzen keinen vollständigen Browser-Playtest dieser Flows.

## Bugs

### Mittel

1. **Kaufen bleibt bei unzureichendem Guthaben aktiv**
   - **Reproduktion:** Mit weniger Geld als der Grundstückspreis auf einem freien Grundstück landen. Der Kaufen-Button bleibt aktiv, die Serveraktion wird mit „Nicht genug Taler zum Kauf“ abgewiesen.
   - **Auswirkung:** Die Oberfläche bietet eine ungültige Aktion an und wirkt nach dem Klick nicht reagierend.
   - **Status (2026-09-30): Behoben.** Der Kaufen-Button nutzt die Engine-Validierung und bleibt bei zu wenig Guthaben deaktiviert; der Aktionshinweis nennt Kaufpreis und verfügbares Geld.

### Gering

1. **Mehrere Tabs im selben Browser-Profil erscheinen als derselbe Spieler**
   - **Reproduktion:** Vier Tabs auf derselben Origin öffnen. Der lokal gespeicherte Session-Token wird geteilt; Reconnect remappt die Tabs auf denselben Host.
   - **Auswirkung:** Für echte separate Browser-Kontexte ist das erwartbar, aber für Nutzer, die mehrere Tabs zum Testen verwenden, ist die Identität verwirrend.
   - **Status (2026-09-30): Behoben.** Der Session-Token liegt in `sessionStorage`: getrennte Tabs erhalten eigene Identitäten, Reloads desselben Tabs behalten den Token.

## UX-Probleme

1. **Nächste Aktion ist nur indirekt erkennbar**
   - Der Status „Du bist am Zug“ und die aktivierten Buttons helfen, aber deaktivierte Aktionen erklären nicht, warum sie noch nicht möglich sind. Besonders Kaufen, Bauen, Handeln und Zugabschluss könnten einen kurzen Grund oder Kontext anzeigen.
   - **Status (2026-09-30): Behoben.** Ein Live-Aktionshinweis beschreibt die nächste Entscheidung; deaktivierte Kauf-, Bau-, Zugabschluss- und Handelsaktionen erklären ihren Grund.

2. **Das Stadtprotokoll ist kompakt, aber Ereignisse sind schwer zu gruppieren**
   - Würfelwurf, Landung, Kauf/Miete und Zugwechsel erscheinen als einzelne Zeilen. Bei Paschfolgen muss man die Reihenfolge aus mehreren Zeilen rekonstruieren.
   - **Status (2026-09-30): Behoben.** Protokolleinträge werden pro Würfelzug zusammengefasst; Pasch-Zusatzwürfe bleiben in derselben Gruppe.

3. **Spielerperspektive bei Warten ist ausreichend, aber nicht vollständig informativ**
   - „Warten auf Spieler X“ zeigt den aktiven Spieler, aber nicht dessen Feld, Aktion oder verbleibende Entscheidung.
   - **Status (2026-09-30): Behoben.** Wartehinweise zeigen den aktiven Spieler, dessen Feld und die anstehende Entscheidung.

4. **Karten- und Besitzänderungen sind sichtbar, aber nicht als Transaktion zusammengefasst**
   - Der Kartenbestand aktualisiert sich korrekt nach Käufen. Eine kurze zusammenhängende Meldung wie „Atomreaktor gekauft, 150 Taler bezahlt“ wäre leichter zu verfolgen als nur Log plus Spielerwert.
   - **Status (2026-09-30): Behoben.** Kauf- und Mietereignisse erscheinen zusammen mit Landung und Würfelwurf in einer Zuggruppe; der Ereigniseintrag enthält Betrag und Grundstück.

## Feature-Vorschläge

1. Einen optionalen Zugassistenten anbieten: „Würfeln“, „Kaufen“, „Auktion“, „Zug beenden“ mit erklärendem Kontext.
2. Ein dauerhaftes Ereignisprotokoll mit Filtern für Würfel, Geld, Besitz, Karten und Handel anbieten.
3. Für Auktionen eine klare Gebotschronik und sichtbare Bieterreihenfolge anzeigen.
4. Einen privaten Statusbereich für das eigene Vermögen, Grundstücke und aktive Kartenwirkungen ergänzen.
5. Für längere Partien einen kompakten Rundenfortschritt und Nettovermögensvergleich anzeigen.

## Design-Abweichungen

1. **Spielfeldtexte bleiben auf kleinen Tiles sehr dicht**
   - Namen, Preise und Marker sind auf normaler Desktopgröße lesbar, verlieren aber bei kleiner Darstellung schnell an Ruhe. Die Kartenansicht kompensiert das teilweise.

2. **Materialität ist vorhanden, aber subtil**
   - Papierkörnung und Creme-/Terrakotta-/Teal-Palette sind erkennbar. Eine stärker sichtbare Druck-/Letterpress-Hierarchie für wichtige Spielmomente würde die Moodboard-C-Identität noch klarer machen.

## Nicht abschließend geprüft

- Vollständiger Blitz-End-to-End-Lauf bis zum Spielende.
- Gefängnis-, Bauen-, Bankrott- und Spielende-UI-Flow in einer vollständigen Browser-Partie.
- Messung von Frame-Rate und längeren Speicher-/Performanceprofilen.