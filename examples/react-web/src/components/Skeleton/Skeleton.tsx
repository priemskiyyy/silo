import type React from "react";
import { skeletonStyles } from "src/styles/skeletonStyles";

type SkeletonProps = {
  variant: "line" | "field";
};

export const Skeleton: React.FunctionComponent<SkeletonProps> = ({
  variant,
}) => <span aria-hidden="true" className={skeletonStyles({ variant })} />;
