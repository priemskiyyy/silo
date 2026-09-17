---
description: "How a Silo store learns about changes it did not make: the observe contract, StorageChange, which adapters report what, echoes, and the simulcast bridge."
---

# External observation

Another tab writes to `localStorage`. Another silo on the same IndexedDB
database commits. A server announces a write from another device. Something
outside this store changed a value it holds. `observe` is how an adapter
reports that, and it is an optional member of the adapter contract.

```ts
import type { StorageChange } from "@priemskiyyy/silo";

export type Observe = (listener: (change: StorageChange) => void) => () => void;
```

The core guards it once, with `typeof adapter.observe === "function"`, when
the store is constructed, and stops observing when the store is disposed.
There is no capability system: an adapter that cannot report a change omits
the member, and that is the supported answer.

## What a change looks like

```ts
export type StorageChange = { key: string; value: unknown } | { key: null };
```

`key` is the physical key, exactly as the core composed it, and `value` is
already decoded by the adapter, which owns serialization. The codec has not
run yet; the core decodes it on arrival like any other inbound raw value. An
absent value is reported as `undefined`.

`{ key: null }` means everything changed and the core must re-read. It is the
honest report for a backend that can say a change happened but not which
keys were in it: `localStorage.clear()` in another tab, or the browser's
back button on a `searchParams()` storage.

## What each adapter reports

| Adapter                           | Mechanism                                                                                       | Hears                                                                               | Reports `{ key: null }` |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------- |
| `localStorage()`                  | `storage` event, filtered by `storageArea`                                                      | every other tab on the origin                                                       | on `clear()`            |
| `sessionStorage()`                | `storage` event, filtered by `storageArea`                                                      | contexts sharing the session, such as an iframe                                     | on `clear()`            |
| `indexedDb()`                     | `BroadcastChannel` announcements                                                                | other silo adapters on the same database and store                                  | never                   |
| `searchParams()`                  | `popstate`, or `hashchange` with `hash: true`; a `BroadcastChannel` with `sharing: "cross-tab"` | the browser's own navigation, and the other tabs on the path with cross-tab sharing | on navigation           |
| `chromeStorage()`                 | `area.onChanged`                                                                                | every context of the extension                                                      | never                   |
| `mmkv()`                          | `addOnValueChangedListener`                                                                     | every writer of the instance, this store included                                   | never                   |
| `electronStore()`                 | `onDidAnyChange`, one report per key whose JSON changed                                         | every writer of the store                                                           | never                   |
| `tauriStore()`                    | `onChange`                                                                                      | every writer of the store                                                           | never                   |
| `icloud()`                        | the remote change event, then a read of each changed key                                        | the same account's other devices                                                    | never                   |
| `simulcast({ adapter, channel })` | publications on the channel, plus the wrapped adapter's own                                     | every device subscribed to the channel                                              | as published            |

Everything else has no `observe`: `memory`, `cookie`, `asyncStorage`,
`secureStore`, `keychain`, `capacitorPreferences`, `http`, `redis`, `sqlite`,
`jsonFile`, `unstorage`, both Cloudflare adapters. A change made behind one
of those is not automatically reflected in an existing record. A fresh record
hydrates when acquired after scope release or in a new store. `get()`, `set()`
and `remove()` do not reload an existing record.

Read the third column as a limit, not a feature. `sessionStorage()` observes
and almost never fires, because a session storage area is private to its tab
and the `storage` event never fires in the tab that wrote. `indexedDb()`
hears only what another silo adapter announced after committing: IndexedDB
has no change event, so a write from devtools, from another library, or a
`deleteDatabase`, is invisible. `{ sharing: "single-tab" }` removes `observe` from
that adapter entirely.

## Echoes

An echo is a report of a write this store made itself. The two web storage
observers never produce one: the `storage` event does not fire in the
context that wrote, and a `BroadcastChannel` does not deliver to the channel
object that posted, so the IndexedDB adapter, which posts and listens on one
memoized channel, cannot hear itself.

Other platforms do echo. MMKV reports every write, including this store's,
and a simulcast channel delivers this device's own announcement back to it.
The core copes without help from the adapter:

- An echo that arrives **while the write is still in flight** is dropped,
  like any external change arriving under an open write.
- An echo that arrives **after the write landed** carries the value the
  snapshot already holds. A primitive is deduplicated with `Object.is` and
  notifies nobody. An object is a new reference after decoding, so it does
  notify once, with the same content.

An adapter over a platform that echoes therefore forwards everything. See
[writing an adapter](writing-an-adapter.md).

## A local write always wins

An external change commits only while the value has nothing in flight and
nothing pending. Otherwise it is dropped, not merged and not queued:

```ts
import { Silo, value } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";

const mock = createMockAdapter({ mode: "async", hold: true });
const silo = new Silo({
  storages: {
    default: {
      adapters: [mock.adapter],
      schema: { theme: value<"light" | "dark">({ fallback: "light" }) },
    },
  },
});
const theme = silo.value("theme");

theme.set("dark");
// Arrives while the write is still open, so it is dropped.
mock.emit({ key: "silo:theme", value: "light" });

export const still = theme.get(); // "dark"
```

The reasoning is that the caller asked for something after the other tab
did, and a value that snapped back under an open write would be a lost
update the user can see. The cost is that a change dropped this way is not
replayed: the next external change, or the next hydration, is what brings
this store back in line.

Four more rules follow from the same place:

- **An external change abandons an in-flight read.** The pushed value is
  newer than whatever the adapter is still answering with, so the read's
  reservation is dropped and its result is discarded when it lands.
- **A committed external change is already durable.** It advances the
  revision and the durable watermark together, so a `flush()` issued after
  it has nothing to wait for.
- **It settles hydration.** A value whose first read has not landed yet, but
  which an external change reached, resolves its `hydrated()` on that
  change.
- **Nothing is applied behind the migration gate.** While `silo.status` is
  `migrating`, reports are ignored; the reads that run when the gate opens
  see the final state anyway.

## Only live records are reached

A change for a key the store has never reached is ignored, because there is
no record to update and nothing is subscribed to it. `{ key: null }` re-reads
every record that exists, not every key in the schema, and skips a record
with a write in flight. Reaching a value later hydrates it from the adapter
as usual, so nothing is lost.

## A change that will not decode

An external payload that throws in `decode` leaves the last good snapshot
alone. It is a worse answer than the one already on screen, and unlike a
hydration failure there is a known-good value to keep. Nothing is reported
on `status` for it, and nothing is deleted: the raw value stays where the
other writer put it.

A hydration failure takes the other path, reporting
`{ state: "error", error: { phase: "hydrate" } }` and falling back. See
[errors and recovery](errors-and-recovery.md).

## Expiry and external changes

An external raw value is interpreted exactly like one read at hydration: a
key that declares `expires` is unwrapped from its envelope, and an already
expired value reads as absent, takes the fallback, and has its deletion
scheduled through the ordinary write path. See
[expiring values](ttl.md).

## Across devices: the simulcast bridge

For backends without cross-device notifications, the bridge adds an event
channel through the application's realtime provider:

```ts
import { RealtimeClient } from "@priemskiyyy/simulcast";
import { ably } from "@priemskiyyy/simulcast-ably";
import { http } from "@priemskiyyy/silo-http";
import { simulcast } from "@priemskiyyy/silo-simulcast";

const realtime = new RealtimeClient({ adapter: ably({ client: ablyClient }) });
realtime.connect();

const remote = simulcast({
  adapter: http({ url: "https://api.example.com/kv" }),
  channel: realtime.channel("silo"),
});
```

The wrapped adapter holds the data and decides the mode. The channel
delivers `{ key, value }` publications as outside changes: the snapshot
updates, subscribers are notified, and nothing is re-read. The natural
announcer is the server that stored the value. For a setup without one, such
as `localStorage` plus a `BroadcastChannel` provider, pass `publish` and the
bridge announces this device's own writes after each one lands. The
[Fieldbook example](examples.md) runs the bridge over `http` against a
server that lives in the page, announcing on a `BroadcastChannel`, so a
second tab receives a remote write without polling.

## In the devtools

For existing records after migration admission, processed reports emit events
while an event listener is attached: `outside applied` with the outcome, or
`outside dropped` with the reason, either an open local write or the decode
error. [Devtools](devtools.md) lists them per record, which is the quickest
way to see why another tab's write did not land.

## Testing it

`createMockAdapter` emits whatever a test asks for, including the changes a
conforming adapter never sends: a self-echo, a duplicate, a stale value, or
one arriving after disposal. `emit` never touches the store, so the reported
change and the stored value are controlled separately. See
[testing](testing.md).
