<p align="center">
  <img src="https://raw.githubusercontent.com/priemskiyyy/silo/main/docs/public/logo.png" width="88" height="88" alt="Silo" />
</p>

# @priemskiyyy/silo-svelte

Svelte bindings for [Silo](https://priemskiyyy.github.io/silo/).

- **Store primitive:** Reactive `.current` getters through Svelte 5 `createSubscriber`, which owns subscription teardown.
- **Updates:** write through `.current`; `count.current++` reads the latest core snapshot. Function assignments remain values.
- **Snapshot identity:** values retain the core's stored reference; no cloning or deep reactive proxies.
- **Demand:** value acquisition follows the core's hydration rules. Status utilities subscribe only to status, without reading value snapshots.
- **Provider:** `SiloProvider` follows its `silo` and optional `scope` props. Replacement releases old subscriptions; the caller owns Silo disposal.
- **Types:** augment `Register` with `silo: typeof silo` to infer keys, values, scopes, and native storage.
- **Server rendering:** reads the current snapshot (the fallback on cold browser storage), without attaching value subscriptions. Use one Silo per request. Synchronous browser storage may differ from server markup; render storage-dependent UI after mount when necessary.

See the [binding guide](https://priemskiyyy.github.io/silo/svelte) for setup and examples.

## Explicit handles

`useValue(handle)` and `useValueStatus(handle)` accept scoped values directly,
without a provider or `Register`. Pass a getter when the handle depends on a
changing workspace or user ID. Wait for required IDs before mounting the consumer;
an undefined provider scope selects root storage.

See the [binding guide](https://priemskiyyy.github.io/silo/svelte#explicit-value-handles).

## License

[MIT](LICENSE)
