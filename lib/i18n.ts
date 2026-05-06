import de from '@/messages/de.json';

type Messages = Record<string, string>;

const flat: Messages = flatten(de);

function flatten(obj: unknown, prefix = ''): Messages {
  const out: Messages = {};
  if (typeof obj !== 'object' || obj === null) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'object' && v !== null) Object.assign(out, flatten(v, key));
  }
  return out;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = flat[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
