import { ArrowDown, NotePencil } from "@phosphor-icons/react";
import { buttonStyles } from "src/styles/buttonStyles";

export const Hero = () => (
  <section
    aria-label="Overview"
    className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-7 dark:border-amber-900/60 dark:bg-amber-950/20"
  >
    <div className="flex flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl">
        Your field notebook
      </h2>
      <p className="max-w-2xl text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
        Keep a separate notebook for each trip. Add an entry, then reload to
        check it was saved.
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={buttonStyles({ variant: "primary" })}
        onClick={() => document.getElementById("new-entry")?.focus()}
      >
        <NotePencil size={16} /> Add a note
      </button>

      <button
        type="button"
        className={buttonStyles({ variant: "ghost" })}
        onClick={() =>
          document
            .getElementById("place")
            ?.scrollIntoView({ behavior: "smooth" })
        }
      >
        <ArrowDown size={16} /> Explore storage
      </button>
    </div>
  </section>
);
