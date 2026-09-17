import type React from "react";

export const Hero: React.FunctionComponent = () => (
  <section aria-label="Overview" className="flex flex-col gap-2">
    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
      One store,{" "}
      <span className="text-amber-600 dark:text-amber-400">eight places</span>{" "}
      to keep things.
    </h2>
    <p className="text-base text-zinc-600 dark:text-zinc-400">
      Declared once, read with one hook, kept in memory, localStorage,
      sessionStorage, IndexedDB, a cookie, the URL, a URL synced across tabs, or
      a server.
    </p>
  </section>
);
