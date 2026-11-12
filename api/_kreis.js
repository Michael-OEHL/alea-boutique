// aLea-Kreis: gemeinsame Funktionen. Daten liegen im privaten Blob-Store "alea-kreis"
// (Umgebungsvariablen mit Präfix KREIS_, z. B. KREIS_READ_WRITE_TOKEN).
import { createHmac } from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';
import nodemailer from 'nodemailer';

const PFAD = 'mitglieder/';

function opts() {
  const o = {};
  if (process.env.KREIS_READ_WRITE_TOKEN) o.token = process.env.KREIS_READ_WRITE_TOKEN;
  if (process.env.KREIS_STORE_ID) o.storeId = process.env.KREIS_STORE_ID;
  if (!o.token && !o.storeId) throw new Error('KREIS-Speicher nicht verbunden');
  return o;
}
function geheim() {
  const g = process.env.KREIS_READ_WRITE_TOKEN || process.env.PFLEGE_PASSWORT;
  if (!g) throw new Error('kein Schlüssel');
  return g;
}
export function signatur(id, zweck) {
  return createHmac('sha256', geheim()).update('alea-kreis:' + zweck + ':' + id).digest('base64url').slice(0, 32);
}
export function idFuer(schluessel) {
  return createHmac('sha256', geheim()).update('alea-kreis-id:' + schluessel).digest('hex').slice(0, 24);
}

export function telefonNorm(s) {
  let t = String(s || '').replace(/[^\d+]/g, '');
  if (t.startsWith('00')) t = '+' + t.slice(2);
  else if (t.startsWith('0')) t = '+43' + t.slice(1);
  else if (t && !t.startsWith('+')) t = '+' + t;
  return /^\+\d{8,15}$/.test(t) ? t : '';
}
export const mailOk = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);

export async function laden(id) {
  const r = await get(PFAD + id + '.json', { access: 'private', useCache: false, ...opts() }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export async function speichern(m) {
  await put(PFAD + m.id + '.json', JSON.stringify(m), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...opts() });
}
export async function loeschen(id) {
  await del(PFAD + id + '.json', opts());
}
export async function alle() {
  const o = opts();
  let cursor, blobs = [];
  do {
    const r = await list({ prefix: PFAD, limit: 1000, cursor, ...o });
    blobs = blobs.concat(r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const out = [];
  for (let i = 0; i < blobs.length; i += 20) {
    const teil = await Promise.all(blobs.slice(i, i + 20).map((b) => get(b.pathname, { access: 'private', useCache: false, ...o })
      .then((r) => (r && r.statusCode === 200 ? new Response(r.stream).json() : null)).catch(() => null)));
    teil.forEach((m) => m && out.push(m));
  }
  return out;
}

export function basisUrl(request) {
  const u = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || u.host;
  return 'https://' + host;
}
export async function mail({ an, betreff, text, antwortAn }) {
  const pass = process.env.SMTP_PASS;
  if (!pass) throw new Error('SMTP_PASS fehlt');
  const user = process.env.SMTP_USER || 'kontakt@alea-boutique.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.ionos.de', port, secure: port === 465, auth: { user, pass } });
  await t.sendMail({ from: { name: 'aLea Boutique', address: user }, to: an, replyTo: antwortAn, subject: betreff, text });
}
