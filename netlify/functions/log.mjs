import { getStore } from '@netlify/blobs';

export default async (req) => {
  const store = getStore('accesslog');
  const H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  try {
    if (req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const list = (await store.get('entries', { type: 'json' })) || [];
      list.push({
        user: String(b.user || '?').slice(0, 60),
        role: String(b.role || '').slice(0, 20),
        ts: new Date().toISOString()
      });
      await store.setJSON('entries', list.slice(-3000));
      return new Response(JSON.stringify({ ok: true }), { headers: H });
    }
    if (req.method === 'GET') {
      const key = req.headers.get('x-admin-key') || '';
      if (key !== (process.env.ADMIN_LOG_KEY || '__unset__'))
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: H });
      const list = (await store.get('entries', { type: 'json' })) || [];
      return new Response(JSON.stringify(list), { headers: H });
    }
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: H });
  }
};
