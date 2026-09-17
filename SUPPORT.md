# Getting help

Start with the [installation guide](docs/installation.md), the [example](examples/react-web/README.md) and the [troubleshooting guide](docs/troubleshooting.md). Each adapter has its own README under [packages/adapters](packages/adapters), and the [devtools](docs/devtools.md) show what a store holds and what happened to it.

For a bug report, include:

- The smallest example that reproduces the issue.
- Silo, adapter, framework and runtime versions, plus the browser if the backend is a web one.
- The `storages` involved: each storage's candidate list, and the value definition, including its codec or schema and whether it declares a `fallback` or `expires`.
- Expected and actual values, and the `status` the value or the store reported, with its `phase`.
- Whether the issue happens on the first hydration, after an external change in another tab or device, across a migration, or during release or disposal.
- The devtools timeline for the record, if the application mounts them.

Use [GitHub issues](https://github.com/priemskiyyy/silo/issues) for reproducible bugs and feature requests. Remove credentials, access tokens and personal data from persisted values, examples and logs.

See [CONTRIBUTING.md](CONTRIBUTING.md) to run the test suites or propose a change.
