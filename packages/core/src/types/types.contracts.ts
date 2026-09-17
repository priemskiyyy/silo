import type { AsyncMigrationStore } from "src/types/AsyncMigrationStore";
import type { SyncMigrationStore } from "src/types/SyncMigrationStore";
import type { SiloScope } from "src/types/SiloScope";
import type { SiloStatus } from "src/types/SiloStatus";
import type { ValueStatus } from "src/types/ValueStatus";
import type { SiloValues } from "src/utils/internal/values/SiloValues";
import type { AsyncMigration } from "src/types/AsyncMigration";
import type { SyncMigration } from "src/types/SyncMigration";
import type { AsyncStorageAdapter } from "src/types/AsyncStorageAdapter";
import { Silo } from "src/utils/Silo";
import type { MockNative } from "src/mock/createMockAdapter";
import { createMockAdapter } from "src/mock/createMockAdapter";
import type { Codec } from "src/types/Codec";
import type { DefinitionOf } from "src/types/DefinitionOf";
import type { Expiration } from "src/types/Expiration";
import type { InferSchema } from "src/types/InferSchema";
import type { KeyOf } from "src/types/KeyOf";
import type { InferValue } from "src/types/InferValue";
import type { SiloSchema } from "src/types/SiloSchema";
import type { SyncStorageAdapter } from "src/types/SyncStorageAdapter";
import type { Storages } from "src/types/Storages";
import type { ValueDefinition } from "src/types/ValueDefinition";
import type { StandardSchema } from "src/types/StandardSchema";
import { value } from "src/utils/value";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// A broken assertion fails to satisfy the constraint, so it is a compile error
// rather than a type nobody reads.
type Expect<TAssertion extends true> = TAssertion;

type Theme = "light" | "dark";
type User = { name: string };

const dateCodec = {
  encode: (date: Date) => date.toISOString(),
  decode: (raw: unknown) => new Date(String(raw)),
} satisfies Codec<Date>;

declare const userSchema: StandardSchema<User>;

// A definition translates with a codec or validates with a schema, never
// both: the exclusivity is the type's, so there is nothing to check at runtime.
// @ts-expect-error codec and schema are exclusive
value({ codec: dateCodec, schema: userSchema });

export const relativeExpiry = value<string>({ expires: { in: 1_000 } });
export const absoluteExpiry = value({
  fallback: "guest",
  expires: { at: 5_000 },
});
export type RelativeExpiryValue = Expect<
  Equal<InferValue<typeof relativeExpiry>, string | undefined>
>;
export type AbsoluteExpiryValue = Expect<
  Equal<InferValue<typeof absoluteExpiry>, string>
>;
export type DefinitionExpiration = Expect<
  Equal<ValueDefinition<string>["expires"], Expiration | undefined>
>;

// @ts-expect-error expiry must choose a lifetime or a deadline
value({ expires: { in: 1_000, at: 5_000 } });
// @ts-expect-error an empty expiry has neither a lifetime nor a deadline
value({ expires: {} });
// @ts-expect-error deadlines are Unix timestamps in milliseconds
value({ expires: { at: new Date() } });
// @ts-expect-error the flat expiry option was replaced
value({ expiresIn: 1_000 });

export const schema = {
  theme: value<Theme>({ fallback: "light" }),
  user: value<User>(),
  visits: value({ fallback: 0 }),
  seenAt: value({ codec: dateCodec }),
  openedAt: value({ codec: dateCodec, fallback: new Date(0) }),
  validated: value({ schema: userSchema }),
} satisfies SiloSchema;

// A declared fallback carries into the value type; explicit widening keeps the
// declared union instead of collapsing to the fallback's literal.
export type T1 = Expect<Equal<InferValue<typeof schema.theme>, Theme>>;
export type T2 = Expect<
  Equal<InferValue<typeof schema.user>, User | undefined>
>;
// A definition widened to the default parameter is not known to be defined.
export type T3 = Expect<
  Equal<InferValue<ValueDefinition<string>>, string | undefined>
>;
// A declared fallback that is itself `undefined` reads exactly as undeclared.
export type T3b = Expect<
  Equal<
    InferValue<ValueDefinition<string | undefined, string | undefined>>,
    string | undefined
  >
>;
// Zero type arguments at both call sites: from the fallback, and from the codec.
export type T4 = Expect<Equal<InferValue<typeof schema.visits>, number>>;
export type T5 = Expect<
  Equal<InferValue<typeof schema.seenAt>, Date | undefined>
>;
export type T6 = Expect<Equal<InferValue<typeof schema.openedAt>, Date>>;
// The value type comes from the validator's output, with nothing declared.
export type T6b = Expect<
  Equal<InferValue<typeof schema.validated>, User | undefined>
>;
export type T7 = Expect<
  Equal<
    InferSchema<{ default: { adapters: []; schema: typeof schema } }>,
    {
      theme: Theme;
      user: User | undefined;
      visits: number;
      seenAt: Date | undefined;
      openedAt: Date;
      validated: User | undefined;
    }
  >
>;
// What the method-syntax carve-out buys: a supertype to constrain a schema
// against. Arrow properties make ValueDefinition invariant and T8 fails.
export type T8 = Expect<
  Equal<
    ValueDefinition<Theme> extends ValueDefinition<unknown> ? true : false,
    true
  >
>;
// Storages are typed as a whole: one native per storage name, `default`
// required, the migration flavour decided across every candidate of every
// storage, and every key addressed bare in default or as `storage.key`.
declare const asyncMigration: AsyncMigration;
declare const syncMigration: SyncMigration;
export const storages = {
  default: {
    adapters: [createMockAdapter().adapter, createMockAdapter().adapter],
    schema,
  },
  secure: {
    adapters: [createMockAdapter({ mode: "async" }).adapter],
    schema: {
      token: value<string>(),
      theme: value<Theme>({ fallback: "dark" }),
    },
  },
};
export const store = new Silo({ storages, migrations: { 1: asyncMigration } });
export type T11 = Expect<
  Equal<typeof store.native, { default: MockNative; secure: MockNative }>
>;
export type T12 = Expect<
  Equal<
    KeyOf<typeof storages>,
    | "theme"
    | "user"
    | "visits"
    | "seenAt"
    | "openedAt"
    | "validated"
    | "secure.token"
    | "secure.theme"
  >
>;
// A bare key is the default storage's even when another storage repeats it.
export type T13 = Expect<
  Equal<InferValue<DefinitionOf<typeof storages, "theme">>, Theme>
>;
export type T14 = Expect<
  Equal<
    InferValue<DefinitionOf<typeof storages, "secure.token">>,
    string | undefined
  >
>;
export type T15 = Expect<
  Equal<InferSchema<typeof storages>["secure.theme"], Theme>
>;
new Silo({
  storages,
  // @ts-expect-error a mixed set of storages only takes asynchronous migrations
  migrations: { 1: syncMigration },
});
new Silo({
  storages: { default: { adapters: [createMockAdapter().adapter], schema } },
  // @ts-expect-error a synchronous store only takes synchronous migrations
  migrations: { 1: asyncMigration },
});
new Silo({
  // @ts-expect-error every store declares a default storage
  storages: { secure: { adapters: [createMockAdapter().adapter], schema } },
});

export type T9 = Expect<
  Equal<
    SyncStorageAdapter<Storage> extends AsyncStorageAdapter<Storage>
      ? true
      : false,
    false
  >
>;
export type T10 = Expect<
  Equal<
    AsyncStorageAdapter<Storage> extends SyncStorageAdapter<Storage>
      ? true
      : false,
    false
  >
>;

export type DerivedScope = Expect<
  Equal<
    SiloScope<typeof storages>,
    Pick<typeof store, "value" | "scope" | "clear" | "release">
  >
>;
export type AsyncMoveArguments = Expect<
  Equal<
    Parameters<AsyncMigrationStore["move"]>,
    Parameters<SyncMigrationStore["move"]>
  >
>;
export type AsyncKeysResult = Expect<
  Equal<
    ReturnType<AsyncMigrationStore["keys"]>,
    Promise<ReturnType<SyncMigrationStore["keys"]>>
  >
>;
export type StoreFailurePhase = Expect<
  Equal<Extract<SiloStatus, { state: "error" }>["error"]["phase"], "migrate">
>;
export type ValueFailurePhase = Expect<
  Equal<
    Extract<ValueStatus, { state: "error" }>["error"]["phase"],
    "hydrate" | "write"
  >
>;

declare const records: SiloValues<typeof storages>;
export const themeRecord = records.acquire("theme", []);
export type RegistryValue = Expect<
  Equal<ReturnType<typeof themeRecord.get>, Theme>
>;
// @ts-expect-error registry lookups are limited to declared schema paths
records.acquire("missing", []);
// @ts-expect-error the lookup parameter is a key, not an arbitrary return type
records.acquire<number>("theme", []);
// @ts-expect-error scopes preserve their parent schema's value types
store.scope("account").value("visits").set("wrong type");

// A storage may carry its own namespace, and it is optional.
const namespacedMock = createMockAdapter();
export const namespaced = {
  default: { adapters: [namespacedMock.adapter], schema: {} },
  url: { adapters: [namespacedMock.adapter], schema: {}, namespace: "" },
} satisfies Storages;
