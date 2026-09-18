<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-simulcast

Add live change notifications to a [Silo](../../core) adapter through a Simulcast channel. The wrapped adapter remains responsible for storing values.

Silo owns what is stored and how it is read; simulcast owns the realtime subscription, over whichever provider the application already runs on: Ably, Pusher, Centrifugo, Supabase, Phoenix, MQTT, PartyKit, Socket.IO, a plain WebSocket, server-sent events, or a `BroadcastChannel` between tabs.

## Installation

```sh
pnpm add @priemskiyyy/silo @priemskiyyy/silo-simulcast @priemskiyyy/simulcast
```

Then one simulcast provider adapter, for example `@priemskiyyy/simulcast-ably`, and one silo storage adapter to hold the data, for example `@priemskiyyy/silo-http`.

## Create a silo

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { http } from "@priemskiyyy/silo-http";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { memory } from "@priemskiyyy/silo-memory";
import { simulcast } from "@priemskiyyy/silo-simulcast";
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { ably } from "@priemskiyyy/simulcast-ably";

type Settings = { locale: string; digest: boolean };

const realtime = new RealtimeClient({ adapter: ably({ client: ablyClient }) });
realtime.connect();

const silo = new Silo({
  storages: {
    default: {
      adapters: [localStorage(), memory()],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
    remote: {
      adapters: [
        simulcast({
          adapter: http({ url: "https://api.example.com/kv" }),
          channel: realtime.channel("silo"),
        }),
        memory(),
      ],
      schema: { settings: value<Settings>() },
    },
  },
});

const settings = silo.value("remote.settings");

settings.subscribe(() => render(settings.get())); // re-renders when any device writes
settings.set({ ...settings.get(), locale: "de", digest: true }); // durable through http, visible everywhere
```

The bridge keeps the wrapped adapter's mode: over `http` it is asynchronous, over `localStorage` it is synchronous, and `silo.native.remote` is still the wrapped adapter's own handle.

## How it works

1. A write goes to the wrapped adapter and is durable once that adapter says so. The bridge adds nothing to the write path.
2. Someone announces the change on the channel as `{ key, value }`. The natural announcer is the server that stored the value: it knows the write happened and publishes once for every client. For a setup without a server in the loop, such as `localStorage` plus a `BroadcastChannel` provider, pass `publish` and the bridge announces this device's own writes after each write completes.
3. Every other device's silo is subscribed to the channel through the bridge's `observe`. A publication arrives as an outside change: the value's snapshot updates, its subscribers are notified, and nothing is re-read.
4. The device that wrote hears its own announcement too. The core drops it while a local write is pending. A later echo is processed as an external change and can notify again for a new object reference.

The wrapped adapter's own `observe`, when it has one, keeps working alongside the channel: `localStorage` inside the bridge still reports the other tabs on this browser.

## Message shape

A publication's `data` is one of:

```ts
{ key: "silo:theme", value: "dark" }   // a write, with the physical key and the decoded value
{ key: "silo:theme" }                   // a removal; JSON has no undefined, so value is absent
{ key: null }                           // everything changed, re-read every key
```

The key is the physical key silo composed (`namespace:scope:key`), exactly as the storage adapter received it. Anything else on the channel is ignored, so the channel can carry other traffic.

## Options

| Option      | Default               | Meaning                                                                                               |
| ----------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `adapter`   | required              | The adapter that holds the data. Its mode, `native` and `keys` are the bridge's.                      |
| `channel`   | required              | Anything with `subscribe(onPublication)` returning a stop; `realtime.channel(name)` fits as it is.    |
| `publish`   | none                  | Announces this device's own writes after each write completes, for a setup where the server does not. |
| `available` | the wrapped adapter's | Replaces the probe.                                                                                   |

## Behavior

- The bridge depends on nothing at runtime. The channel is typed structurally as `{ subscribe }`, which `realtime.channel(name)` satisfies as it is.
- `publish` runs after a write has completed and never before; a write that failed announces nothing. A `publish` that throws or rejects is dropped, because the data is durable and the write must not report otherwise.
- The bridge does not reload records on reconnect. Use transport replay where available, or release affected scopes and acquire fresh handles after their consumers stop. A `{ key: null }` report also reloads existing records that have no pending local write.
- `dispose` releases every observer the bridge registered, then disposes the wrapped adapter. The channel and the `RealtimeClient` belong to the application.
- `available()` is the wrapped adapter's unless `available` is given a probe of the application's own, so a candidate list can be gated at construction.
- The wrapped adapter's `keyspace` declaration travels with it, so wrapping `searchParams()` keeps the store's namespace out of the URL.
- Values published on the channel must be decoded values, the same shape the wrapped adapter's `get` returns, because the core applies them without a decode.

## License

[MIT](LICENSE)
