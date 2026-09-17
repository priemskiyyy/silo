import type React from "react";
import type { Icon } from "@phosphor-icons/react";
import { match } from "ts-pattern";
import { iconTileStyles } from "src/styles/iconTileStyles";

type IconTileProps = {
  icon: Icon;
  size?: "regular" | "small";
};

export const IconTile: React.FunctionComponent<IconTileProps> = ({
  icon: TileIcon,
  size = "regular",
}) => (
  <span aria-hidden="true" className={iconTileStyles({ size })}>
    <TileIcon
      size={match(size)
        .with("regular", () => 18)
        .with("small", () => 15)
        .exhaustive()}
      weight="duotone"
    />
  </span>
);
