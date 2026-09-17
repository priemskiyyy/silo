import type React from "react";
import { SiloDevtools } from "@priemskiyyy/silo-devtools/react";
import { SiloProvider, useValue } from "@priemskiyyy/silo-react";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { ComposerPanel } from "src/components/Composer/ComposerPanel";
import { DevtoolsCard } from "src/components/Devtools/DevtoolsCard";
import { EntriesPanel } from "src/components/Entries/EntriesPanel";
import { Footer } from "src/components/Footer/Footer";
import { Header } from "src/components/Header/Header";
import { Hero } from "src/components/Hero/Hero";
import { LabBar } from "src/components/Lab/LabBar";
import { NotebookToolbar } from "src/components/Notebook/NotebookToolbar";
import { PlaygroundPanel } from "src/components/Playground/PlaygroundPanel";
import { PreferencesPanel } from "src/components/Preferences/PreferencesPanel";
import { Section } from "src/components/Section/Section";
import { ServerCard } from "src/components/Server/ServerCard";
import { SuppliesPanel } from "src/components/Supplies/SuppliesPanel";
import { useDocumentTheme } from "src/hooks/useDocumentTheme";
import { createFieldbookSilo } from "src/silo/createFieldbookSilo";
import {
  applicationReducer,
  initialApplicationState,
} from "src/state/applicationReducer";
import { describeStorages } from "src/utils/describeStorages";
import "src/styles.css";

/** Puts the persisted look on the document; lives under the provider so the hooks can read it. */
const DocumentTheme: React.FunctionComponent = () => {
  const [theme] = useValue("theme");
  const [density] = useValue("density");
  useDocumentTheme(theme, density);

  return null;
};

export const Application: React.FunctionComponent = () => {
  const [state, dispatch] = useReducer(
    applicationReducer,
    initialApplicationState,
  );
  const { store, notebookId, playgroundStorage } = state;
  // The flags change candidate lists, so a change builds a new store; the
  // generation lets the Lab ask for a new one over the same flags.
  const fieldbook = useMemo(() => createFieldbookSilo(store.flags), [store]);
  const places = useMemo(
    () => describeStorages(fieldbook.storages),
    [fieldbook],
  );
  const placesOf = (...names: string[]) =>
    names.flatMap((name) => {
      const place = places[name];
      return place === undefined ? [] : [place];
    });
  const current = useRef(fieldbook);
  const counted = useRef(false);

  // The previous store is disposed once its replacement exists, never the
  // one on screen: a development double-invoke finds the same store twice.
  useEffect(() => {
    const previous = current.current;
    current.current = fieldbook;

    if (previous !== fieldbook) {
      previous.silo.dispose();
    }
  }, [fieldbook]);

  // Once per page load, guarded by a ref so a development double-invoke does
  // not count twice.
  useEffect(() => {
    if (counted.current) {
      return;
    }

    counted.current = true;
    const visits = fieldbook.silo.value("visits");
    visits.set(visits.get() + 1);
  }, [fieldbook]);

  const handleFailNextWritePress = () => {
    fieldbook.faults.arm();
  };
  const handleCorruptThemePress = () => {
    window.localStorage.setItem("fieldbook:theme", "not json");
    dispatch({ type: "STORE_RECREATED" });
  };
  const handlePlantLegacyDataPress = () => {
    window.localStorage.setItem(
      "fieldbook:legacyTheme",
      JSON.stringify("dark"),
    );
    window.localStorage.setItem("fieldbook::version", "1");
    dispatch({ type: "STORE_RECREATED" });
  };

  return (
    <SiloProvider silo={fieldbook.silo}>
      <DocumentTheme />
      <Header />
      <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
        <Hero />
        <Section
          id="place"
          hint="pick a place, type, then reload or open a second tab and see what came along."
        >
          <PlaygroundPanel
            places={places}
            storage={playgroundStorage}
            onStorageSelect={(storage) =>
              dispatch({ type: "PLAYGROUND_STORAGE_SELECTED", storage })
            }
          />
        </Section>
        <Section
          id="notebook"
          hint="add an entry, switch notebooks, then reload. Change the theme: the next load paints it before React runs."
        >
          <NotebookToolbar
            notebookId={notebookId}
            onNotebookSelect={(next) =>
              dispatch({ type: "NOTEBOOK_SELECTED", notebookId: next })
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SiloProvider
              silo={fieldbook.silo}
              scope={`notebooks:${notebookId}`}
            >
              <div className="md:col-span-2 xl:col-span-1">
                <EntriesPanel livesIn={placesOf("journal", "url")} />
              </div>
              <ComposerPanel livesIn={placesOf("session", "journal")} />
              <SuppliesPanel livesIn={placesOf("journal", "preferences")} />
            </SiloProvider>
          </div>
          <PreferencesPanel livesIn={placesOf("default", "preferences")} />
        </Section>
        <Section
          id="lab"
          hint="press Fail next write, save an entry in step 2, then Retry. Pick Remote in step 1 and watch the Server."
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <LabBar
              flags={store.flags}
              onPrivateModeToggle={() =>
                dispatch({ type: "PRIVATE_MODE_TOGGLED" })
              }
              onSlowJournalToggle={() =>
                dispatch({ type: "SLOW_JOURNAL_TOGGLED" })
              }
              onFailNextWritePress={handleFailNextWritePress}
              onCorruptThemePress={handleCorruptThemePress}
              onPlantLegacyDataPress={handlePlantLegacyDataPress}
              onRecreatePress={() => dispatch({ type: "STORE_RECREATED" })}
            />
            <ServerCard />
          </div>
        </Section>
        <Section
          id="inside"
          hint="open the launcher in the corner, break something in step 3, and watch the timeline."
        >
          <DevtoolsCard />
        </Section>
      </main>
      <Footer />
      {/* Always rendered: this example is the hosted demo, where devtools are the point. */}
      <SiloDevtools />
    </SiloProvider>
  );
};
