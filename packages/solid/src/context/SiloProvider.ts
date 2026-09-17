import { createComponent, createMemo } from "solid-js";
import type { ParentProps } from "solid-js";
import { SiloContext } from "src/context/SiloContext";
import type { RegisteredSilo } from "src/types/Register";

/** Provider inputs. @example `const props = { silo, scope: "account" } satisfies SiloProviderProps;` */
export type SiloProviderProps = ParentProps<{
  silo: RegisteredSilo;
  scope?: string | undefined;
}>;

/**
 * Provides an application-owned Silo and follows reactive scope changes.
 * @example `<SiloProvider silo={silo} scope={account()}><Settings /></SiloProvider>`
 */
export const SiloProvider = (props: SiloProviderProps) => {
  const silo = createMemo(() => props.silo);
  const scope = createMemo(() =>
    props.scope === undefined ? silo() : silo().scope(props.scope),
  );
  return createComponent(SiloContext.Provider, {
    value: { silo, scope },
    get children() {
      return props.children;
    },
  });
};
