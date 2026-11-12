// aLea-Kreis: Anmelden, E-Mail bestätigen, Abmelden.
import { json } from './_lib.js';
import { laden, speichern, loeschen, idFuer, signatur, telefonNorm, mailOk, basisUrl, mail } from './_kreis.js';

export const EINWILLIGUNG = {
  wa: 'Ja, schickt mir Neuheiten, Einladungen und persönliche Angebote per WhatsApp an diese Nummer. Abmelden geht jederzeit.',
  mail: 'Ja, schickt mir Neuheiten, Einladungen und persönliche Angebote per E-Mail. Abmelden geht jederzeit.',
};
const sauber = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, n);
const gebText = (g) => (!g ? '–' : (g.tag ? g.tag + '.' + g.monat + '.' : '') + (g.jahr ? (g.tag ? '' : 'Jahrgang ') + g.jahr : ''));
const vorname = (n) => String(n || '').trim().split(/\s+/)[0] || '';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, fehler: 'format' }, 400); }
  const aktion = b.aktion || 'anmelden';
  try {
    if (aktion === 'bestaetigen') return await bestaetigen(b);
    if (aktion === 'abmelden') return await abmelden(b);
    return await anmelden(b, request);
  } catch (e) {
    console.error('aLea-Kreis:', aktion, e && e.message);
    return json({ ok: false, fehler: 'server' }, 500);
  }
}

async function anmelden(b, request) {
  if (sauber(b.website, 100)) return json({ ok: true, mail: false });
  if (!Number(b.t) || Date.now() - Number(b.t) < 3000) return json({ ok: true, mail: false });

  const name = sauber(b.name, 80);
  const plz = sauber(b.plz, 5);
  const wa = b.wa === true || b.wa === 'on';
  const perMail = b.mail === true || b.mail === 'on';
  const tel = wa ? telefonNorm(b.tel) : '';
  const email = perMail ? sauber(b.email, 150).toLowerCase() : '';
  const tag = parseInt(b.gebTag, 10), monat = parseInt(b.gebMonat, 10);
  const jahrJetzt = new Date().getFullYear();
  const jahrRoh = parseInt(b.gebJahr, 10);
  const jahr = jahrRoh >= jahrJetzt - 100 && jahrRoh <= jahrJetzt - 14 ? jahrRoh : null;
  const geburtstag = tag >= 1 && tag <= 31 && monat >= 1 && monat <= 12 ? { tag, monat, jahr } : jahr ? { tag: null, monat: null, jahr } : null;

  if (!name) return json({ ok: false, fehler: 'name' }, 400);
  if (!/^\d{4,5}$/.test(plz)) return json({ ok: false, fehler: 'plz' }, 400);
  if (!wa && !perMail) return json({ ok: false, fehler: 'weg' }, 400);
  if (wa && !tel) return json({ ok: false, fehler: 'tel' }, 400);
  if (perMail && !mailOk(email)) return json({ ok: false, fehler: 'email' }, 400);

  const id = idFuer(tel || email);
  const jetzt = new Date().toISOString();
  const alt = (await laden(id)) || {};
  const m = {
    ...alt,
    id, name, plz,
    tel: tel || alt.tel || '',
    email: email || alt.email || '',
    geburtstag: geburtstag || alt.geburtstag || null,
    angemeldet: alt.angemeldet || jetzt,
    geaendert: jetzt,
    quelle: sauber(b.quelle, 30) || alt.quelle || 'website',
    einwilligung: { ...(alt.einwilligung || {}) },
  };
  if (wa) m.einwilligung.wa = { am: jetzt, text: EINWILLIGUNG.wa };
  const mailNeu = perMail && !(alt.einwilligung && alt.einwilligung.mail && alt.einwilligung.mail.bestaetigt && alt.email === email);
  if (perMail && mailNeu) m.einwilligung.mail = { am: jetzt, text: EINWILLIGUNG.mail, bestaetigt: null };
  await speichern(m);

  const basis = basisUrl(request);
  let mailGesendet = false;
  if (mailNeu) {
    const link = basis + '/kreis?bestaetigen=' + id + '&s=' + signatur(id, 'ok');
    const ab = basis + '/kreis?abmelden=' + id + '&s=' + signatur(id, 'ab');
    try {
      await mail({
        an: email,
        betreff: 'Bitte bestätige deine Anmeldung zum aLea-Kreis',
        text: 'Hallo ' + vorname(name) + ',\n\nschön, dass du im aLea-Kreis dabei sein möchtest! Bitte bestätige noch kurz deine E-Mail-Adresse:\n\n' + link +
          '\n\nWenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach. Dann schicken wir dir nichts.\n\nHerzliche Grüße\nSteffi & Kathi\n\naLea Boutique OG · Marktplatz 18 · 4680 Haag am Hausruck\nAbmelden: ' + ab + '\n',
      });
      mailGesendet = true;
    } catch (e) { console.error('Bestätigungsmail:', e && e.message); }
  }
  try {
    await mail({
      an: process.env.ANFRAGE_AN || 'kontakt@alea-boutique.com',
      betreff: (alt.id ? 'aLea-Kreis aktualisiert: ' : 'Neu im aLea-Kreis: ') + name + ' (' + plz + ')',
      text: [
        (alt.id ? 'Angaben aktualisiert' : 'Neue Anmeldung') + ' im aLea-Kreis',
        '',
        'Name: ' + name,
        'PLZ: ' + plz,
        'WhatsApp: ' + (m.einwilligung.wa ? m.tel + '  → bitte in die WhatsApp-Liste aufnehmen' : 'nein'),
        'E-Mail: ' + (m.einwilligung.mail ? m.email + (m.einwilligung.mail.bestaetigt ? ' (bestätigt)' : ' (Bestätigung ausstehend)') : 'nein'),
        'Geburtstag: ' + gebText(m.geburtstag),
        '',
        'Alle Mitglieder: ' + basis + '/pflege',
      ].join('\n'),
    });
  } catch (e) { console.error('Info-Mail:', e && e.message); }

  return json({ ok: true, mail: mailNeu, mailGesendet, wa: !!m.einwilligung.wa });
}

async function bestaetigen(b) {
  const id = sauber(b.id, 40);
  if (!id || sauber(b.s, 60) !== signatur(id, 'ok')) return json({ ok: false, fehler: 'link' }, 400);
  const m = await laden(id);
  if (!m || !m.einwilligung || !m.einwilligung.mail) return json({ ok: false, fehler: 'weg' }, 404);
  if (!m.einwilligung.mail.bestaetigt) {
    m.einwilligung.mail.bestaetigt = new Date().toISOString();
    await speichern(m);
  }
  return json({ ok: true, name: vorname(m.name) });
}

async function abmelden(b) {
  const id = sauber(b.id, 40);
  if (!id || sauber(b.s, 60) !== signatur(id, 'ab')) return json({ ok: false, fehler: 'link' }, 400);
  const m = await laden(id);
  if (m) {
    await loeschen(id);
    try {
      await mail({
        an: process.env.ANFRAGE_AN || 'kontakt@alea-boutique.com',
        betreff: 'Abmeldung aLea-Kreis: ' + m.name,
        text: m.name + ' hat sich vom aLea-Kreis abgemeldet. Die Daten sind gelöscht.' + (m.tel ? '\nBitte die Nummer ' + m.tel + ' aus der WhatsApp-Liste entfernen.' : ''),
      });
    } catch (e) { console.error('Info-Mail:', e && e.message); }
  }
  return json({ ok: true });
}
