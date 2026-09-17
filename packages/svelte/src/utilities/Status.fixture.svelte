<script lang="ts">
  import { useValueStatus } from "./useValueStatus.svelte.js";
  const status = useValueStatus("theme");
</script>

<span>{status.current.state}</span>
