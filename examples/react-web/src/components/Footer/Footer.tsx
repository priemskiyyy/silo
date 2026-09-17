import type React from "react";

const PACKAGES = [
  "silo",
  "silo-react",
  "silo-memory",
  "silo-local-storage",
  "silo-session-storage",
  "silo-indexeddb",
  "silo-cookie",
  "silo-search-params",
  "silo-http",
  "silo-simulcast",
  "silo-devtools",
  "simulcast",
  "simulcast-broadcast-channel",
];

export const Footer: React.FunctionComponent = () => (
  <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 border-t border-zinc-200/70 px-4 py-6 text-xs text-zinc-500 sm:px-6 dark:border-zinc-800 dark:text-zinc-400">
    <p>Built on</p>
    <ul aria-label="Packages" className="flex flex-wrap gap-1.5">
      {PACKAGES.map((name) => (
        <li
          key={name}
          className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
        >
          @priemskiyyy/{name}
        </li>
      ))}
    </ul>
  </footer>
);
