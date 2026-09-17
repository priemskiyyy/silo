<script lang="ts">
  import { useValue } from "./useValue.svelte.js";
  import { useValueStatus } from "./useValueStatus.svelte.js";
  import { useSiloStatus } from "./useSiloStatus.js";
  import { useNativeStorage } from "./useNativeStorage.js";
  import { useSilo } from "./useSilo.js";
  const props: {
    name?: string | undefined;
    onChange?: ((value: unknown) => void) | undefined;
  } = $props();
  const snapshot = useValue(
    () => props.name ?? "theme",
    (next) => props.onChange?.(next),
  );
  const status = useValueStatus(() => props.name ?? "theme");
  const siloStatus = useSiloStatus();
  const native = useNativeStorage();
  const silo = useSilo();
</script>

<button
  onclick={() => {
    snapshot.current = "updated";
  }}
  >{String(snapshot.current)}/{status.current.state}/{siloStatus.current
    .state}</button
>
<span>{String(native.current === silo.current.native)}</span>
