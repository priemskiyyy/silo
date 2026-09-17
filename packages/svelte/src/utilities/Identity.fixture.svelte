<script lang="ts">
  import { useValue } from "./useValue.svelte.js";
  const props: { expected: unknown } = $props();
  const snapshot = useValue("theme");
</script>

<span>{String(snapshot.current === props.expected)}</span>
