// aLea-Kreis für die Pflege: Mitglieder ansehen und entfernen (nur mit Pflege-Login).
import { json, authorized } from './_lib.js';
import { alle, loeschen, signatur, basisUrl } from './_kreis.js';

export async function GET(request) {
  if (!authorized(request)) return json({ ok: false, fehler: 'login' }, 401, { 'cache-control': 'no-store' });
  try {
    const basis = basisUrl(request);
    const liste = (await alle()).sort((a, b) => (a.angemeldet < b.angemeldet ? 1 : -1)).map((m) => ({
      id: m.id, name: m.name, plz: m.plz, angemeldet: m.angemeldet, quelle: m.quelle || 'website',
      tel: m.einwilligung && m.einwilligung.wa ? m.tel : '',
      email: m.einwilligung && m.einwilligung.mail ? m.email : '',
      mailBestaetigt: !!(m.einwilligung && m.einwilligung.mail && m.einwilligung.mail.bestaetigt),
      geburtstag: m.geburtstag || null,
      abmelden: basis + '/kreis?abmelden=' + m.id + '&s=' + signatur(m.id, 'ab'),
    }));
    return json({ ok: true, liste }, 200, { 'cache-control': 'no-store' });
  } catch (e) {
    console.error('Kreis-Liste:', e && e.message);
    return json({ ok: false, fehler: 'speicher' }, 503, { 'cache-control': 'no-store' });
  }
}

export async function POST(request) {
  if (!authorized(request)) return json({ ok: false, fehler: 'login' }, 401);
  let b;
  try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (b.aktion !== 'entfernen' || !/^[a-f0-9]{24}$/.test(String(b.id || ''))) return json({ ok: false }, 400);
  await loeschen(b.id);
  return json({ ok: true });
}
