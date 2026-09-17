<!--
@component Provides an application-owned Silo and a reactive scope.
@example `<SiloProvider {silo} scope={account}><Settings /></SiloProvider>`
-->
<script lang="ts">
  import { setContext } from "svelte";
  import { SILO_CONTEXT } from "./SiloContext.js";
  import type { SiloContextValue } from "./SiloContext.js";
  import type { SiloProviderProps } from "../types/SiloProviderProps.js";

  const props: SiloProviderProps = $props();
  const scope = $derived(
    props.scope === undefined ? props.silo : props.silo.scope(props.scope),
  );
  setContext(SILO_CONTEXT, {
    silo: {
      get current() {
        return props.silo;
      },
    },
    scope: {
      get current() {
        return scope;
      },
    },
  } satisfies SiloContextValue);
</script>

{#if props.children}
  {@render props.children()}
{/if}
