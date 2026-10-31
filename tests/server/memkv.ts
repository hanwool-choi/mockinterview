export function memKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    async get(k: string, t?: unknown) {
      const v = m.get(k);
      if (v == null) return null;
      return t === 'json' || (t as { type?: string })?.type === 'json' ? JSON.parse(v) : v;
    },
    async put(k: string, v: string) { m.set(k, v); },
    async delete(k: string) { m.delete(k); },
  } as unknown as KVNamespace;
}
