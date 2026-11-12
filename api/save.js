import { del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { authorized, lesen, schreiben, json } from './_lib.js';

const txt = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const datum = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null);
const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
function foto(f) {
  if (!f || !BLOB.test(f.url) || !BLOB.test(f.urlKlein || f.url)) return null;
  return { url: f.url, urlKlein: f.urlKlein || f.url, w: Math.round(+f.w) || 1200, h: Math.round(+f.h) || 1500, alt: txt(f.alt, 160) };
}
const fotos = (arr) => (Array.isArray(arr) ? arr.map(foto).filter(Boolean).slice(0, 30) : []);
const urls = (arr) => (arr || []).flatMap((f) => [f.url, f.urlKlein]).filter((u, i, a) => u && a.indexOf(u) === i);
const STATISCH = ['wine', 'lang', 'eroeffnung'];

export async function POST(request) {
  if (!authorized(request)) return json({ fehler: 'Bitte neu anmelden.' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ fehler: 'Ungültige Anfrage.' }, 400); }
  const inh = await lesen();
  let weg = [];

  if (b.aktion === 'saison-setzen') {
    if (!txt(b.titel, 90)) return json({ fehler: 'Bitte eine Überschrift eingeben.' }, 400);
    inh.saison = { titel: txt(b.titel, 90), text: txt(b.text, 400) };
  } else if (b.aktion === 'neu-anlegen') {
    const f = foto(b.foto);
    if (!f || !txt(b.titel, 90)) return json({ fehler: 'Foto und Titel fehlen.' }, 400);
    inh.neu.unshift({ id: randomUUID(), titel: txt(b.titel, 90), text: txt(b.text, 300), foto: f, datum: new Date().toISOString().slice(0, 10) });
    weg = inh.neu.slice(12).flatMap((n) => urls([n.foto]));
    inh.neu = inh.neu.slice(0, 12);
  } else if (b.aktion === 'neu-loeschen') {
    const n = inh.neu.find((x) => x.id === b.id);
    if (n) weg = urls([n.foto]);
    inh.neu = inh.neu.filter((x) => x.id !== b.id);
  } else if (b.aktion === 'event-anlegen') {
    if (!txt(b.titel, 90) || !datum(b.datum)) return json({ fehler: 'Titel und Datum fehlen.' }, 400);
    inh.events.unshift({ id: randomUUID(), titel: txt(b.titel, 90), datum: b.datum, text: txt(b.text, 600), fotos: fotos(b.fotos) });
  } else if (b.aktion === 'event-loeschen') {
    const e = inh.events.find((x) => x.id === b.id);
    if (e) weg = urls(e.fotos);
    inh.events = inh.events.filter((x) => x.id !== b.id);
  } else if (b.aktion === 'fotos-ergaenzen') {
    const neue = fotos(b.fotos);
    if (!neue.length) return json({ fehler: 'Keine Fotos.' }, 400);
    const e = inh.events.find((x) => x.id === b.event);
    if (e) e.fotos = [...e.fotos, ...neue].slice(0, 40);
    else if (STATISCH.includes(b.event)) inh.eventFotos[b.event] = [...(inh.eventFotos[b.event] || []), ...neue].slice(0, 40);
    else return json({ fehler: 'Event nicht gefunden.' }, 400);
  } else if (b.aktion === 'foto-loeschen') {
    const e = inh.events.find((x) => x.id === b.event);
    const liste = e ? e.fotos : inh.eventFotos[b.event] || [];
    const rest = liste.filter((f) => f.url !== b.url);
    weg = urls(liste.filter((f) => f.url === b.url));
    if (e) e.fotos = rest; else inh.eventFotos[b.event] = rest;
  } else {
    return json({ fehler: 'Unbekannte Aktion.' }, 400);
  }

  await schreiben(inh);
  if (weg.length) { try { await del(weg); } catch {} }
  return json(inh);
}
