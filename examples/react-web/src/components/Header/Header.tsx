import type React from "react";
import { StoreStatusBadge } from "src/components/Header/StoreStatusBadge";
import { SectionNav } from "src/components/Section/SectionNav";

export const Header: React.FunctionComponent = () => (
  <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
    <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
      <div className="mr-auto flex items-center gap-2">
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          width={32}
          height={32}
          alt="Silo"
        />
        <h1 className="text-base font-semibold">Fieldbook</h1>
        <StoreStatusBadge />
      </div>
      <SectionNav />
    </div>
  </header>
);
