import { computed, defineComponent, provide } from "vue";
import { SILO_CONTEXT } from "src/context/SiloContext";
import type { RegisteredSilo } from "src/types/Register";

/** Provider inputs. @example `const props = { silo, scope: "account" } satisfies SiloProviderProps;` */
export type SiloProviderProps = {
  silo: RegisteredSilo;
  scope?: string | undefined;
};

/**
 * Provides an application-owned Silo and a reactive scope to descendant composables.
 * @example `<SiloProvider :silo="silo" :scope="account"><Settings /></SiloProvider>`
 */
export const SiloProvider = defineComponent(
  (props: SiloProviderProps, { slots }) => {
    provide(
      SILO_CONTEXT,
      computed(() => ({
        silo: props.silo,
        scope:
          props.scope === undefined
            ? props.silo
            : props.silo.scope(props.scope),
      })),
    );
    return () => slots.default?.();
  },
  { name: "SiloProvider", props: ["silo", "scope"] },
);
