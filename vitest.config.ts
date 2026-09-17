import { svelte } from "@sveltejs/vite-plugin-svelte";
import solid from "vite-plugin-solid";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import type { TestProjectConfiguration } from "vitest/config";

type ProjectOptions = {
  environment: "node" | "jsdom";
  setupFiles: string[];
  dedupe: string[];
};

const project = (
  directory: string,
  name: string,
  options: Partial<ProjectOptions> = {},
) =>
  ({
    extends: true,
    resolve: {
      alias: {
        src: fileURLToPath(
          new URL(`./${directory}/${name}/src`, import.meta.url),
        ),
      },
      dedupe: options.dedupe ?? [],
    },
    test: {
      name,
      include: [`${directory}/${name}/src/**/*.test.{ts,tsx}`],
      environment: options.environment ?? "node",
      setupFiles: options.setupFiles ?? [],
    },
  }) satisfies TestProjectConfiguration;

// The devtools core is Solid: it needs the Solid plugin and browser
// resolution so effects run in jsdom, and the React wrapper's test renders
// against the same React instance as the binding.
const devtoolsProject: TestProjectConfiguration = {
  extends: true,
  plugins: [solid()],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./packages/devtools/src", import.meta.url)),
      "@priemskiyyy/silo-devtools": fileURLToPath(
        new URL("./packages/devtools/src/index.ts", import.meta.url),
      ),
    },
    conditions: ["development", "browser"],
    dedupe: ["react", "react-dom"],
  },
  test: {
    name: "devtools",
    include: ["packages/devtools/src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    server: { deps: { inline: [/solid-js/, /@solidjs\/testing-library/] } },
  },
};

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    projects: [
      devtoolsProject,
      project("packages", "core"),
      project("packages", "react", {
        environment: "jsdom",
        // A binding must render against the same React instance as the renderer under test.
        dedupe: ["react", "react-dom"],
      }),
      {
        ...project("packages", "vue", {
          environment: "jsdom",
          dedupe: ["vue"],
        }),
        test: {
          name: "vue",
          environment: "jsdom",
          include: ["packages/vue/src/**/*.test.ts"],
          exclude: ["**/*.server.test.ts"],
        },
      },
      {
        ...project("packages", "vue", { dedupe: ["vue"] }),
        test: {
          name: "vue-ssr",
          include: ["packages/vue/src/**/*.server.test.ts"],
          environment: "node",
        },
      },
      {
        ...project("packages", "solid"),
        plugins: [solid()],
        resolve: {
          alias: {
            src: fileURLToPath(
              new URL("./packages/solid/src", import.meta.url),
            ),
          },
          conditions: ["development", "browser"],
          dedupe: ["solid-js"],
        },
        test: {
          name: "solid",
          environment: "jsdom",
          include: ["packages/solid/src/**/*.test.{ts,tsx}"],
          exclude: ["**/*.server.test.tsx"],
          server: {
            deps: { inline: [/solid-js/, /@solidjs\/testing-library/] },
          },
        },
      },
      {
        ...project("packages", "solid"),
        plugins: [solid({ ssr: true })],
        test: {
          name: "solid-ssr",
          environment: "node",
          include: ["packages/solid/src/**/*.server.test.tsx"],
        },
      },
      {
        ...project("packages", "svelte"),
        plugins: [svelte({ configFile: false })],
        resolve: { conditions: ["browser"] },
        test: {
          name: "svelte",
          environment: "jsdom",
          include: ["packages/svelte/src/**/*.test.ts"],
          exclude: ["**/*.server.test.ts"],
        },
      },
      {
        ...project("packages", "svelte"),
        plugins: [svelte({ configFile: false })],
        test: {
          name: "svelte-ssr",
          environment: "node",
          include: ["packages/svelte/src/**/*.server.test.ts"],
        },
      },
      project("packages/adapters", "memory"),
      // Web storage needs a document, and the `storage` event is synthesized in jsdom.
      project("packages/adapters", "local-storage", { environment: "jsdom" }),
      project("packages/adapters", "session-storage", { environment: "jsdom" }),
      // fake-indexeddb installs the IDB globals that node does not ship.
      project("packages/adapters", "indexeddb", {
        setupFiles: ["fake-indexeddb/auto"],
      }),
      // Cookies need a document; jsdom implements document.cookie.
      project("packages/adapters", "cookie", { environment: "jsdom" }),
      // The rest wrap an instance the application hands over, so a fake of
      // its shape is the whole platform.
      project("packages/adapters", "chrome-storage"),
      project("packages/adapters", "mmkv"),
      project("packages/adapters", "async-storage"),
      project("packages/adapters", "expo-secure-store"),
      project("packages/adapters", "capacitor-preferences"),
      project("packages/adapters", "json-file"),
      project("packages/adapters", "unstorage"),
      project("packages/adapters", "http"),
      // The query string needs a location and a history; jsdom has both.
      project("packages/adapters", "search-params", { environment: "jsdom" }),
      project("packages/adapters", "sqlite"),
      project("packages/adapters", "tauri-store"),
      project("packages/adapters", "electron-store"),
      project("packages/adapters", "redis"),
      project("packages/adapters", "react-native-keychain"),
      project("packages/adapters", "cloudflare-kv"),
      project("packages/adapters", "cloudflare-durable-objects"),
      project("packages/adapters", "simulcast"),
      project("packages/adapters", "icloud"),
    ],
  },
});
