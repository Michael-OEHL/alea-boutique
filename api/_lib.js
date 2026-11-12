import { createHmac, timingSafeEqual } from 'node:crypto';
import { list, put, del } from '@vercel/blob';

const TAG = 30 * 24 * 3600 * 1000;
const PREFIX = 'daten/inhalte-';

function key() {
  const pw = process.env.PFLEGE_PASSWORT;
  if (!pw) throw new Error('PFLEGE_PASSWORT fehlt');
  return pw;
}
function sign(exp) {
  return createHmac('sha256', key()).update('alea-pflege:' + exp).digest('base64url');
}
export function makeToken() {
  const exp = Date.now() + TAG;
  return exp + '.' + sign(exp);
}
export function checkPassword(input) {
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(key());
  return a.length === b.length && timingSafeEqual(a, b);
}
export function authorized(request) {
  try {
    const h = request.headers.get('authorization') || '';
    const t = h.replace(/^Bearer\s+/i, '');
    const [exp, sig] = t.split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const s = Buffer.from(sign(exp));
    const g = Buffer.from(sig);
    return s.length === g.length && timingSafeEqual(s, g);
  } catch {
    return false;
  }
}
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } });
}
export const LEER = { saison: null, neu: [], events: [], eventFotos: {}, geaendert: null };

export async function lesen() {
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  if (!blobs.length) return { ...LEER };
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  if (!r.ok) return { ...LEER };
  return { ...LEER, ...(await r.json()) };
}
export async function schreiben(inhalt) {
  inhalt.geaendert = new Date().toISOString();
  const name = PREFIX + String(Date.now()).padStart(15, '0') + '.json';
  await put(name, JSON.stringify(inhalt), { access: 'public', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 31536000 });
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  const alt = blobs.slice(20).map((b) => b.url);
  if (alt.length) await del(alt);
  return inhalt;
}
