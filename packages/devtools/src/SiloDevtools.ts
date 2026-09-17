import { createComponent, createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import { render } from "solid-js/web";
import type { Silo } from "@priemskiyyy/silo";
import { Devtools } from "src/components/Devtools";
import { EventLog } from "src/utils/EventLog";

export type SiloDevtoolsOptions = {
  silo: Silo;
  /** Opens the panel on the first visit. Later visits restore the last open state. */
  initialIsOpen?: boolean;
  /** Events kept in memory. Defaults to 200, clamped to 1 to 1000. */
  maxEvents?: number;
};

/**
 * Framework-independent inspector for one store. Mount it into any element:
 * the panel renders in a shadow root, so host styles never leak in or out.
 * Recording runs while mounted, also when collapsed, and reads only
 * `silo.diagnostics`, so it never hydrates a value. The React wrapper under
 * `@priemskiyyy/silo-devtools/react` reads the store from its provider.
 *
 * @example
 * ```ts
 * const devtools = new SiloDevtools({ silo });
 * devtools.mount(document.body.appendChild(document.createElement("div")));
 * ```
 */
export class SiloDevtools {
  #silo: Accessor<Silo>;
  #setSilo: Setter<Silo>;
  #maxEvents: Accessor<number>;
  #setMaxEvents: Setter<number>;
  #initialIsOpen: boolean;
  #log: EventLog;
  #dispose: (() => void) | null = null;

  constructor({
    silo,
    initialIsOpen = false,
    maxEvents = 200,
  }: SiloDevtoolsOptions) {
    const [currentSilo, setSilo] = createSignal(silo);
    const [currentMaxEvents, setMaxEvents] = createSignal(maxEvents);
    this.#silo = currentSilo;
    this.#setSilo = setSilo;
    this.#maxEvents = currentMaxEvents;
    this.#setMaxEvents = setMaxEvents;
    this.#initialIsOpen = initialIsOpen;
    this.#log = new EventLog(maxEvents);
  }

  /** Renders into `element` through a shadow root and starts recording. Throws when already mounted. */
  mount = (element: HTMLElement) => {
    if (this.#dispose !== null) {
      throw new Error(
        "Silo devtools are already mounted. Call unmount() first.",
      );
    }

    const root = element.shadowRoot ?? element.attachShadow({ mode: "open" });
    this.#dispose = render(
      () =>
        createComponent(Devtools, {
          silo: this.#silo,
          maxEvents: this.#maxEvents,
          initialIsOpen: this.#initialIsOpen,
          log: this.#log,
        }),
      root,
    );
  };

  /** Removes the panel and stops recording. Recorded events survive until the next mount. */
  unmount = () => {
    if (this.#dispose === null) {
      return;
    }

    this.#dispose();
    this.#dispose = null;
  };

  /** Points the inspector at another store, for example after its adapters changed. */
  setSilo = (silo: Silo) => {
    this.#setSilo(() => silo);
  };

  setMaxEvents = (maxEvents: number) => {
    this.#setMaxEvents(maxEvents);
  };
}
