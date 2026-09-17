import type React from "react";
import { useEffect } from "react";
import { SECTIONS } from "src/components/Section/sections";
import { useCurrentSection } from "src/hooks/useCurrentSection";
import { navLinkStyles } from "src/styles/navLinkStyles";

const FIELD_SELECTOR = "input, textarea, select, [contenteditable='true']";

/** The four steps as anchors in the sticky header, the one being read marked; keys 1 to 4 jump to them. */
export const SectionNav: React.FunctionComponent = () => {
  const current = useCurrentSection();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // The real target, also inside the devtools' shadow root, where a
      // filter box would otherwise scroll the page while being typed in.
      const [target] = event.composedPath();

      if (target instanceof Element && target.closest(FIELD_SELECTOR)) {
        return;
      }

      const section = Object.entries(SECTIONS).find(
        ([, { number }]) => String(number) === event.key,
      );

      if (section === undefined) {
        return;
      }

      document
        .getElementById(section[0])
        ?.scrollIntoView({ behavior: "smooth" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <nav aria-label="Steps" className="hidden items-center gap-1 lg:flex">
      {Object.entries(SECTIONS).map(([id, { number, title }]) => (
        <a
          key={id}
          href={`#${id}`}
          title={`Press ${number}`}
          aria-current={current === id ? "true" : undefined}
          className={navLinkStyles({ current: current === id })}
        >
          <span
            aria-hidden="true"
            className="flex size-5 items-center justify-center rounded-full bg-amber-500 font-mono text-[11px] font-semibold text-white tabular-nums dark:bg-amber-400 dark:text-zinc-950"
          >
            {number}
          </span>
          {title}
        </a>
      ))}
    </nav>
  );
};
