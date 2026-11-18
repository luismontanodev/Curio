// HTTP mínimo e inyectable: en la app es el `fetch` global, en los tests uno falso.

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<HttpResponse>;

// Wikimedia pide identificar al cliente. Cambia el contacto por el tuyo.
export const USER_AGENT = 'Curio/0.1 (app personal; contacto: tu-correo@ejemplo.com)';

/**
 * Cabeceras de identificación. Wikimedia responde 403 al User-Agent por defecto de Android
 * (`okhttp/x`), tanto en la API como en las imágenes, y `Api-User-Agent` solo no basta:
 * hay que mandar `User-Agent`. Úsalas también al cargar imágenes en la UI.
 */
export const CLIENT_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent': USER_AGENT,
  'Api-User-Agent': USER_AGENT,
};

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(url: string, status: number) {
    super(`HTTP ${status} en ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

async function request<T>(
  fetch: FetchLike,
  url: string,
  accept: string,
  read: (res: HttpResponse) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: accept, ...CLIENT_HEADERS }, signal: ctrl.signal });
    if (!res.ok) throw new HttpError(url, res.status);
    return await read(res);
  } finally {
    clearTimeout(timer);
  }
}

export function getJson<T>(fetch: FetchLike, url: string, timeoutMs = 10_000): Promise<T> {
  return request(fetch, url, 'application/json', async (r) => (await r.json()) as T, timeoutMs);
}

/** Para feeds Atom/RSS. */
export function getText(fetch: FetchLike, url: string, timeoutMs = 15_000): Promise<string> {
  return request(fetch, url, 'application/atom+xml, application/xml;q=0.9, */*;q=0.5', (r) => r.text(), timeoutMs);
}

/** Ejecuta tareas con un máximo de `limit` a la vez, sin abrumar la API ni la red del teléfono. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
