import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { authorized, json } from './_lib.js';

export async function POST(request) {
  if (!authorized(request)) return json({ fehler: 'Bitte neu anmelden.' }, 401);
  const typ = request.headers.get('content-type') || '';
  if (!/^image\/(webp|jpeg)$/.test(typ)) return json({ fehler: 'Nur Fotos erlaubt.' }, 400);
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length || buf.length > 4 * 1024 * 1024) return json({ fehler: 'Das Foto ist zu groß.' }, 400);
  const groesse = (request.headers.get('x-groesse') || 'gross').replace(/[^a-z]/g, '');
  const id = (request.headers.get('x-id') || randomUUID()).replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const ext = typ === 'image/webp' ? 'webp' : 'jpg';
  const blob = await put(`fotos/${id}-${groesse}.${ext}`, buf, { access: 'public', addRandomSuffix: false, contentType: typ, cacheControlMaxAge: 31536000, allowOverwrite: true });
  return json({ url: blob.url });
}
