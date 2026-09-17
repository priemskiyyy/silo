import type React from "react";
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import { match } from "ts-pattern";
import { Badge } from "src/components/Badge/Badge";
import type { SaveState } from "src/hooks/useDurableValue";
import { buttonStyles } from "src/styles/buttonStyles";

type SaveBadgeProps = {
  save: SaveState<unknown>;
  /** Offered beside a refusal: writes the same value again. */
  onRetry?: () => void;
};

/** The write pipeline as one badge: writing while `flush()` is pending, durable once it resolved, refused when it rejected. */
export const SaveBadge: React.FunctionComponent<SaveBadgeProps> = ({
  save,
  onRetry,
}) =>
  match(save)
    .with({ state: "IDLE" }, () => null)
    .with({ state: "PENDING" }, () => (
      <Badge tone="warning" icon={CircleNotch}>
        Writing
      </Badge>
    ))
    .with({ state: "DURABLE" }, () => (
      <Badge tone="positive" icon={CheckCircle}>
        Durable
      </Badge>
    ))
    .with({ state: "REFUSED" }, () => (
      <>
        <Badge tone="danger" icon={WarningCircle}>
          Write refused
        </Badge>
        {onRetry === undefined ? null : (
          <button
            type="button"
            onClick={onRetry}
            className={buttonStyles({ size: "small" })}
          >
            <ArrowClockwise size={12} weight="bold" />
            Retry
          </button>
        )}
      </>
    ))
    .exhaustive();
