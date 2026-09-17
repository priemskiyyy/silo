import type { SiloSnapshot } from "@priemskiyyy/silo";
import { SiloIcon } from "src/components/SiloIcon";
import { useAutoFocus } from "src/hooks/useAutoFocus";

type LauncherProps = {
  status: SiloSnapshot["status"];
  hasUnseenError: boolean;
  autoFocus: boolean;
  onOpen: () => void;
};

export const Launcher = (props: LauncherProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);

  return (
    <button
      ref={focusOnMount}
      type="button"
      class="launcher"
      aria-label="Open Silo devtools"
      onClick={() => props.onOpen()}
    >
      <SiloIcon />
      <span>Silo</span>
      <span
        class="dot"
        data-state={props.hasUnseenError ? "error" : props.status.state}
      />
    </button>
  );
};
