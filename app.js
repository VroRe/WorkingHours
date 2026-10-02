'use strict';

const KEY = 'sb_eintraege';
const KEY_ZIEL = 'sb_letztes_ziel';
const KEY_EXPORT = 'sb_letzter_export';
const ZEITFELDER = ['haus', 'beginn', 'ende', 'zuhause'];
const NAMEN = { haus: 'Haus verlassen', beginn: 'Arbeitsbeginn', ende: 'Arbeitsende', zuhause: 'Ankunft zu Hause' };
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const $ = (id) => document.getElementById(id);
let daten = laden();
let ziel = localStorage.getItem(KEY_ZIEL) || 'Büro';

function laden() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

// Speichert und liest zur Kontrolle zurück, damit ein Fehler nie unbemerkt bleibt.
function sichern() {
  const text = JSON.stringify(daten);
  localStorage.setItem(KEY, text);
  if (localStorage.getItem(KEY) !== text) throw new Error('Speicher hat den Eintrag nicht übernommen');
}

function heute() { return isoVon(new Date()); }
function isoVon(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function jetzt() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function anzeigeDatum(iso) {
  const [j, m, t] = iso.split('-');
  const wt = WOCHENTAGE[new Date(+j, +m - 1, +t).getDay()];
  return `${wt} ${t}.${m}.${j}`;
}
function csvDatum(iso) { const [j, m, t] = iso.split('-'); return `${t}.${m}.${j}`; }

function meldung(art, text) {
  const m = $('meldung');
  m.className = art;
  m.textContent = text;
}

function zielSetzen(z) {
  ziel = z;
  document.querySelectorAll('.ziel').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ziel === z)));
}

function abwesenheitAnwenden() {
  const gesperrt = $('abw').value !== '';
  ZEITFELDER.concat('pause').forEach((id) => { $(id).disabled = gesperrt; });
  document.querySelectorAll('[data-jetzt],.ziel').forEach((b) => { b.disabled = gesperrt; });
}

function formularFuellen(iso) {
  const e = daten[iso] || {};
  $('datum').value = iso;
  $('abw').value = e.abw || '';
  ZEITFELDER.forEach((f) => { $(f).value = e[f] || ''; });
  $('pause').value = e.pause ?? '';
  zielSetzen(e.ziel || localStorage.getItem(KEY_ZIEL) || 'Büro');
  abwesenheitAnwenden();
}

function formularLesen() {
  const e = { abw: $('abw').value };
  if (!e.abw) {
    ZEITFELDER.forEach((f) => { if ($(f).value) e[f] = $(f).value; });
    const p = $('pause').value;
    if (p !== '') e.pause = Number(p);
    e.ziel = ziel;
  }
  return e;
}

function leer(e) {
  return !e.abw && !ZEITFELDER.some((f) => e[f]) && e.pause === undefined;
}

function speichern() {
  const iso = $('datum').value;
  if (!iso) return meldung('fehler', 'Bitte ein Datum wählen.');
  const e = formularLesen();
  if (e.pause !== undefined && !(e.pause >= 0 && e.pause <= 600)) return meldung('fehler', 'Pause muss zwischen 0 und 600 Minuten liegen.');
  if (leer(e)) return meldung('fehler', 'Nichts zum Speichern: bitte mindestens eine Zeit oder Abwesenheit eintragen.');
  try {
    daten[iso] = e;
    sichern();
    if (e.ziel) localStorage.setItem(KEY_ZIEL, e.ziel);
  } catch (err) {
    // Formular bleibt unverändert, nichts geht verloren.
    return meldung('fehler', `Nicht gespeichert: ${err.message}. Die Eingaben stehen noch im Formular.`);
  }
  meldung('ok', `Gespeichert für ${anzeigeDatum(iso)}.`);
  liste();
}

function jetztStempeln(feld) {
  $(feld).value = jetzt();
}

// Berechnung wie in der Excel-Datei: Fahrzeit, Netto nach Pause (mindestens 30 Min), Soll 8 h Mo bis Fr.
// Feiertage sind nicht hinterlegt.
const SOLL_H = 8;
const MIN_PAUSE = 30;

function minuten(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function dauer(von, bis) { return ((minuten(bis) - minuten(von)) % 1440 + 1440) % 1440; }
function runden(x) { return Math.round(x * 100) / 100; }
function zahl(x) { return x.toFixed(2).replace('.', ','); }
function vorzeichen(x) { return (x > 0 ? '+' : '') + zahl(x); }

function rechne(iso, e) {
  const [j, m, t] = iso.split('-').map(Number);
  const wt = new Date(j, m - 1, t).getDay();
  const soll = wt >= 1 && wt <= 5 ? SOLL_H : 0;
  if (e.abw) return { ist: soll, soll, diff: 0 };
  const r = {};
  if (e.haus && e.beginn) r.hin = runden(dauer(e.haus, e.beginn) / 60);
  if (e.ende && e.zuhause) r.rueck = runden(dauer(e.ende, e.zuhause) / 60);
  if (e.beginn && e.ende) {
    const vor = dauer(e.beginn, e.ende) / 60;
    const abzug = Math.max(MIN_PAUSE, e.pause || 0);
    r.netto = Math.max(0, runden(vor - abzug / 60));
    r.ist = r.netto;
    r.soll = soll;
    r.diff = runden(r.netto - soll);
  }
  return r;
}

function monatssumme(praefix) {
  let netto = 0, diff = 0, fahrt = 0, tage = 0;
  Object.keys(daten).filter((iso) => iso.startsWith(praefix)).forEach((iso) => {
    const r = rechne(iso, daten[iso]);
    if (r.ist === undefined) return;
    tage++; netto += r.ist; diff += r.diff;
    fahrt += (r.hin || 0) + (r.rueck || 0);
  });
  return { netto: runden(netto), diff: runden(diff), fahrt: runden(fahrt), tage };
}

function liste() {
  const box = $('liste');
  box.textContent = '';
  const s = monatssumme(heute().slice(0, 7));
  $('summe').textContent = s.tage
    ? `Dieser Monat: ${s.tage} Tage · Ist ${zahl(s.netto)} h · Differenz ${vorzeichen(s.diff)} h · Fahrzeit ${zahl(s.fahrt)} h`
    : '';
  const tage = Object.keys(daten).sort().reverse().slice(0, 14);
  if (!tage.length) { box.textContent = 'Noch keine Einträge.'; return; }
  tage.forEach((iso) => {
    const e = daten[iso];
    const zeile = document.createElement('div');
    zeile.className = 'eintrag';
    const info = document.createElement('div');
    const titel = document.createElement('div');
    titel.textContent = anzeigeDatum(iso);
    const detail = document.createElement('div');
    detail.className = 't';
    detail.textContent = e.abw || ZEITFELDER.map((f) => e[f] || '–').join(' · ') + (e.ziel ? ` · ${e.ziel}` : '');
    const r = rechne(iso, e);
    const auswertung = document.createElement('div');
    auswertung.className = 't';
    if (r.ist !== undefined) {
      const fahrt = (r.hin || 0) + (r.rueck || 0);
      auswertung.textContent = `Ist ${zahl(r.ist)} h · Soll ${zahl(r.soll)} h · Diff ${vorzeichen(r.diff)} h` + (fahrt ? ` · Fahrt ${zahl(fahrt)} h` : '');
    }
    info.append(titel, detail, auswertung);
    const bearbeiten = document.createElement('button');
    bearbeiten.type = 'button';
    bearbeiten.textContent = 'Öffnen';
    bearbeiten.addEventListener('click', () => { formularFuellen(iso); window.scrollTo(0, 0); });
    zeile.append(info, bearbeiten);
    box.append(zeile);
  });
}

function csvErzeugen() {
  const kopf = ['Datum', 'Abwesenheit', NAMEN.haus, NAMEN.beginn, NAMEN.ende, NAMEN.zuhause, 'Pause (Min)', 'Ziel'];
  const zeilen = Object.keys(daten).sort().map((iso) => {
    const e = daten[iso];
    return [csvDatum(iso), e.abw || '', e.haus || '', e.beginn || '', e.ende || '', e.zuhause || '', e.pause ?? '', e.ziel || ''].join(';');
  });
  return '﻿' + [kopf.join(';'), ...zeilen].join('\r\n');
}

async function exportieren() {
  if (!Object.keys(daten).length) return meldung('fehler', 'Keine Einträge zum Teilen.');
  const datei = new File([csvErzeugen()], `Stunden-${heute()}.csv`, { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [datei] })) {
      await navigator.share({ files: [datei], title: 'Stundenerfassung' });
      return meldung('ok', 'CSV geteilt.');
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(datei);
    a.download = datei.name;
    a.click();
    URL.revokeObjectURL(a.href);
    meldung('ok', 'CSV heruntergeladen.');
  } catch (err) {
    if (err.name !== 'AbortError') return meldung('fehler', `Export fehlgeschlagen: ${err.message}`);
    return;
  }
  localStorage.setItem(KEY_EXPORT, String(Date.now()));
}

function importieren(datei) {
  const leserin = new FileReader();
  leserin.onerror = () => meldung('fehler', 'Datei konnte nicht gelesen werden.');
  leserin.onload = () => {
    const neu = {};
    const zeilen = String(leserin.result).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).slice(1);
    for (const z of zeilen) {
      const [dat, abw, haus, beginn, ende, zuhause, pause, zl] = z.split(';');
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dat || '');
      const zeit = (x) => !x || /^([01]\d|2[0-3]):[0-5]\d$/.test(x);
      const echt = m && new Date(+m[3], +m[2] - 1, +m[1]).getDate() === +m[1];
      if (!echt || ![haus, beginn, ende, zuhause].every(zeit) || (abw && !['Urlaub', 'Krank'].includes(abw))) {
        return meldung('fehler', `Import abgebrochen, ungültige Zeile: „${z}“. Nichts wurde geändert.`);
      }
      const e = { abw: abw || '' };
      if (haus) e.haus = haus;
      if (beginn) e.beginn = beginn;
      if (ende) e.ende = ende;
      if (zuhause) e.zuhause = zuhause;
      if (pause !== '' && pause !== undefined) e.pause = Number(pause);
      if (zl) e.ziel = zl;
      neu[`${m[3]}-${m[2]}-${m[1]}`] = e;
    }
    const anzahl = Object.keys(neu).length;
    if (!anzahl) return meldung('fehler', 'Die Datei enthält keine Einträge.');
    if (!confirm(`${anzahl} Einträge importieren? Vorhandene Einträge mit demselben Datum werden überschrieben.`)) return;
    const vorher = daten;
    try {
      daten = { ...daten, ...neu };
      sichern();
    } catch (err) {
      daten = vorher;
      return meldung('fehler', `Import fehlgeschlagen: ${err.message}`);
    }
    formularFuellen($('datum').value || heute());
    liste();
    meldung('ok', `${anzahl} Einträge importiert.`);
  };
  leserin.readAsText(datei, 'utf-8');
}

function sicherungHinweis() {
  if (!Object.keys(daten).length) return;
  const zuletzt = Number(localStorage.getItem(KEY_EXPORT)) || 0;
  if (Date.now() - zuletzt > 7 * 24 * 3600 * 1000) {
    meldung('info', 'Letzte Sicherung ist über 7 Tage her (oder fehlt). Bitte unten die CSV teilen und in OneDrive oder per E-Mail ablegen.');
  }
}

function start() {
  formularFuellen(heute());
  $('datum').addEventListener('change', () => { formularFuellen($('datum').value || heute()); meldung('', ''); });
  $('abw').addEventListener('change', abwesenheitAnwenden);
  document.querySelectorAll('[data-jetzt]').forEach((b) => b.addEventListener('click', () => jetztStempeln(b.dataset.jetzt)));
  document.querySelectorAll('.ziel').forEach((b) => b.addEventListener('click', () => zielSetzen(b.dataset.ziel)));
  $('speichern').addEventListener('click', speichern);
  $('export').addEventListener('click', exportieren);
  $('import').addEventListener('click', () => $('importdatei').click());
  $('importdatei').addEventListener('change', () => {
    if ($('importdatei').files[0]) importieren($('importdatei').files[0]);
    $('importdatei').value = '';
  });
  liste();
  sicherungHinweis();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}

start();
