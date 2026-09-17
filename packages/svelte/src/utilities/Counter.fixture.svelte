<script lang="ts">
  import { useValue } from "./useValue.svelte.js";
  const { external }: { external: () => void } = $props();
  const count = useValue("count");
</script>

<button
  onclick={() => {
    count.current = Number(count.current) + 1;
    count.current = Number(count.current) + 1;
    external();
    count.current = Number(count.current) + 1;
  }}>{String(count.current)}</button
>
