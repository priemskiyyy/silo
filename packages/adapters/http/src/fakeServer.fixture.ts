type Recorded = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | undefined;
};

const target = (input: RequestInfo | URL) => {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
};

const json = (body: string | null, status: number) =>
  new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * A key-value server for the tests: JSON text per key in a Map behind a
 * `fetch` that speaks the adapter's contract, every request recorded, and a
 * status the next response can be forced to.
 */
export const fakeServer = () => {
  const base = "https://kv.example.test/api";
  const store = new Map<string, string>();
  const requests: Recorded[] = [];
  let forced: number | null = null;

  const fetch: typeof globalThis.fetch = async (input, init = {}) => {
    const url = target(input);
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? init.body : undefined;
    requests.push({
      method,
      url,
      headers: Object.fromEntries(new Headers(init.headers)),
      body,
    });

    if (forced !== null) {
      const status = forced;
      forced = null;
      return new Response(null, { status });
    }

    if (url === base) {
      return method === "GET"
        ? json(JSON.stringify([...store.keys()]), 200)
        : new Response(null, { status: 405 });
    }

    if (!url.startsWith(`${base}/`)) {
      return new Response(null, { status: 400 });
    }

    const key = decodeURIComponent(url.slice(base.length + 1));

    if (method === "GET") {
      const stored = store.get(key);
      return stored === undefined
        ? new Response(null, { status: 404 })
        : json(stored, 200);
    }

    if (method === "PUT") {
      store.set(key, body ?? "");
      return new Response(null, { status: 204 });
    }

    if (method === "DELETE") {
      return new Response(null, { status: store.delete(key) ? 204 : 404 });
    }

    return new Response(null, { status: 405 });
  };

  return {
    base,
    store,
    requests,
    fetch,
    /** The next response, whatever the request, answers this status with no body. */
    failNext: (status: number) => {
      forced = status;
    },
  };
};
