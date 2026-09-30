# Auf Render deployen

Das Repository enthält einen Render Blueprint in `render.yaml`. Er richtet zwei öffentliche Dienste ein:

- `metroville-game-server`: Colyseus-WebSocket-Server mit Health-Endpunkt `/health`.
- `metroville-game-platform`: statische Vite-Plattform.

## 1. Änderungen zu GitHub pushen

Committe und pushe den gewünschten Stand in ein GitHub-Repository. Das Repository kann öffentlich oder privat sein; bei einem privaten Repository muss Render Zugriff darauf erhalten.

## 2. Render mit GitHub verbinden

1. Bei [Render](https://render.com/) anmelden und im Dashboard **New +** → **Blueprint** wählen.
2. GitHub verbinden beziehungsweise Render den Zugriff auf das Repository erlauben.
3. Repository und Branch auswählen, der deployt werden soll.
4. Render erkennt `render.yaml`. Blueprint prüfen und **Apply** bestätigen.

Render baut und startet Server sowie Plattform getrennt. Pushes auf den verbundenen Branch lösen anschließend automatisch neue Deployments aus.

## 3. URLs prüfen

Der Blueprint verwendet `metroville-game-server` als Service-Namen. Die Plattform erhält beim Build `VITE_BACKEND_URL=wss://metroville-game-server.onrender.com`; dadurch laufen WebSocket-Verbindungen über TLS. Falls Render wegen eines Namenskonflikts eine andere Server-Domain vergibt, in den Environment Variables der Static Site `VITE_BACKEND_URL` auf `wss://<tatsächliche-server-domain>` setzen und die Static Site neu deployen.

Nach erfolgreichem Deployment:

- Server prüfen: `https://<server-domain>/health` muss JSON mit `"status":"ok"` liefern.
- Plattform öffnen: `https://<static-site-domain>.onrender.com`.
- Von einem zweiten Gerät oder einem anderen Netzwerk einen Raumlink aus der Lobby öffnen und dem Raum beitreten.
- Optional die komplette Kette gegen die veröffentlichte Plattform prüfen: `E2E_PLATFORM_URL=https://<static-site-domain>` setzen und `node test-multiplayer-e2e.mjs` ausführen. Unter Windows PowerShell: `$env:E2E_PLATFORM_URL='https://<static-site-domain>'; node test-multiplayer-e2e.mjs`. Der Test erwartet Tic-Tac-Toe mit genau zwei Spielern; die Plattform-Route `/?room=<code>` muss erreichbar sein.

Die geteilten Raumlinks verwenden auf der veröffentlichten Plattform deren öffentliche Domain und den Raumcode, nicht die lokale WLAN-IP.

## Betriebsgrenzen

Der Server speichert aktive Räume derzeit nur im Arbeitsspeicher. Ein Neustart oder Deployment beendet laufende Partien. Mehrere Serverinstanzen können Räume nicht gemeinsam verwalten; bis ein geteilter Zustand ergänzt wird, nur eine Serverinstanz verwenden. Auf kostenlosen Web-Services kann Render den Server bei Inaktivität schlafen legen; der nächste Aufruf kann verzögert sein. Für laufende Partien ohne solche Pausen einen dauerhaft aktiven Web-Service verwenden.

Die Plattform- und Server-Builds verwenden direkte pnpm-Filter statt des Root-Turbo-Skripts. Das vermeidet die Turbo-Paketmanager-Erkennung und baut nur den jeweiligen Dienst.