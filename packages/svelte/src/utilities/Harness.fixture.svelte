<script lang="ts">
  import type { Silo } from "@priemskiyyy/silo";
  import SiloProvider from "../context/SiloProvider.svelte";
  import Value from "./Value.fixture.svelte";
  const props: {
    silo: Silo;
    scope?: string | undefined;
    name?: string | undefined;
    onChange?: ((value: unknown) => void) | undefined;
  } = $props();
</script>

<SiloProvider silo={props.silo} scope={props.scope}>
  <Value name={props.name} onChange={props.onChange} />
  <Value name={props.name} />
</SiloProvider>
