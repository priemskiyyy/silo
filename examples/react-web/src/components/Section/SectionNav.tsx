import { SECTIONS } from "src/components/Section/sections";
import { useCurrentSection } from "src/hooks/useCurrentSection";
import { navLinkStyles } from "src/styles/navLinkStyles";

export const SectionNav = () => {
  const current = useCurrentSection();

  return (
    <nav
      aria-label="Explore Fieldbook"
      className="flex gap-1 overflow-x-auto py-1"
    >
      {Object.entries(SECTIONS).map(([id, { label }]) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? "location" : undefined}
          onClick={() => {
            // The URL fragment belongs to the synced storage playground.
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
          }}
          className={`${navLinkStyles({ current: current === id })} shrink-0`}
        >
          {label}
        </button>
      ))}
    </nav>
  );
};
