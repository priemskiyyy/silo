import { useEffect } from "react";
import type { Density, Theme } from "src/silo/createFieldbookSilo";

/**
 * Puts the persisted theme and density on `<html>`, where the stylesheet
 * reads them. The inline script in `index.html` did the same before the
 * first paint from the raw in localStorage; this keeps it current.
 */
export const useDocumentTheme = (theme: Theme, density: Density) => {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;

    if (theme !== "system") {
      root.dataset.theme = theme;
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = () => {
      root.dataset.theme = media.matches ? "dark" : "light";
    };

    handleSchemeChange();
    media.addEventListener("change", handleSchemeChange);
    return () => media.removeEventListener("change", handleSchemeChange);
  }, [theme, density]);
};
