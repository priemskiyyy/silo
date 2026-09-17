import { createElement, useEffect, useState } from "react";
import { SiloDevtools as Devtools } from "@priemskiyyy/silo-devtools";
import type { SiloDevtoolsOptions } from "@priemskiyyy/silo-devtools";
import { useSilo } from "@priemskiyyy/silo-react";

export type SiloDevtoolsProps = Omit<SiloDevtoolsOptions, "silo">;

/**
 * Mounts the inspector for the nearest `SiloProvider`. Renders an empty host
 * element on the server and follows the provider's store after mount.
 *
 * @example
 * ```tsx
 * <SiloProvider silo={silo}>
 *   <App />
 *   {import.meta.env.DEV ? <SiloDevtools /> : null}
 * </SiloProvider>
 * ```
 */
export const SiloDevtools = ({
  initialIsOpen = false,
  maxEvents = 200,
}: SiloDevtoolsProps) => {
  const silo = useSilo();
  const [devtools] = useState(
    () => new Devtools({ silo, initialIsOpen, maxEvents }),
  );

  useEffect(() => {
    devtools.setSilo(silo);
  }, [devtools, silo]);

  useEffect(() => {
    devtools.setMaxEvents(maxEvents);
  }, [devtools, maxEvents]);

  const handleHostRef = (element: HTMLDivElement | null) => {
    if (element === null) {
      return;
    }

    devtools.mount(element);
    return devtools.unmount;
  };

  return createElement("div", {
    ref: handleHostRef,
    "data-silo-devtools": "",
  });
};
