<script lang="ts">
  import type { SiloValue } from "@priemskiyyy/silo";
  import { useValue } from "./useValue.svelte.js";
  import { useValueStatus } from "./useValueStatus.svelte.js";
  const props: {
    root: SiloValue<number>;
    handle: SiloValue<number>;
    onChange: (value: number) => void;
  } = $props();
  const root = useValue(() => props.root);
  const count = useValue(
    () => props.handle,
    (value) => props.onChange(value),
  );
  const status = useValueStatus(() => props.handle);
</script>

<button
  onclick={() => {
    count.current += 1;
    root.current += 1;
  }}
>
  {root.current}/{count.current}/{status.current.state}
</button>
