import { lesen, json } from './_lib.js';

export async function GET() {
  try {
    return json(await lesen(), 200, { 'cache-control': 'public, s-maxage=20, stale-while-revalidate=60' });
  } catch (e) {
    return json({ neu: [], events: [], eventFotos: {}, fehler: true }, 200, { 'cache-control': 'no-store' });
  }
}
