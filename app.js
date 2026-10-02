'use strict';

const KEY = 'sb_eintraege';
const KEY_EXPORT = 'sb_letzter_export';
const ZEITFELDER = ['haus', 'beginn', 'ende', 'zuhause'];
const NAMEN = { haus: 'Haus verlassen', beginn: 'Arbeitsbeginn', ende: 'Arbeitsende', zuhause: 'Ankunft zu Hause' };
const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const $ = (id) => document.getElementById(id);
let daten = laden();
let ziel = 'Baustelle';

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

let seite = 'eingabe';

// Die Meldung erscheint auf der gerade sichtbaren Seite.
function meldung(art, text) {
  const hier = $(seite === 'dashboard' ? 'meldung2' : 'meldung');
  const dort = $(seite === 'dashboard' ? 'meldung' : 'meldung2');
  dort.className = '';
  dort.textContent = '';
  hier.className = art;
  hier.textContent = text;
}

function seiteWechseln(name) {
  seite = name;
  ['eingabe', 'dashboard'].forEach((s) => {
    $(`seite-${s}`).hidden = s !== name;
    $(`tab-${s}`).setAttribute('aria-selected', String(s === name));
  });
  if (name === 'dashboard') liste();
  window.scrollTo(0, 0);
}

// Uhrzeit per Zahlentastatur: 745, 0745, 7:45 oder 7 (= 07:00) ergeben 07:45 bzw. 07:00. Ungültig liefert null.
function zeitNormal(s) {
  s = s.trim();
  if (!s) return '';
  let h, mi;
  if (/[:.,]/.test(s)) {
    [h, mi = '0'] = s.split(/[:.,]/);
  } else {
    const d = s.replace(/\D/g, '');
    if (d.length <= 2) { h = d; mi = '0'; }
    else if (d.length === 3) { h = d.slice(0, 1); mi = d.slice(1); }
    else if (d.length === 4) { h = d.slice(0, 2); mi = d.slice(2); }
    else return null;
  }
  if (!/^\d{1,2}$/.test(h) || !/^\d{1,2}$/.test(mi) || +h > 23 || +mi > 59) return null;
  return `${h.padStart(2, '0')}:${mi.padStart(2, '0')}`;
}

function zeitFeldPruefen(feld) {
  const n = zeitNormal(feld.value);
  feld.classList.toggle('ungueltig', n === null);
  if (n !== null) feld.value = n;
  return n;
}

function tagHinweis(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const wt = new Date(j, m - 1, t).getDay();
  const f = feiertagName(iso);
  $('tagHinweis').textContent = f ? `Feiertag: ${f}` : (wt === 0 || wt === 6 ? 'Wochenende' : '');
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
  ZEITFELDER.forEach((f) => { $(f).value = e[f] || ''; $(f).classList.remove('ungueltig'); });
  $('pause').value = e.pause ?? '';
  tagHinweis(iso);
  zielSetzen(e.ziel || 'Baustelle');
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
  if (!$('abw').value) {
    for (const f of ZEITFELDER) {
      if (zeitFeldPruefen($(f)) === null) return meldung('fehler', `${NAMEN[f]}: ungültige Uhrzeit. Bitte als hhmm eingeben, zum Beispiel 0745.`);
    }
  }
  const e = formularLesen();
  if (e.pause !== undefined && !(e.pause >= 0 && e.pause <= 600)) return meldung('fehler', 'Pause muss zwischen 0 und 600 Minuten liegen.');
  if (leer(e)) return meldung('fehler', 'Nichts zum Speichern: bitte mindestens eine Zeit oder Abwesenheit eintragen.');
  try {
    daten[iso] = e;
    sichern();
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

// Berechnung wie in der Excel-Datei: Fahrzeit, Netto nach Pause (mindestens 30 Min), Soll 8 h Mo bis Fr
// außer an bayerischen Feiertagen.
const SOLL_H = 8;
const MIN_PAUSE = 30;
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

// Ostersonntag nach der Gaußschen Osterformel (gregorianisch).
function ostern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, monat - 1, tag);
}

// Bayerische gesetzliche Feiertage, dazu Mariä Himmelfahrt (nur in überwiegend katholischen Gemeinden)
// und die freien Kulanztage 24.12. und 31.12. wie in der Excel-Datei. Das Augsburger Friedensfest fehlt.
const feiertagCache = {};
function feiertage(jahr) {
  if (feiertagCache[jahr]) return feiertagCache[jahr];
  const o = ostern(jahr);
  const nach = (n) => isoVon(new Date(jahr, o.getMonth(), o.getDate() + n));
  const f = {
    [`${jahr}-01-01`]: 'Neujahr',
    [`${jahr}-01-06`]: 'Heilige Drei Könige',
    [nach(-2)]: 'Karfreitag',
    [nach(1)]: 'Ostermontag',
    [`${jahr}-05-01`]: 'Tag der Arbeit',
    [nach(39)]: 'Christi Himmelfahrt',
    [nach(50)]: 'Pfingstmontag',
    [nach(60)]: 'Fronleichnam',
    [`${jahr}-08-15`]: 'Mariä Himmelfahrt (kath. Gemeinden)',
    [`${jahr}-10-03`]: 'Tag der Deutschen Einheit',
    [`${jahr}-11-01`]: 'Allerheiligen',
    [`${jahr}-12-24`]: 'Heiligabend (frei, Kulanz)',
    [`${jahr}-12-25`]: '1. Weihnachtsfeiertag',
    [`${jahr}-12-26`]: '2. Weihnachtsfeiertag',
    [`${jahr}-12-31`]: 'Silvester (frei, Kulanz)',
  };
  return (feiertagCache[jahr] = f);
}
function feiertagName(iso) { return feiertage(Number(iso.slice(0, 4)))[iso] || ''; }

function minuten(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function dauer(von, bis) { return ((minuten(bis) - minuten(von)) % 1440 + 1440) % 1440; }
function runden(x) { return Math.round(x * 100) / 100; }
function zahl(x) { return x.toFixed(2).replace('.', ','); }
function vorzeichen(x) { return (x > 0 ? '+' : '') + zahl(x); }

function rechne(iso, e) {
  const [j, m, t] = iso.split('-').map(Number);
  const wt = new Date(j, m - 1, t).getDay();
  const soll = wt >= 1 && wt <= 5 && !feiertagName(iso) ? SOLL_H : 0;
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

function montagVon(iso) {
  const [j, m, t] = iso.split('-').map(Number);
  const d = new Date(j, m - 1, t);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

// ISO-Kalenderwoche (Montag als Wochenbeginn, KW 1 enthält den 4. Januar), bestimmt über den Donnerstag.
function kalenderwoche(montag) {
  const don = new Date(montag.getFullYear(), montag.getMonth(), montag.getDate() + 3);
  const tag = Math.round((don - new Date(don.getFullYear(), 0, 1)) / 86400000);
  return { kw: Math.floor(tag / 7) + 1, jahr: don.getFullYear() };
}

function kurzDatum(d) { return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; }

const WOCHEN_ANZAHL = 8;
const SVG_NS = 'http://www.w3.org/2000/svg';

function html(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

function svg(tag, attr, text) {
  const e = document.createElementNS(SVG_NS, tag);
  Object.entries(attr || {}).forEach(([k, v]) => e.setAttribute(k, v));
  if (text !== undefined) e.textContent = text;
  return e;
}

function kachel(label, wert, einheit, klein, hero) {
  const k = html('div', 'kachel' + (hero ? ' hero' : ''));
  k.append(html('div', 'l', label));
  const w = html('div', 'w', wert);
  if (einheit) w.append(html('span', 'e', ` ${einheit}`));
  k.append(w);
  if (klein) k.append(html('div', 'k', klein));
  return k;
}

function zahl1(x) { return x.toFixed(1).replace('.', ','); }

// Balken mit 4 px Rundung nur am oberen Ende, die Basis bleibt gerade.
function balkenPfad(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

let gewaehlteWoche = '';

// Die letzten Wochen bis zum Ende des angezeigten Monats (im laufenden Monat bis heute), auch leere Wochen.
function wochenDaten() {
  const jetztD = new Date();
  const imMonat = jetztD.getFullYear() === anzeigeMonat.j && jetztD.getMonth() === anzeigeMonat.m;
  const ende = imMonat ? jetztD : new Date(anzeigeMonat.j, anzeigeMonat.m + 1, 0);
  const mo0 = montagVon(isoVon(ende));
  const wochen = [];
  for (let i = WOCHEN_ANZAHL - 1; i >= 0; i--) {
    const mo = new Date(mo0.getFullYear(), mo0.getMonth(), mo0.getDate() - 7 * i);
    wochen.push({ mo, key: isoVon(mo), ist: 0, soll: 0, diff: 0, fahrt: 0, tage: 0 });
  }
  const index = Object.fromEntries(wochen.map((w) => [w.key, w]));
  Object.keys(daten).forEach((iso) => {
    const w = index[isoVon(montagVon(iso))];
    const r = rechne(iso, daten[iso]);
    if (!w || r.ist === undefined) return;
    w.ist += r.ist; w.soll += r.soll; w.diff += r.diff; w.tage++;
    w.fahrt += (r.hin || 0) + (r.rueck || 0);
  });
  return wochen;
}

function wochenText(w) {
  const { kw, jahr } = kalenderwoche(w.mo);
  const so = new Date(w.mo.getFullYear(), w.mo.getMonth(), w.mo.getDate() + 6);
  return {
    titel: `KW ${kw}/${jahr} (${kurzDatum(w.mo)} bis ${kurzDatum(so)})`,
    werte: `Ist ${zahl(runden(w.ist))} h · Soll ${zahl(runden(w.soll))} h · Diff ${vorzeichen(runden(w.diff))} h · Fahrt ${zahl(runden(w.fahrt))} h`,
    kw,
  };
}

function wochenAnzeigen() {
  const wochen = wochenDaten();
  const box = $('wochenChart');
  box.textContent = '';
  $('wochenDetail').textContent = '';
  $('wochenSumme').textContent = '';
  $('wochen').textContent = '';
  if (!wochen.some((w) => w.tage)) { box.textContent = 'Noch keine Auswertung.'; return; }
  if (!wochen.some((w) => w.key === gewaehlteWoche)) gewaehlteWoche = (wochen.filter((w) => w.tage).pop() || wochen[wochen.length - 1]).key;

  const n = wochen.length;
  const W = 340, H = 214, L = 30, R = 6, T = 18, B = 36;
  const pw = W - L - R, ph = H - T - B, slot = pw / n, bw = Math.min(20, slot * 0.5);
  const skala = Math.ceil(Math.max(10, ...wochen.map((w) => Math.max(w.ist, w.soll))) / 10) * 10;
  const y = (v) => T + ph - (v / skala) * ph;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Ist-Stunden pro Kalenderwoche mit Soll-Markierung' });

  [0, skala / 2, skala].forEach((v) => {
    s.append(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: '#E2E2E2', 'stroke-width': 1 }));
    s.append(svg('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end', 'font-size': 9, fill: '#777' }, String(v)));
  });

  wochen.forEach((w, i) => {
    const cx = L + slot * (i + 0.5);
    const gew = w.key === gewaehlteWoche;
    const t = wochenText(w);
    if (gew) s.append(svg('rect', { x: L + slot * i + 1, y: T - 12, width: slot - 2, height: ph + B - 2, rx: 4, fill: '#F4F4F4' }));
    if (w.ist > 0) s.append(svg('path', { d: balkenPfad(cx - bw / 2, y(w.ist), bw, ph * w.ist / skala, 4), fill: '#7C1E1E' }));
    if (w.soll > 0) s.append(svg('line', { x1: cx - slot * 0.4, x2: cx + slot * 0.4, y1: y(w.soll), y2: y(w.soll), stroke: '#333333', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    if (w.ist > 0) s.append(svg('text', { x: cx, y: y(Math.max(w.ist, w.soll)) - 5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: '#1A1A1A' }, zahl1(runden(w.ist))));
    s.append(svg('text', { x: cx, y: H - B + 15, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': gew ? 700 : 500, fill: '#1A1A1A' }, `KW ${t.kw}`));
    s.append(svg('text', { x: cx, y: H - B + 27, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#777' }, kurzDatum(w.mo)));
    const treffer = svg('rect', { x: L + slot * i, y: 0, width: slot, height: H, fill: 'transparent', tabindex: 0, role: 'button', 'aria-label': `${t.titel}: ${t.werte}`, style: 'cursor:pointer' });
    const waehlen = () => { gewaehlteWoche = w.key; wochenAnzeigen(); };
    treffer.addEventListener('click', waehlen);
    treffer.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); waehlen(); } });
    s.append(treffer);
  });
  box.append(s);

  const gew = wochen.find((w) => w.key === gewaehlteWoche);
  const gt = wochenText(gew);
  $('wochenDetail').append(html('b', '', gt.titel), html('div', '', `${gt.werte} · ${gew.tage} ${gew.tage === 1 ? 'Tag' : 'Tage'}`));

  const summe = wochen.reduce((a, w) => ({ ist: a.ist + w.ist, soll: a.soll + w.soll, diff: a.diff + w.diff, fahrt: a.fahrt + w.fahrt }), { ist: 0, soll: 0, diff: 0, fahrt: 0 });
  $('wochenSumme').append(
    kachel(`Summe ${n} Wochen`, zahl(runden(summe.ist)), 'h', `Soll ${zahl(runden(summe.soll))} h`, true),
    kachel('Differenz', vorzeichen(runden(summe.diff)), 'h', `Fahrzeit ${zahl(runden(summe.fahrt))} h`),
  );

  // Tabellenansicht mit denselben Werten
  const tab = html('table');
  const kopf = html('tr');
  ['Woche', 'Ist', 'Soll', 'Diff', 'Fahrt'].forEach((h) => kopf.append(html('th', '', h)));
  tab.append(kopf);
  const zeile = (name, w, fett) => {
    const tr = html('tr', fett ? 'fett' : '');
    [name, zahl(runden(w.ist)), zahl(runden(w.soll)), vorzeichen(runden(w.diff)), zahl(runden(w.fahrt))].forEach((v) => tr.append(html('td', '', v)));
    tab.append(tr);
  };
  wochen.forEach((w) => zeile(`KW ${wochenText(w).kw}`, w, false));
  zeile('Summe', summe, true);
  $('wochen').append(tab);
}

let anzeigeMonat = { j: new Date().getFullYear(), m: new Date().getMonth() };

function tageListe(daten_) { return daten_.map((iso) => `${iso.slice(8)}.${iso.slice(5, 7)}.`).join(', '); }

function monatAnzeigen() {
  const { j, m } = anzeigeMonat;
  $('monatTitel').textContent = `${MONATE[m]} ${j}`;
  const box = $('liste');
  box.textContent = '';
  const s = { ist: 0, soll: 0, diff: 0, fahrt: 0, erfasst: 0 };
  const anzahl = new Date(j, m + 1, 0).getDate();
  for (let t = 1; t <= anzahl; t++) {
    const iso = isoVon(new Date(j, m, t));
    const e = daten[iso];
    const wt = new Date(j, m, t).getDay();
    const feier = feiertagName(iso);
    const r = e ? rechne(iso, e) : {};
    if (r.ist !== undefined) {
      s.erfasst++; s.ist += r.ist; s.soll += r.soll; s.diff += r.diff;
      s.fahrt += (r.hin || 0) + (r.rueck || 0);
    }
    const kopf = `${WOCHENTAGE[wt]} ${String(t).padStart(2, '0')}.${String(m + 1).padStart(2, '0')}.`;
    const oeffnen = () => { formularFuellen(iso); seiteWechseln('eingabe'); };
    const freierTag = feier || wt === 0 || wt === 6;
    const zeile = html('div', 'eintrag' + (feier ? ' feiertag' : (freierTag ? ' frei' : '')));

    // Wochenende und Feiertage ohne Eintrag: eine schmale Zeile, ein Tipp öffnet den Tag.
    if (freierTag && !e) {
      zeile.classList.add('kompakt');
      zeile.append(html('span', '', kopf + (feier ? ` · ${feier}` : '')));
      zeile.tabIndex = 0;
      zeile.setAttribute('role', 'button');
      zeile.addEventListener('click', oeffnen);
      zeile.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') oeffnen(); });
      box.append(zeile);
      continue;
    }

    const info = html('div');
    info.append(html('div', 'tag', kopf + (feier ? ` · ${feier}` : '')));
    if (e) {
      info.append(html('div', 't', e.abw || ZEITFELDER.map((f) => e[f] || '–').join(' · ') + (e.ziel ? ` · ${e.ziel}` : '')));
      if (r.ist !== undefined) {
        const fahrt = (r.hin || 0) + (r.rueck || 0);
        info.append(html('div', 't', `Ist ${zahl(r.ist)} h · Soll ${zahl(r.soll)} h · Diff ${vorzeichen(r.diff)} h` + (fahrt ? ` · Fahrt ${zahl(fahrt)} h` : '')));
        const balken = html('div', 'balken' + (r.soll > 0 ? ' mitsoll' : ''));
        const fuell = html('i');
        fuell.style.width = `${Math.min(100, (r.ist / 10) * 100)}%`;
        balken.append(fuell);
        info.append(balken);
      }
    }
    const knopf = html('button', '', e ? 'Öffnen' : 'Eintragen');
    knopf.type = 'button';
    knopf.addEventListener('click', oeffnen);
    zeile.append(info, knopf);
    box.append(zeile);
  }

  const kacheln = $('monatSumme');
  kacheln.textContent = '';
  if (!s.erfasst) { kacheln.append(html('div', 'leer', 'Keine Einträge in diesem Monat.')); return; }
  kacheln.append(
    kachel('Ist', zahl(runden(s.ist)), 'h', `${s.erfasst} ${s.erfasst === 1 ? 'Tag' : 'Tage'} erfasst`, true),
    kachel('Soll', zahl(runden(s.soll)), 'h'),
    kachel('Differenz', vorzeichen(runden(s.diff)), 'h'),
    kachel('Fahrzeit', zahl(runden(s.fahrt)), 'h'),
  );
}

// Urlaub und Krank im Jahr des angezeigten Monats: nur Tage mit Soll zählen (kein Wochenende, kein Feiertag).
function urlaubAnzeigen() {
  const jahr = String(anzeigeMonat.j);
  const sammle = (art) => Object.keys(daten).sort()
    .filter((iso) => iso.startsWith(jahr) && daten[iso].abw === art && rechne(iso, daten[iso]).soll > 0);
  const urlaub = sammle('Urlaub');
  const krank = sammle('Krank');
  const box = $('urlaubJahr');
  box.textContent = '';
  const einheit = (l) => (l.length === 1 ? 'Tag' : 'Tage');
  box.append(
    kachel(`Urlaub ${jahr}`, String(urlaub.length), einheit(urlaub), urlaub.length ? tageListe(urlaub) : ''),
    kachel(`Krank ${jahr}`, String(krank.length), einheit(krank), krank.length ? tageListe(krank) : ''),
  );
}

function liste() {
  monatAnzeigen();
  urlaubAnzeigen();
  wochenAnzeigen();
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
      await navigator.share({ files: [datei], title: 'WorkingHours' });
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
    meldung('info', 'Letzte Sicherung ist über 7 Tage her (oder fehlt). Bitte im Dashboard unter „Sicherung“ die CSV teilen und in OneDrive oder per E-Mail ablegen.');
  }
}

function start() {
  formularFuellen(heute());
  $('datum').addEventListener('change', () => { formularFuellen($('datum').value || heute()); meldung('', ''); });
  $('abw').addEventListener('change', abwesenheitAnwenden);
  document.querySelectorAll('[data-jetzt]').forEach((b) => b.addEventListener('click', () => jetztStempeln(b.dataset.jetzt)));
  document.querySelectorAll('.ziel').forEach((b) => b.addEventListener('click', () => zielSetzen(b.dataset.ziel)));
  $('speichern').addEventListener('click', speichern);
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => seiteWechseln(b.dataset.seite)));
  const monatSchieben = (n) => {
    const d = new Date(anzeigeMonat.j, anzeigeMonat.m + n, 1);
    anzeigeMonat = { j: d.getFullYear(), m: d.getMonth() };
    liste();
  };
  $('monatZurueck').addEventListener('click', () => monatSchieben(-1));
  $('monatVor').addEventListener('click', () => monatSchieben(1));
  ZEITFELDER.forEach((f) => {
    const feld = $(f);
    // Bei vier getippten Ziffern sofort umformatieren, sonst beim Verlassen des Feldes.
    feld.addEventListener('input', () => { if (/^\d{4}$/.test(feld.value)) zeitFeldPruefen(feld); else feld.classList.remove('ungueltig'); });
    feld.addEventListener('blur', () => zeitFeldPruefen(feld));
  });
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
