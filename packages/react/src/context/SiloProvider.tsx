import { useMemo } from "react";
import type { PropsWithChildren } from "react";
import { SiloContext } from "src/context/SiloContext";
import type { SiloContextValue } from "src/context/SiloContext";
import type { RegisteredSilo } from "src/types/Register";

export type SiloProviderProps = PropsWithChildren<{
  silo: RegisteredSilo;
  /**
   * The scope every value hook below reads under, such as `users:7`. Changing
   * it re-points them at another keyspace; omitted or `undefined`, they read
   * the root scope. Wait for a required ID before mounting scoped consumers.
   */
  scope?: string | undefined;
}>;

/**
 * Publishes one store, and the scope its hooks read under, to the tree below.
 * The store owns its own lifetime: it hydrates when a value is first reached
 * and is disposed by whoever constructed it, so mounting and unmounting the
 * provider persists nothing and discards nothing.
 *
 * @example
 * ```tsx
 * const silo = new Silo({ storages: { default: { adapters: [localStorage()], schema: Schema } } });
 *
 * <SiloProvider silo={silo} scope={`users:${user.id}`}>
 *   <div>Per-user values go here.</div>
 * </SiloProvider>
 * ```
 */
export const SiloProvider = ({ silo, scope, children }: SiloProviderProps) => {
  // `scope()` builds a fresh handle each call and the store is its own root
  // scope, so the context is memoized on the segment rather than on a handle.
  const context = useMemo(
    (): SiloContextValue => ({
      silo,
      scope: scope === undefined ? silo : silo.scope(scope),
    }),
    [silo, scope],
  );

  return (
    <SiloContext.Provider value={context}>{children}</SiloContext.Provider>
  );
};
