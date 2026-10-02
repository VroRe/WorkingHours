# WorkingHours

Eine einfache mobile Web-App (PWA) zum Erfassen von Arbeitszeiten. Sie läuft komplett im Browser des Smartphones. Alle Einträge werden nur lokal auf dem Gerät gespeichert. Es gibt keinen Server, kein Benutzerkonto und keine Verbindung zu Excel oder zu Cloud-Diensten.

## Funktionen

- **Zwei Seiten:** *Eingabe* (beim Start immer sichtbar) und *Dashboard*.
- **Erfassung pro Tag:** Datum (heute vorbelegt), Haus verlassen, Arbeitsbeginn, Arbeitsende, Ankunft zu Hause, Pause (Minuten), Ziel des Tages (Büro oder Baustelle).
- **Uhrzeit per Zahlentastatur:** `745` oder `0745` ergibt 07:45, `7` ergibt 07:00. Ungültige Eingaben werden rot markiert.
- **Abwesenheit:** Urlaub oder Krank. Die Zeitfelder werden dann gesperrt und es werden 8 Stunden angerechnet.
- **„Jetzt“-Knöpfe** setzen die aktuelle Uhrzeit in das jeweilige Feld.
- **Letztes Ziel** wird automatisch vorbelegt.
- **Dashboard:**
  - Monatskacheln mit Ist, Soll, Differenz und Fahrzeit, mit Monatsnavigation
  - Balkendiagramm der Stunden pro Kalenderwoche (Ist als Balken, Soll als Markierung), Tipp auf eine Woche zeigt die Details, dazu Summe und Tabellenansicht
  - Urlaub und Krank im Jahr mit Anzahl und Daten
  - Alle Tage des Monats mit Tagesbalken, Wochenende und Feiertage als schmale Zeilen
- **Bayerische Feiertage** werden berechnet (inklusive Mariä Himmelfahrt für katholische Gemeinden sowie der freien Tage 24.12. und 31.12.). An Feiertagen ist das Soll 0. Das Augsburger Friedensfest fehlt.
- **CSV-Export** über das Teilen-Menü des Handys (zum Beispiel nach OneDrive oder per E-Mail).
- **CSV-Import** zur Wiederherstellung oder zum Gerätewechsel.
- **Sicherungs-Erinnerung**, wenn die letzte Sicherung länger als 7 Tage zurückliegt.
- **Offline nutzbar** und als App auf dem Startbildschirm installierbar.

## Berechnung

| Größe | Berechnung |
|-------|------------|
| Fahrt hin | Arbeitsbeginn minus Haus verlassen (auch über Mitternacht) |
| Fahrt zurück | Ankunft zu Hause minus Arbeitsende |
| Arbeitszeit vor Pause | Arbeitsende minus Arbeitsbeginn |
| Pausenabzug | Größerer Wert aus 30 Minuten und der eingetragenen Pause |
| Arbeitszeit netto | Arbeitszeit vor Pause minus Pausenabzug, mindestens 0 |
| Soll | 8 Stunden von Montag bis Freitag, außer an Feiertagen |
| Urlaub / Krank | Ist gleich Soll des Tages, Differenz 0 |
| Differenz | Ist minus Soll |

Die Fahrzeit zählt nicht zur Arbeitszeit. Das Soll zählt nur für Tage mit einem Eintrag, nicht erfasste Werktage erscheinen nicht als Minus.

## Installation

1. Die Adresse der App im Browser des Smartphones öffnen.
2. **Android (Chrome):** Menü (⋮) → *App installieren* oder *Zum Startbildschirm hinzufügen*.
3. **iPhone (Safari):** Teilen → *Zum Home-Bildschirm*.

## Datenschutz und Sicherung

- Die Daten liegen ausschließlich im lokalen Speicher des Browsers auf dem Gerät.
- Die gehostete Seite enthält nur den Programmcode, keine Einträge.
- **Gehen die Browserdaten verloren** (Cache löschen, Gerät verloren oder gewechselt), sind die Einträge weg. Deshalb regelmäßig die CSV exportieren und aufbewahren.
- Auf dem iPhone sind Safari und die installierte Startbildschirm-App getrennt gespeichert. Es sollte nur eine der beiden Varianten genutzt werden.

## CSV-Format

Trennzeichen Semikolon, UTF-8 mit BOM, eine Zeile pro Tag:

```
Datum;Abwesenheit;Haus verlassen;Arbeitsbeginn;Arbeitsende;Ankunft zu Hause;Pause (Min);Ziel
04.01.2027;;06:45;07:30;16:30;17:15;45;Büro
05.01.2027;Urlaub;;;;;;
```

Beim Import überschreiben Einträge mit gleichem Datum die vorhandenen. Eine fehlerhafte Datei wird komplett abgelehnt, ohne etwas zu ändern.

## Dateien

| Datei | Zweck |
|-------|-------|
| `index.html` | Oberfläche |
| `app.js` | Logik, Speicherung, Berechnung, Import und Export |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `manifest.json` | App-Beschreibung für die Installation |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | App-Symbol (Bauhelm) |
| `Montserrat-Variable.ttf`, `Montserrat-OFL.txt` | Schrift Montserrat (SIL Open Font License) |

## Aktualisieren

Geänderte Dateien im Repository über *Add file → Upload files* ersetzen. Damit Handys die neue Version laden, in `sw.js` die Versionsnummer in `CACHE` erhöhen (zum Beispiel `stunden-v3`).

## Hosting

Die App ist statisch und läuft auf GitHub Pages (*Settings → Pages → Deploy from a branch → main, Ordner /root*). HTTPS ist Voraussetzung für Installation und Offline-Betrieb und wird von GitHub Pages bereitgestellt.
