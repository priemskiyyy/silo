import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("..", import.meta.url));
const artifacts = path.join(workspace, ".artifacts");
const release = path.join(artifacts, "release");
const consumer = mkdtempSync(path.join(tmpdir(), "silo-consumer-"));
const rootPackage = JSON.parse(
  readFileSync(path.join(workspace, "package.json"), "utf8"),
);

const run = (command, args, cwd = consumer) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 300_000,
  });

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
      { cause: result.error },
    );
  }

  return result.stdout;
};

const write = (name, content) =>
  writeFileSync(path.join(consumer, name), content);
const json = (name, value) =>
  write(name, `${JSON.stringify(value, null, 2)}\n`);

// Copies a packed tarball with its checksum into the directory the publish
// workflow uploads as the release artifact.
const stageRelease = (name, tarball) => {
  const directory = path.join(release, name);
  const filename = path.basename(tarball);
  const checksum = createHash("sha256")
    .update(readFileSync(tarball))
    .digest("hex");
  mkdirSync(directory, { recursive: true });
  copyFileSync(tarball, path.join(directory, filename));
  writeFileSync(
    path.join(directory, "SHA256SUMS"),
    `${checksum}  ${filename}\n`,
  );
};

const read = (file) =>
  readFileSync(path.join(consumer, "node_modules", file), "utf8");

try {
  rmSync(release, { recursive: true, force: true });
  mkdirSync(artifacts, { recursive: true });
  const tarballs = ["packages", "packages/adapters"].flatMap((group) =>
    readdirSync(path.join(workspace, group))
      .filter((directory) =>
        existsSync(path.join(workspace, group, directory, "package.json")),
      )
      .map((directory) => {
        const packageDirectory = path.join(workspace, group, directory);
        process.stdout.write(
          run("pnpm", ["exec", "publint", packageDirectory], workspace),
        );
        const [packed] = JSON.parse(
          run(
            "npm",
            [
              "pack",
              "--ignore-scripts",
              "--json",
              "--pack-destination",
              artifacts,
            ],
            packageDirectory,
          ),
        );
        assert(packed.files.some((file) => file.path === "README.md"));
        assert(packed.files.some((file) => file.path === "LICENSE"));
        assert(!packed.files.some((file) => file.path.startsWith("src/")));
        assert(
          !packed.files.some((file) =>
            /\.(test|fixture|contracts)\./.test(file.path),
          ),
        );
        const tarball = path.join(artifacts, packed.filename);
        stageRelease(packed.name, tarball);
        return tarball;
      }),
  );

  json("package.json", {
    name: "silo-package-consumer",
    private: true,
    type: "module",
    dependencies: Object.fromEntries(
      ["react", "@types/react", "typescript", "vue", "solid-js", "svelte"].map(
        (name) => [name, rootPackage.devDependencies[name]],
      ),
    ),
  });
  process.stdout.write(
    "Installing packed packages in an isolated consumer...\n",
  );
  run("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...tarballs,
  ]);

  const bundles = [
    { file: "@priemskiyyy/silo/dist/index.js", client: false },
    { file: "@priemskiyyy/silo/dist/mock.js", client: false },
    { file: "@priemskiyyy/silo/dist/testing.js", client: false },
    { file: "@priemskiyyy/silo-memory/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-local-storage/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-session-storage/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-indexeddb/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-cookie/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-chrome-storage/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-mmkv/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-async-storage/dist/index.js", client: false },
    {
      file: "@priemskiyyy/silo-expo-secure-store/dist/index.js",
      client: false,
    },
    {
      file: "@priemskiyyy/silo-capacitor-preferences/dist/index.js",
      client: false,
    },
    { file: "@priemskiyyy/silo-json-file/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-unstorage/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-http/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-search-params/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-sqlite/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-tauri-store/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-electron-store/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-redis/dist/index.js", client: false },
    {
      file: "@priemskiyyy/silo-react-native-keychain/dist/index.js",
      client: false,
    },
    { file: "@priemskiyyy/silo-cloudflare-kv/dist/index.js", client: false },
    {
      file: "@priemskiyyy/silo-cloudflare-durable-objects/dist/index.js",
      client: false,
    },
    { file: "@priemskiyyy/silo-simulcast/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-icloud/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-react/dist/index.js", client: true },
    { file: "@priemskiyyy/silo-devtools/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-devtools/dist/react.js", client: true },
    { file: "@priemskiyyy/silo-vue/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-solid/dist/index.js", client: false },
    { file: "@priemskiyyy/silo-svelte/dist/index.js", client: false },
  ];
  for (const { file, client } of bundles) {
    const bundle = read(file);
    // The workspace compiles against a `src/` alias, so a surviving one is an
    // import no consumer can resolve.
    assert.doesNotMatch(bundle, /from ["']src\//, file);
    assert.equal(/^"use client";/.test(bundle), client, file);
    const declarations = read(file.replace(/\.js$/, ".d.ts"));
    assert.doesNotMatch(declarations, /from ["']src\//, file);
    // Amendment A8: tsdown's top-level `banner` reaches the declarations too,
    // and a directive there is TS1036 for every consumer without skipLibCheck.
    // It is invisible in-repo and only shows up across a package boundary.
    assert.doesNotMatch(declarations, /use client/, file);
  }
  const core = read("@priemskiyyy/silo/dist/index.d.ts");
  assert.match(core, /@example/);
  assert.doesNotMatch(
    core,
    /\b(?:SiloValues|ValueRecord|ValueStore|Keyspace|createBackend|assertUnreachable)\b/,
  );

  json("tsconfig.json", {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM"],
      module: "Preserve",
      moduleResolution: "bundler",
      strict: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      jsx: "react-jsx",
      noEmit: true,
      // The point of this fixture: consumers without skipLibCheck must be able
      // to read the emitted declarations.
      skipLibCheck: false,
      types: [],
    },
    include: ["contracts.ts", "react-contracts.tsx", "bindings-contracts.ts"],
  });
  write(
    "contracts.ts",
    `import { Silo, value, createStorageAdapter } from "@priemskiyyy/silo";
import type {
  AsyncStorageAdapter,
  SyncStorageAdapter,
  SiloValue,
  ValueDefinition,
  InferValue,
  ValueStatus,
  SiloStatus,
  SiloError,
  StandardSchema,
  StorageChange,
  SiloScope,
  SiloSchema,
  InferSchema,
  Codec,
  Expiration,
  ObservableValue,
  StorageAdapter,
  SyncMigration,
  AsyncMigration,
  SyncMigrationStore,
  AsyncMigrationStore,
} from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { testStorageAdapter } from "@priemskiyyy/silo/testing";
import { memory } from "@priemskiyyy/silo-memory";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { sessionStorage } from "@priemskiyyy/silo-session-storage";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";
import type { MemoryStore } from "@priemskiyyy/silo-memory";
import type { IndexedDbHandle } from "@priemskiyyy/silo-indexeddb";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const expectType = <T extends true>(_: T): void => undefined;

type Theme = "light" | "dark";
type User = { name: string };

declare const widened: ValueDefinition<string>;
declare const UserSchema: StandardSchema<User>;

const Schema = {
  theme: value<Theme>({ fallback: "light" }),
  user: value<User>(),
  validated: value({ schema: UserSchema }),
  widened,
};

const storages = { default: { adapters: [memory()], schema: Schema } };
const silo = new Silo({ storages });

// a defaulted key's get() is Theme, with no \`| undefined\`
expectType<Equal<ReturnType<typeof silo.value<"theme">>["get"], () => Theme>>(true);
// an undefaulted key's get() is User | undefined
expectType<Equal<ReturnType<typeof silo.value<"user">>["get"], () => User | undefined>>(true);
// a widened ValueDefinition<string> keeps \`| undefined\`
expectType<Equal<InferValue<ValueDefinition<string>>, string | undefined>>(true);
expectType<Equal<ReturnType<typeof silo.value<"widened">>["get"], () => string | undefined>>(true);
// a schema-validated key reads as the validator's output, with nothing declared
expectType<Equal<ReturnType<typeof silo.value<"validated">>["get"], () => User | undefined>>(true);

// SiloValue.get is synchronous and hydrated()/flush() are Promise<void>, on BOTH modes
const asyncSilo = new Silo({ storages: { default: { adapters: [indexedDb()], schema: schema } } });
expectType<Equal<ReturnType<typeof silo.value<"theme">>["hydrated"], () => Promise<void>>>(true);
expectType<Equal<ReturnType<typeof asyncSilo.value<"theme">>["hydrated"], () => Promise<void>>>(true);
expectType<Equal<ReturnType<typeof silo.value<"theme">>["flush"], () => Promise<void>>>(true);
expectType<Equal<ReturnType<typeof asyncSilo.value<"theme">>["flush"], () => Promise<void>>>(true);
expectType<Equal<ReturnType<typeof asyncSilo.value<"theme">>["get"], () => Theme>>(true);
expectType<Equal<ReturnType<typeof silo.value<"theme">>["set"], (value: Theme) => void>>(true);
expectType<Equal<SiloValue<Theme>["get"], () => Theme>>(true);

// silo.native carries the adapter's exact native type
expectType<Equal<typeof silo.native, { default: MemoryStore }>>(true);
expectType<Equal<typeof asyncSilo.native, { default: IndexedDbHandle }>>(true);
const web = new Silo({ storages: { default: { adapters: [localStorage()], schema: Schema } } });
expectType<Equal<typeof web.native, { default: Storage | null }>>(true);
const session = new Silo({ storages: { default: { adapters: [sessionStorage()], schema: Schema } } });
expectType<Equal<typeof session.native, { default: Storage | null }>>(true);

// status shapes, scope, clear
expectType<Equal<typeof silo.status, ObservableValue<SiloStatus>>>(true);
expectType<Equal<ReturnType<typeof silo.value<"theme">>["status"], ObservableValue<ValueStatus>>>(true);
// Each status narrows the phase to the sides that can fail there; the cause stays unknown.
expectType<Equal<Extract<ValueStatus, { state: "error" }>["error"]["phase"], "hydrate" | "write">>(true);
expectType<Equal<Extract<SiloStatus, { state: "error" }>["error"]["phase"], "migrate">>(true);
expectType<Equal<Extract<SiloStatus, { state: "error" }>["error"]["cause"], unknown>>(true);
expectType<Equal<SiloError["phase"], "migrate" | "hydrate" | "write">>(true);
expectType<Equal<ReturnType<typeof silo.clear>, Promise<void>>>(true);
const scoped: SiloScope<typeof storages> = silo.scope("users:7");
expectType<Equal<ReturnType<typeof scoped.value<"theme">>["get"], () => Theme>>(true);
expectType<Equal<ReturnType<typeof scoped.clear>, Promise<void>>>(true);
expectType<Equal<ReturnType<typeof scoped.release>, Promise<void>>>(true);
expectType<Equal<ReturnType<typeof silo.release>, Promise<void>>>(true);

// a mock is assignable wherever a real adapter is
const syncMock = createMockAdapter();
const asyncMock = createMockAdapter({ mode: "async" });
new Silo({ storages: { default: { adapters: [syncMock.adapter], schema: Schema } } });
new Silo({ storages: { default: { adapters: [asyncMock.adapter], schema: Schema } } });
const asSync: SyncStorageAdapter<unknown> = syncMock.adapter;
const asAsync: AsyncStorageAdapter<unknown> = asyncMock.adapter;
const asEither: StorageAdapter = asSync;
void [asAsync, asEither];

// a SyncStorageAdapter is rejected where an AsyncStorageAdapter is expected
const wantsAsync = (_: AsyncStorageAdapter<unknown>): void => undefined;
// @ts-expect-error a sync adapter is not an async one
wantsAsync(memory());

// schema keys narrow silo.value's parameter
silo.value("theme");
// @ts-expect-error "nope" is not a schema key
silo.value("nope");
// @ts-expect-error "dim" is not a Theme
silo.value("theme").set("dim");

// migrations: the flavour follows the adapter list, each store listing its
// keys in its own mode
const syncMigration: SyncMigration = (store: SyncMigrationStore) => {
  const raw: unknown = store.get("theme");
  const keys: string[] = store.keys();
  store.set("theme", raw);
  store.remove("legacy");
  void keys;
};
const asyncMigration: AsyncMigration = async (store: AsyncMigrationStore) => {
  const raw: unknown = await store.get("theme");
  const keys: string[] = await store.keys();
  await store.set("theme", raw);
  await store.remove("legacy");
  void keys;
};
new Silo({ storages: { default: { adapters: [memory()], schema: Schema } }, migrations: { 2: syncMigration } });
new Silo({ storages: { default: { adapters: [indexedDb({ name: "acme" })], schema: Schema } }, migrations: { 2: asyncMigration } });
new Silo({ storages: { default: { adapters: [indexedDb(), memory()], schema: Schema } }, migrations: { 2: asyncMigration } });
new Silo({ storages: { default: { adapters: [localStorage(), memory()], schema: Schema } }, migrations: { 2: syncMigration } });
// a list of adapters is chosen from at construction and typed as a whole
const chained = new Silo({ storages: { default: { adapters: [localStorage(), memory()], schema: Schema } } });
expectType<Equal<typeof chained.native, { default: Storage | null | MemoryStore }>>(true);
const chainedNative = new Silo({ storages: { default: { adapters: [indexedDb(), localStorage(), memory()], schema: Schema } } });
expectType<Equal<typeof chainedNative.native, { default: IndexedDbHandle | Storage | null | MemoryStore }>>(true);
// several storages: one native per name, keys addressed as storage.key, the migration flavour decided across all of them
const multi = new Silo({
  storages: {
    default: { adapters: [localStorage(), memory()], schema: Schema },
    secure: { adapters: [indexedDb()], schema: { token: value<string>(), theme: value<Theme>({ fallback: "dark" }) } },
  },
  migrations: { 2: async (store) => { await store.move("token", { to: "secure" }); } },
});
expectType<Equal<typeof multi.native, { default: Storage | null | MemoryStore; secure: IndexedDbHandle }>>(true);
expectType<Equal<ReturnType<typeof multi.value<"secure.token">>["get"], () => string | undefined>>(true);
expectType<Equal<ReturnType<typeof multi.value<"theme">>["get"], () => Theme>>(true);
// @ts-expect-error a key is addressed through the storage that declares it
multi.value("token");
// @ts-expect-error a mixed set of storages only takes asynchronous migrations
new Silo({ storages: { default: { adapters: [memory()], schema: Schema }, secure: { adapters: [indexedDb()], schema: Schema } }, migrations: { 2: syncMigration } });
// @ts-expect-error every store declares a default storage
new Silo({ storages: { secure: { adapters: [memory()], schema: Schema } } });
// @ts-expect-error a synchronous list only takes synchronous migrations
new Silo({ storages: { default: { adapters: [memory()], schema: Schema } }, migrations: { 2: asyncMigration } });
// @ts-expect-error a synchronous list only takes synchronous migrations, however long it is
new Silo({ storages: { default: { adapters: [localStorage(), memory()], schema: Schema } }, migrations: { 2: asyncMigration } });
// @ts-expect-error a mixed list is an asynchronous store and only takes asynchronous migrations
new Silo({ storages: { default: { adapters: [indexedDb(), memory()], schema: Schema } }, migrations: { 2: syncMigration } });
// keys is the second optional adapter member, in the adapter's own mode
expectType<Equal<NonNullable<SyncStorageAdapter["keyspace"]>["namespace"], "visible" | "hidden">>(true);
expectType<Equal<ReturnType<NonNullable<SyncStorageAdapter["keys"]>>, string[]>>(true);
expectType<Equal<ReturnType<NonNullable<AsyncStorageAdapter["keys"]>>, Promise<string[]>>>(true);

// codecs, schema inference, adapter authoring, the testing barrel
const codec: Codec<Theme> = {
  encode: (value) => value,
  decode: (raw) => (raw === "dark" ? "dark" : "light"),
};
void value<Theme>({ fallback: "light", codec, expires: { in: 1000 } });
void value<Theme>({ codec, expires: { at: 5000 } });
expectType<Equal<ValueDefinition<string>["expires"], Expiration | undefined>>(true);
// @ts-expect-error expiry cannot specify both a lifetime and a deadline
void value({ expires: { in: 1000, at: 5000 } });
// @ts-expect-error codec and schema are exclusive
void value({ codec, schema: UserSchema });
expectType<Equal<InferSchema<{ default: { adapters: []; schema: { theme: typeof Schema.theme } } }>, { theme: Theme }>>(true);
const CheckSchema: SiloSchema = Schema;
void CheckSchema;
void createStorageAdapter;
void testStorageAdapter;
const change: StorageChange = { key: null };
void change;

// The structurally typed web adapters must still be rejected where async is expected.
// @ts-expect-error a sync adapter is not an async one
wantsAsync(localStorage());
// @ts-expect-error a sync adapter is not an async one
wantsAsync(sessionStorage());
// ...and accepted where sync is expected.
const wantsSync = (_: SyncStorageAdapter<Storage | null>): void => undefined;
wantsSync(localStorage());
wantsSync(sessionStorage());
`,
  );
  write(
    "react-contracts.tsx",
    `import { Silo, value } from "@priemskiyyy/silo";
import type { Dispatch, SetStateAction } from "react";
import type { SiloScope, SiloStatus, ValueStatus } from "@priemskiyyy/silo";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import {
  SiloProvider,
  useValue,
  useValueStatus,
  useSilo,
  useScope,
  useSiloStatus,
  useNativeStorage,
} from "@priemskiyyy/silo-react";
import type { SiloProviderProps, RegisteredKey, RegisteredScope } from "@priemskiyyy/silo-react";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expectType = <T extends true>(_: T): void => undefined;

type Theme = "light" | "dark";
type User = { name: string };

const Schema = {
  theme: value<Theme>({ fallback: "light" }),
  user: value<User>(),
  count: value({ fallback: 0 }),
  callback: value<() => string>(),
};

const storages = { default: { adapters: [localStorage()], schema: Schema } };
const silo = new Silo({ storages });

declare module "@priemskiyyy/silo-react" {
  interface Register {
    silo: typeof silo;
  }
}

// keys are narrowed to the registered schema
expectType<Equal<RegisteredKey, "theme" | "user" | "count" | "callback">>(true);

const Probe = () => {
  // a defaulted key reads with no \`| undefined\`
  const [theme, setTheme] = useValue("theme");
  expectType<Equal<typeof theme, Theme>>(true);
  expectType<Equal<typeof setTheme, Dispatch<SetStateAction<Theme>>>>(true);
  setTheme((previous) => {
    expectType<Equal<typeof previous, Theme>>(true);
    return previous === "light" ? "dark" : "light";
  });
  const [, setCount] = useValue("count");
  setCount((previous) => {
    expectType<Equal<typeof previous, number>>(true);
    return previous + 1;
  });
  const [, setCallback] = useValue("callback");
  setCallback(() => () => "saved");

  // an undefaulted key keeps \`| undefined\`
  const [user, setUser] = useValue("user");
  setUser((previous) => {
    expectType<Equal<typeof previous, User | undefined>>(true);
    return previous === undefined ? { name: "new" } : undefined;
  });
  expectType<Equal<typeof user, User | undefined>>(true);

  // useNativeStorage carries the adapter's exact native type
  const native = useNativeStorage();
  expectType<Equal<typeof native, { default: Storage | null }>>(true);

  // the value status and the store status are two hooks with two shapes
  const status = useValueStatus("theme");
  expectType<Equal<typeof status, ValueStatus>>(true);
  const store = useSiloStatus();
  expectType<Equal<typeof store, SiloStatus>>(true);

  // the store and the provider's scope carry the registered schema
  const client = useSilo();
  expectType<Equal<typeof client, typeof silo>>(true);
  const scope = useScope();
  expectType<Equal<typeof scope, SiloScope<typeof storages>>>(true);
  expectType<Equal<RegisteredScope, SiloScope<typeof storages>>>(true);

  // @ts-expect-error "nope" is not a registered key
  useValue("nope");
  // @ts-expect-error "dim" is not a Theme
  setTheme("dim");
  // @ts-expect-error updater results must match the registered value
  setCount((previous) => String(previous));
  // @ts-expect-error required values cannot be removed with an updater
  setCount(() => undefined);

  return <span>{status.state}{store.state}{theme}{String(user)}{String(native)}</span>;
};

const props: SiloProviderProps = { silo, scope: "users:7", children: <Probe /> };
export const App = () => <SiloProvider {...props} />;
`,
  );
  write(
    "bindings-contracts.ts",
    `import { Silo, value } from "@priemskiyyy/silo";
import type { SiloScope, SiloStatus, ValueStatus } from "@priemskiyyy/silo";
import { memory } from "@priemskiyyy/silo-memory";
import * as Vue from "@priemskiyyy/silo-vue";
import * as Solid from "@priemskiyyy/silo-solid";
import * as Svelte from "@priemskiyyy/silo-svelte";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const expectType = <T extends true>(_: T): void => undefined;
type Theme = "light" | "dark";
type User = { name: string };
const storages = { default: { adapters: [memory()], schema: { theme: value<Theme>({ fallback: "light" }), user: value<User>(), count: value({ fallback: 0 }), callback: value<() => string>() } } };
const silo = new Silo({ storages });

declare module "@priemskiyyy/silo-vue" { interface Register { silo: typeof silo; } }
export const checkVue = () => {
  expectType<Equal<Vue.RegisteredKey, "theme" | "user" | "count" | "callback">>(true);
  const theme = Vue.useValue("theme");
  const count = Vue.useValue("count");
  count.value++;
  Vue.useValue("callback").value = () => "saved";
  const user = Vue.useValue("user");
  const snapshot = theme.value;
  const optional = user.value;
  const native = Vue.useNativeStorage().value;
  const scope = Vue.useScope().value;
  const status = Vue.useValueStatus("theme").value;
  const progress = Vue.useSiloStatus().value;
  const current = Vue.useSilo().value;
  expectType<Equal<typeof snapshot, Theme>>(true);
  expectType<Equal<typeof optional, User | undefined>>(true);
  expectType<Equal<typeof native, typeof silo.native>>(true);
  expectType<Equal<typeof scope, SiloScope<typeof storages>>>(true);
  expectType<Equal<typeof status, ValueStatus>>(true);
  expectType<Equal<typeof progress, SiloStatus>>(true);
  expectType<Equal<typeof current, typeof silo>>(true);
  const props: Vue.SiloProviderProps = { silo, scope: "account" };
  // @ts-expect-error keys must exist in the registered schema
  Vue.useValue("missing");
  // @ts-expect-error setters retain the declared value type
  theme.value = "invalid";
  return props;
};

declare module "@priemskiyyy/silo-solid" { interface Register { silo: typeof silo; } }
export const checkSolid = () => {
  expectType<Equal<Solid.RegisteredKey, "theme" | "user" | "count" | "callback">>(true);
  const [theme, setTheme] = Solid.useValue("theme");
  const [user, setUser] = Solid.useValue("user");
  const [, setCount] = Solid.useValue("count");
  const updated = setCount((previous) => {
    expectType<Equal<typeof previous, number>>(true);
    return previous + 1;
  });
  expectType<Equal<typeof updated, number>>(true);
  setTheme((previous) => {
    expectType<Equal<typeof previous, Theme>>(true);
    return previous === "light" ? "dark" : "light";
  });
  setUser((previous) => {
    expectType<Equal<typeof previous, User | undefined>>(true);
    return previous === undefined ? { name: "new" } : undefined;
  });
  const [, setCallback] = Solid.useValue("callback");
  setCallback(() => () => "saved");
  // @ts-expect-error function values must be wrapped in an updater
  setCallback(() => "unwrapped");
  // @ts-expect-error updater results must match the registered value
  setCount((previous) => String(previous));
  // @ts-expect-error required values cannot be removed with an updater
  setCount(() => undefined);
  const snapshot = theme();
  const optional = user();
  const native = Solid.useNativeStorage()();
  const scope = Solid.useScope()();
  const status = Solid.useValueStatus("theme")();
  const progress = Solid.useSiloStatus()();
  const current = Solid.useSilo()();
  expectType<Equal<typeof snapshot, Theme>>(true);
  expectType<Equal<typeof optional, User | undefined>>(true);
  expectType<Equal<typeof native, typeof silo.native>>(true);
  expectType<Equal<typeof scope, SiloScope<typeof storages>>>(true);
  expectType<Equal<typeof status, ValueStatus>>(true);
  expectType<Equal<typeof progress, SiloStatus>>(true);
  expectType<Equal<typeof current, typeof silo>>(true);
  const props: Solid.SiloProviderProps = { silo, scope: "account" };
  // @ts-expect-error keys must exist in the registered schema
  Solid.useValue("missing");
  // @ts-expect-error setters retain the declared value type
  setTheme("invalid");
  return props;
};

declare module "@priemskiyyy/silo-svelte" { interface Register { silo: typeof silo; } }
export const checkSvelte = () => {
  expectType<Equal<Svelte.RegisteredKey, "theme" | "user" | "count" | "callback">>(true);
  const theme = Svelte.useValue("theme");
  const count = Svelte.useValue("count");
  count.current++;
  Svelte.useValue("callback").current = () => "saved";
  const user = Svelte.useValue("user");
  const snapshot = theme.current;
  const optional = user.current;
  const native = Svelte.useNativeStorage().current;
  const scope = Svelte.useScope().current;
  const status = Svelte.useValueStatus("theme").current;
  const progress = Svelte.useSiloStatus().current;
  const current = Svelte.useSilo().current;
  expectType<Equal<typeof snapshot, Theme>>(true);
  expectType<Equal<typeof optional, User | undefined>>(true);
  expectType<Equal<typeof native, typeof silo.native>>(true);
  expectType<Equal<typeof scope, SiloScope<typeof storages>>>(true);
  expectType<Equal<typeof status, ValueStatus>>(true);
  expectType<Equal<typeof progress, SiloStatus>>(true);
  expectType<Equal<typeof current, typeof silo>>(true);
  const props: Svelte.SiloProviderProps = { silo, scope: "account" };
  // @ts-expect-error keys must exist in the registered schema
  Svelte.useValue("missing");
  // @ts-expect-error setters retain the declared value type
  theme.current = "invalid";
  return props;
};
`,
  );
  write(
    "ssr.mjs",
    `import assert from "node:assert/strict";
import { Silo, value, createStorageAdapter } from "@priemskiyyy/silo";
import { createMockAdapter } from "@priemskiyyy/silo/mock";
import { memory } from "@priemskiyyy/silo-memory";
import { localStorage } from "@priemskiyyy/silo-local-storage";
import { sessionStorage } from "@priemskiyyy/silo-session-storage";
import { indexedDb } from "@priemskiyyy/silo-indexeddb";

assert.equal(typeof globalThis.window, "undefined", "must run with no DOM");

const Schema = { theme: value({ fallback: "light" }), user: value() };
const SecureSchema = { token: value() };

// Browser adapters construct cold; unavailable candidates fall through to memory.
for (const make of [memory, localStorage, sessionStorage, indexedDb]) {
  const adapter = make();
  const silo = new Silo({ storages: { default: { adapters: [adapter, memory()], schema: Schema }, secure: { adapters: [memory()], schema: SecureSchema } } });
  assert.equal(silo.value("theme").get(), "light", \`\${adapter.name}: fallback on the server\`);
  assert.equal(silo.value("user").get(), undefined, \`\${adapter.name}: undefaulted reads undefined\`);
  silo.dispose();
}

// A real round trip through memory, including a scope, a second storage and the physical key.
const adapter = memory();
const secure = memory();
const silo = new Silo({ storages: { default: { adapters: [adapter], schema: Schema }, secure: { adapters: [secure], schema: SecureSchema } } });
silo.value("theme").set("dark");
silo.value("secure.token").set("t");
assert.equal(secure.native.get("silo:token"), "t", "a key lives in the storage that declares it");
assert.equal(silo.value("theme").get(), "dark");
assert.equal(adapter.native.get("silo:theme"), "dark", "physical key is silo:theme");
const account = silo.scope("users:7");
account.value("theme").set("solar");
assert.equal(adapter.native.get("silo:users:7:theme"), "solar", "scoped physical key");
assert.equal(silo.value("theme").get(), "dark", "root scope untouched");
await silo.flush();
await account.clear();
assert.equal(adapter.native.get("silo:users:7:theme"), undefined, "clear removed the scoped key");
silo.dispose();

// The mock is assignable where a real adapter is, and the barrels load off the browser.
const mock = createMockAdapter({ mode: "sync" });
const mocked = new Silo({ storages: { default: { adapters: [mock.adapter], schema: Schema } } });
assert.equal(mocked.value("theme").get(), "light");
mocked.dispose();
assert.equal(typeof createStorageAdapter, "function");
// Every shipped adapter can enumerate, which is what a scoped migration needs.
for (const make of [memory, localStorage, sessionStorage]) {
  const cold = make();
  assert.deepEqual(cold.keys(), [], \`\${cold.name}: keys is empty on the server\`);
  cold.dispose();
}
`,
  );

  run(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]);
  run(process.execPath, ["ssr.mjs"]);
  process.stdout.write(
    `Packed consumer passed for ${tarballs.length} packages: publint, tarball contents, bundle hygiene, emitted declarations at skipLibCheck false, and a cold server-side run.\n`,
  );
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
