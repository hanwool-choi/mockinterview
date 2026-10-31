export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export class HttpFail extends Error {
  constructor(public status: number, public body: unknown) {
    super(String(status));
  }
}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T> {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new HttpFail(413, { error: 'too_large' });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpFail(400, { error: 'bad_json' });
  }
}

export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpFail) return json(e.status, e.body);
    console.error('api error', e instanceof Error ? e.message : 'unknown');
    return json(500, { error: 'internal' });
  }
}
