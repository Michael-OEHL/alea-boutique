// Private-Shopping-Anfrage: prüft die Angaben und schickt sie per E-Mail an aLea.
// Benötigte Umgebungsvariablen in Vercel: SMTP_PASS (Passwort des Postfachs kontakt@alea-boutique.com).
// Optional: SMTP_USER, SMTP_HOST, SMTP_PORT, ANFRAGE_AN.
import nodemailer from 'nodemailer';
import { json } from './_lib.js';

const MAX = { name: 100, kontakt: 150, nachricht: 1500 };

function sauber(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}
function datumText(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const d = new Date(iso + 'T12:00:00Z');
  if (isNaN(d)) return '';
  return new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' }).format(d);
}
const istMail = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s);
const istTelefon = (s) => /^[+\d][\d\s/()-]{5,}$/.test(s);

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, fehler: 'format' }, 400); }

  // Spam-Schutz: verstecktes Feld muss leer sein, Formular mindestens 3 Sekunden offen.
  if (sauber(b.website, 200)) return json({ ok: true });
  const offen = Number(b.t);
  if (!offen || Date.now() - offen < 3000) return json({ ok: true });

  const name = sauber(b.name, MAX.name);
  const kontakt = sauber(b.kontakt, MAX.kontakt);
  const nachricht = sauber(b.nachricht, MAX.nachricht);
  const datum = datumText(sauber(b.datum, 10));
  const personen = Math.min(Math.max(parseInt(b.personen, 10) || 0, 0), 99);

  if (!name || !kontakt) return json({ ok: false, fehler: 'pflicht' }, 400);
  if (!istMail(kontakt) && !istTelefon(kontakt)) return json({ ok: false, fehler: 'kontakt' }, 400);

  const pass = process.env.SMTP_PASS;
  if (!pass) return json({ ok: false, fehler: 'konfig' }, 503);
  const user = process.env.SMTP_USER || 'kontakt@alea-boutique.com';
  const an = process.env.ANFRAGE_AN || 'kontakt@alea-boutique.com';

  const zeilen = [
    'Neue Private-Shopping-Anfrage über die Website',
    '',
    'Name: ' + name,
    'Kontakt: ' + kontakt,
    'Wunschtag: ' + (datum || 'offen'),
    'Personen: ' + (personen || 'offen'),
    '',
    'Anlass oder Wunsch:',
    nachricht || '–',
    '',
    istMail(kontakt) ? 'Tipp: Einfach auf diese E-Mail antworten, die Antwort geht direkt an ' + name + '.' : 'Bitte telefonisch oder per WhatsApp zurückmelden.',
  ];

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.de',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user, pass },
    });
    await transport.sendMail({
      from: { name: 'aLea Website', address: user },
      to: an,
      replyTo: istMail(kontakt) ? { name, address: kontakt } : undefined,
      subject: 'Private Shopping: ' + name + (datum ? ', ' + datum : ''),
      text: zeilen.join('\n'),
    });
    return json({ ok: true });
  } catch (e) {
    console.error('Anfrage nicht verschickt:', e && e.code, e && e.message);
    return json({ ok: false, fehler: 'versand' }, 502);
  }
}
