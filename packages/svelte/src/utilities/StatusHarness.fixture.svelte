<script lang="ts">
  import type { Silo } from "@priemskiyyy/silo";
  import SiloProvider from "../context/SiloProvider.svelte";
  import Status from "./Status.fixture.svelte";
  const props: { silo: Silo } = $props();
</script>

<SiloProvider silo={props.silo}><Status /></SiloProvider>
