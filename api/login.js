import { checkPassword, makeToken, json } from './_lib.js';

export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  await new Promise((r) => setTimeout(r, 400));
  if (!process.env.PFLEGE_PASSWORT) return json({ fehler: 'Das Passwort ist in Vercel noch nicht hinterlegt.' }, 500);
  if (!checkPassword(body.passwort)) return json({ fehler: 'Das Passwort stimmt nicht.' }, 401);
  return json({ token: makeToken() });
}
