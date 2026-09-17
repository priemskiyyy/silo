import { P, match } from "ts-pattern";
import type { FakeServer, ServerState } from "src/silo/server/FakeServer";
import type { ServerLatency } from "src/silo/server/ServerLatency";
import type { ServerRequest } from "src/silo/server/ServerRequest";
import { sleep } from "src/utils/sleep";

type FakeServerOptions = {
  /** The BroadcastChannel name the page's realtime client listens on. */
  channel: string;
  latency?: ServerLatency;
};

const ORIGIN = "https://fieldbook.local";
const BASE_PATH = "/kv";
/** The rows live in localStorage under this prefix, so a second tab reads the same "database". */
const ROW_PREFIX = "server:";
const LOG_LENGTH = 12;
const JSON_HEADERS = { "content-type": "application/json" };

const listRows = () => {
  const rows: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key === null) {
      continue;
    }

    if (!key.startsWith(ROW_PREFIX)) {
      continue;
    }

    rows.push(key.slice(ROW_PREFIX.length));
  }

  return rows;
};

const answer = (
  method: string,
  key: string,
  body: BodyInit | null | undefined,
) =>
  match({ method, key })
    .with(
      { method: "GET", key: "" },
      () => new Response(JSON.stringify(listRows()), { headers: JSON_HEADERS }),
    )
    .with({ method: "GET", key: P.string }, ({ key: row }) => {
      const text = window.localStorage.getItem(`${ROW_PREFIX}${row}`);

      if (text === null) {
        return new Response(null, { status: 404 });
      }

      return new Response(text, { headers: JSON_HEADERS });
    })
    .with({ method: "PUT", key: P.string.minLength(1) }, ({ key: row }) => {
      if (typeof body !== "string") {
        return new Response(null, { status: 400 });
      }

      window.localStorage.setItem(`${ROW_PREFIX}${row}`, body);
      return new Response(null, { status: 204 });
    })
    .with({ method: "DELETE", key: P.string.minLength(1) }, ({ key: row }) => {
      window.localStorage.removeItem(`${ROW_PREFIX}${row}`);
      return new Response(null, { status: 204 });
    })
    .otherwise(() => new Response(null, { status: 405 }));

/**
 * A REST key-value server the http adapter can be pointed at without leaving
 * the page: one resource per key, JSON bodies, a latency the Lab picks, and a
 * request log newest first. Rows live in localStorage, so every tab talks to
 * the same server, and each write is announced on a BroadcastChannel the
 * simulcast adapter in the other tabs listens to.
 */
export const createFakeServer = ({
  channel,
  latency = 400,
}: FakeServerOptions): FakeServer => {
  const publisher = new BroadcastChannel(channel);
  const listeners = new Set<() => void>();
  let state: ServerState = { latency, armed: false, requests: [] };
  let nextId = 1;

  const update = (next: ServerState) => {
    state = next;

    for (const listener of listeners) {
      listener();
    }
  };

  const respond = (
    method: string,
    pathname: string,
    body: BodyInit | null | undefined,
  ) => {
    if (state.armed) {
      update({ ...state, armed: false });
      return new Response(null, { status: 503 });
    }

    if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
      return new Response(null, { status: 404 });
    }

    return answer(
      method,
      decodeURIComponent(pathname.slice(BASE_PATH.length + 1)),
      body,
    );
  };

  const fetch: typeof globalThis.fetch = async (input, init) => {
    const method = init?.method ?? "GET";
    const url = new URL(input instanceof Request ? input.url : String(input));
    const started = performance.now();

    // As slow as the Lab says; 0 still answers on a later tick, as a network would.
    await sleep(state.latency);

    const response = respond(method, url.pathname, init?.body);
    const request: ServerRequest = {
      id: nextId,
      method,
      path: decodeURIComponent(url.pathname),
      status: response.status,
      duration: Math.round(performance.now() - started),
    };
    nextId += 1;
    update({
      ...state,
      requests: [request, ...state.requests].slice(0, LOG_LENGTH),
    });

    return response;
  };

  return {
    url: `${ORIGIN}${BASE_PATH}`,
    channel,
    fetch,
    announce: (change) => {
      publisher.postMessage(change);
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    setLatency: (next) => {
      update({ ...state, latency: next });
    },
    failNextRequest: () => {
      update({ ...state, armed: true });
    },
    clearLog: () => {
      update({ ...state, requests: [] });
    },
  };
};
