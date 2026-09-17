<script lang="ts">
  import type { Silo } from "@priemskiyyy/silo";
  import SiloProvider from "../context/SiloProvider.svelte";
  import Identity from "./Identity.fixture.svelte";
  const props: { silo: Silo; expected: unknown } = $props();
</script>

<SiloProvider silo={props.silo}
  ><Identity expected={props.expected} /></SiloProvider
>
