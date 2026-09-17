import { useEffect, useState } from "react";
import { SECTIONS } from "src/components/Section/sections";
import type { SectionId } from "src/components/Section/sections";

const isSectionId = (id: string): id is SectionId => id in SECTIONS;

const SECTION_IDS = Object.keys(SECTIONS).filter(isSectionId);

/**
 * The step being read: the first one crossing a thin band a third of the way
 * down the viewport, watched by an IntersectionObserver. The last step is
 * short and never reaches the band, so the end of the page selects it.
 */
export const useCurrentSection = () => {
  const [current, setCurrent] = useState<SectionId>("place");

  useEffect(() => {
    const crossing = new Set<SectionId>();
    const pick = () => {
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 1;
      const next = atBottom
        ? SECTION_IDS.at(-1)
        : SECTION_IDS.find((id) => crossing.has(id));

      if (next !== undefined) {
        setCurrent(next);
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const { id } = entry.target;

          if (!isSectionId(id)) {
            continue;
          }

          if (entry.isIntersecting) {
            crossing.add(id);
          } else {
            crossing.delete(id);
          }
        }

        pick();
      },
      { rootMargin: "-33% 0px -62% 0px" },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);

      if (element !== null) {
        observer.observe(element);
      }
    }

    window.addEventListener("scroll", pick, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pick);
    };
  }, []);

  return current;
};
