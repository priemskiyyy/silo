import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "vitepress";

const siteUrl = process.env.DOCS_SITE_URL;
const repositoryUrl =
  process.env.DOCS_REPOSITORY_URL ?? "https://github.com/priemskiyyy/silo";
const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");
const description =
  "Typed, reactive persistence for TypeScript. Store values across browser, mobile and server backends, with framework bindings, expiry, migrations and devtools.";

// llms.txt lists every guide with its description; llms-full.txt inlines them.
const writeLlmsText = async (srcDir: string, outDir: string) => {
  const origin = siteUrl ? siteUrl.replace(/\/$/, "") : base.replace(/\/$/, "");
  const files = (await readdir(srcDir, { recursive: true }))
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !file.startsWith(".vitepress"))
    .filter((file) => file !== "README.md" && file !== "index.md")
    .sort();
  const pages = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(srcDir, file), "utf8");
      const title = source.match(/^# (.+)$/m)?.[1] ?? file;
      const summary = source.match(/^description: "(.+)"$/m)?.[1] ?? "";
      const url = `${origin}/${file.replace(/\.md$/, "")}`;
      return { title, summary, url, source };
    }),
  );
  const index = [
    "# Silo",
    "",
    `> ${description}`,
    "",
    "## Docs",
    "",
    ...pages.map(
      ({ title, summary, url }) => `- [${title}](${url}): ${summary}`,
    ),
    "",
  ].join("\n");
  const full = pages
    .map(({ url, source }) => `<!-- ${url} -->\n${source.trim()}`)
    .join("\n\n---\n\n");
  await writeFile(join(outDir, "llms.txt"), index);
  await writeFile(join(outDir, "llms-full.txt"), `${full}\n`);
};

export default defineConfig({
  base,
  lang: "en-US",
  title: "Silo",
  description,
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        sizes: "64x64",
        href: `${base}favicon.png`,
      },
    ],
    ["link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Silo" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "theme-color", content: "#b45309" }],
  ],
  ...(siteUrl ? { sitemap: { hostname: siteUrl } } : {}),
  buildEnd: async ({ outDir, srcDir }) => {
    const sitemap = siteUrl
      ? `Sitemap: ${new URL("sitemap.xml", `${siteUrl.replace(/\/$/, "")}/`).href}\n`
      : "";
    await writeFile(
      join(outDir, "robots.txt"),
      `User-agent: *\nAllow: /\n${sitemap}`,
    );
    await writeLlmsText(srcDir, outDir);
  },
  transformHead: ({ pageData }) => {
    const title =
      pageData.title === "Silo" ? "Silo" : `${pageData.title} | Silo`;
    const head: [string, Record<string, string>][] = [
      ["meta", { property: "og:title", content: title }],
      [
        "meta",
        {
          property: "og:description",
          content: pageData.description || description,
        },
      ],
      ["meta", { name: "twitter:title", content: title }],
      [
        "meta",
        {
          name: "twitter:description",
          content: pageData.description || description,
        },
      ],
    ];
    if (!siteUrl) {
      return head;
    }

    const pagePath = pageData.relativePath
      .replace(/(^|\/)index\.md$/, "$1")
      .replace(/\.md$/, "");
    const url = new URL(pagePath, `${siteUrl.replace(/\/$/, "")}/`).href;
    const image = new URL(
      "images/social-preview.png",
      `${siteUrl.replace(/\/$/, "")}/`,
    ).href;
    head.push(
      ["link", { rel: "canonical", href: url }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:image", content: image }],
      ["meta", { property: "og:image:width", content: "1200" }],
      ["meta", { property: "og:image:height", content: "630" }],
      [
        "meta",
        {
          property: "og:image:alt",
          content:
            "Silo. Typed, reactive persistence for TypeScript applications.",
        },
      ],
      ["meta", { name: "twitter:image", content: image }],
    );
    return head;
  },
  srcExclude: ["README.md"],
  // The hosted React example is copied into dist/demo after the site builds.
  ignoreDeadLinks: [/^\/demo\//],
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: { src: "/logo.png", alt: "" },
    socialLinks: repositoryUrl ? [{ icon: "github", link: repositoryUrl }] : [],
    ...(repositoryUrl
      ? {
          editLink: { pattern: `${repositoryUrl}/edit/main/docs/:path` },
        }
      : {}),
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Adapters", link: "/adapters" },
      {
        text: "Frameworks",
        items: [
          { text: "React", link: "/react" },
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
        ],
      },
      { text: "Examples", link: "/examples" },
      { text: "Devtools", link: "/devtools" },
      {
        text: "Reference",
        items: [
          { text: "The store", link: "/silo" },
          { text: "Schema and codecs", link: "/schema-and-codecs" },
          { text: "Writing an adapter", link: "/writing-an-adapter" },
          { text: "Runtime architecture", link: "/internals/architecture" },
          { text: "Memory and lifetime", link: "/internals/memory" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Start here",
        items: [
          { text: "What Silo is", link: "/" },
          { text: "Getting started", link: "/getting-started" },
          { text: "Installation", link: "/installation" },
          { text: "Choose an adapter", link: "/adapters" },
          { text: "Example applications", link: "/examples" },
        ],
      },
      {
        text: "The model",
        items: [
          { text: "The store", link: "/silo" },
          { text: "Schema and codecs", link: "/schema-and-codecs" },
          { text: "Storages and namespaces", link: "/storages" },
          { text: "Scopes", link: "/scopes" },
          { text: "Synchronous and asynchronous", link: "/sync-vs-async" },
          { text: "Reactive values", link: "/reactive-values" },
          { text: "Hydration and flush", link: "/hydration-and-flush" },
          { text: "Fallbacks and removal", link: "/defaults-and-removal" },
          { text: "Expiring values", link: "/ttl" },
          { text: "Migrations", link: "/migrations" },
        ],
      },
      {
        text: "Build your application",
        items: [
          { text: "Recipes", link: "/recipes" },
          { text: "Server rendering", link: "/server-rendering" },
          { text: "Native access", link: "/native-access" },
          { text: "External observation", link: "/external-observation" },
          { text: "Errors and recovery", link: "/errors-and-recovery" },
        ],
      },
      {
        text: "Frameworks",
        items: [
          { text: "React hooks", link: "/react" },
          { text: "Vue composables", link: "/vue" },
          { text: "Solid primitives", link: "/solid" },
          { text: "Svelte utilities", link: "/svelte" },
        ],
      },
      {
        text: "Inspect and test",
        items: [
          { text: "Browser devtools", link: "/devtools" },
          { text: "Application testing", link: "/testing" },
          { text: "Adapter conformance", link: "/testing-adapters" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Writing an adapter", link: "/writing-an-adapter" },
          { text: "Runtime architecture", link: "/internals/architecture" },
          { text: "Memory and lifetime", link: "/internals/memory" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: { message: "Released under the MIT License." },
  },
});
