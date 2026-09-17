<script lang="ts">
  import type { Silo } from "@priemskiyyy/silo";
  import SiloProvider from "../context/SiloProvider.svelte";
  import Counter from "./Counter.fixture.svelte";
  const { silo, external }: { silo: Silo; external: () => void } = $props();
</script>

<SiloProvider {silo}>
  <Counter {external} />
</SiloProvider>
