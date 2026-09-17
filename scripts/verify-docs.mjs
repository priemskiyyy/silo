import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));

// Amendment A7 fixes the documentation filenames so that every link target
// resolves. A page outside this list is unreachable from the sidebar and a link
// to one that is not here is dead the moment it ships.
const CANONICAL_PAGES = [
  "index.md",
  "installation.md",
  "getting-started.md",
  "examples.md",
  "silo.md",
  "schema-and-codecs.md",
  "storages.md",
  "sync-vs-async.md",
  "reactive-values.md",
  "hydration-and-flush.md",
  "defaults-and-removal.md",
  "scopes.md",
  "ttl.md",
  "migrations.md",
  "adapters.md",
  "recipes.md",
  "native-access.md",
  "external-observation.md",
  "server-rendering.md",
  "react.md",
  "vue.md",
  "solid.md",
  "svelte.md",
  "errors-and-recovery.md",
  "devtools.md",
  "writing-an-adapter.md",
  "testing.md",
  "testing-adapters.md",
  "troubleshooting.md",
  "internals/architecture.md",
  "internals/memory.md",
];

const relative = (file) => path.relative(root, file);

const markdownFiles = (directory) =>
  existsSync(directory)
    ? readdirSync(directory, { recursive: true })
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => path.join(directory, entry))
    : [];

const sources = [
  ...markdownFiles(path.join(root, "docs")).filter(
    (file) => !relative(file).startsWith("docs/.vitepress/"),
  ),
  ...["packages", "packages/adapters"].flatMap((group) =>
    readdirSync(path.join(root, group))
      .map((directory) => path.join(root, group, directory, "README.md"))
      .filter(existsSync),
  ),
  ...[
    "README.md",
    "CONTRIBUTING.md",
    "RELEASING.md",
    "SUPPORT.md",
    "CHANGELOG.md",
  ].map((file) => path.join(root, file)),
  ...readdirSync(path.join(root, "examples"))
    .map((directory) => path.join(root, "examples", directory, "README.md"))
    .filter(existsSync),
].filter(existsSync);

const pages = markdownFiles(path.join(root, "docs"))
  .map((file) => path.relative(path.join(root, "docs"), file))
  .filter((page) => !page.startsWith(".vitepress/"));
const uncanonical = pages.filter((page) => !CANONICAL_PAGES.includes(page));
assert.deepEqual(
  uncanonical,
  [],
  `Amendment A7 fixes the page list; these are not on it: ${uncanonical.join(", ")}`,
);

// Every miss is collected rather than thrown at the first one: a single dead
// link per run turns fixing a set of them into a set of round trips.
const broken = [];
let checked = 0;
for (const file of sources) {
  const markdown = readFileSync(file, "utf8");
  if (relative(file).startsWith("docs/")) {
    const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    assert.match(
      frontmatter,
      /^description: "[^"\n]+"$/m,
      `${relative(file)}: missing frontmatter description`,
    );
  }
  assert.doesNotMatch(
    markdown,
    /^\s*(?:<!--\s*)?(?:generated (?:by|with)|co-authored-by:)/im,
    `${relative(file)}: remove an authoring attribution from public documentation`,
  );
  // Inline links only. Code fences are left alone because a link inside one is
  // sample text rather than navigation.
  const prose = markdown.replace(/```[\s\S]*?```/g, "");
  for (const [, source] of prose.matchAll(/<img\b[^>]*\ssrc="([^"\n]+)"/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
      continue;
    }
    assert.ok(
      existsSync(path.resolve(path.dirname(file), source)),
      `${relative(file)}: missing image ${source}`,
    );
  }
  for (const [, target] of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) {
      continue;
    }

    checked += 1;
    const [pathname] = target.split("#");

    if (pathname === "") {
      continue;
    }

    if (existsSync(path.resolve(path.dirname(file), pathname))) {
      continue;
    }

    broken.push(`${relative(file)} -> ${target}`);
  }
}
assert.deepEqual(
  broken,
  [],
  `Dead relative links:\n  ${broken.join("\n  ")}\n`,
);
console.log(
  `Verified ${checked} relative links across ${sources.length} markdown sources.`,
);

const output = path.join(root, "docs/.vitepress/dist");
const siteUrl = process.env.DOCS_SITE_URL;
const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");
const files = existsSync(output)
  ? readdirSync(output, { recursive: true }).filter(
      // The hosted demo under demo/ is an application, not a page of the site.
      (file) =>
        file.endsWith(".html") &&
        file !== "404.html" &&
        !file.startsWith("demo/"),
    )
  : [];
assert.ok(files.length > 0, "Build the documentation before verifying it");
const pageIds = new Map();
for (const file of files) {
  const dom = new JSDOM(readFileSync(path.join(output, file), "utf8"));
  pageIds.set(
    file,
    new Set(
      Array.from(
        dom.window.document.querySelectorAll("[id]"),
        (element) => element.id,
      ),
    ),
  );
  dom.window.close();
}

for (const file of files) {
  const dom = new JSDOM(readFileSync(path.join(output, file), "utf8"));
  const document = dom.window.document;
  const meta = (selector) =>
    document.querySelector(selector)?.getAttribute("content");
  assert.ok(document.title.includes("Silo"), `${file}: missing page title`);
  assert.equal(
    document.querySelectorAll("h1").length,
    1,
    `${file}: expected one main heading`,
  );
  assert.equal(
    document.querySelectorAll("main").length,
    1,
    `${file}: expected one main landmark`,
  );
  const origin = new URL(siteUrl ?? "https://docs.local").origin;
  const currentUrl = new URL(`${base}${file}`, origin);
  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    const target = new URL(href, currentUrl);

    if (target.origin !== origin) {
      continue;
    }

    if (/^https?:\/\//i.test(href) && !target.pathname.startsWith(base)) {
      continue;
    }

    assert.ok(
      target.pathname.startsWith(base),
      `${file}: link escapes the configured base: ${target.pathname}`,
    );
    const route = decodeURIComponent(target.pathname.slice(base.length));
    const targetFile =
      route.endsWith("/") || route === ""
        ? `${route}index.html`
        : path.extname(route)
          ? route
          : `${route}.html`;
    assert.ok(
      existsSync(path.join(output, targetFile)),
      `${file}: missing link target ${targetFile}`,
    );

    if (target.hash && pageIds.has(targetFile)) {
      assert.ok(
        pageIds.get(targetFile).has(decodeURIComponent(target.hash.slice(1))),
        `${file}: missing anchor ${targetFile}${target.hash}`,
      );
    }
  }
  assert.ok(meta('meta[name="description"]'), `${file}: missing description`);
  for (const property of ["og:title", "og:description"]) {
    assert.ok(
      meta(`meta[property="${property}"]`),
      `${file}: missing ${property}`,
    );
  }
  for (const image of document.querySelectorAll("img")) {
    assert.ok(image.hasAttribute("alt"), `${file}: image is missing alt text`);
    const source = image.getAttribute("src");

    if (source?.startsWith(base)) {
      assert.ok(
        existsSync(path.join(output, source.slice(base.length))),
        `${file}: missing image ${source}`,
      );
    }
  }

  for (const rel of ["icon", "apple-touch-icon"]) {
    const href = document
      .querySelector(`link[rel="${rel}"]`)
      ?.getAttribute("href");
    assert.ok(
      href?.startsWith(base),
      `${file}: missing ${rel} under the configured base`,
    );
    assert.ok(
      existsSync(path.join(output, href.slice(base.length))),
      `${file}: missing ${rel} image`,
    );
  }

  if (siteUrl) {
    const expected = new URL(
      file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, ""),
      `${siteUrl.replace(/\/$/, "")}/`,
    ).href;
    assert.equal(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
      expected,
      `${file}: incorrect canonical URL`,
    );
    assert.equal(
      meta('meta[property="og:url"]'),
      expected,
      `${file}: incorrect Open Graph URL`,
    );
    const image = meta('meta[property="og:image"]');
    assert.ok(
      image?.startsWith(`${siteUrl.replace(/\/$/, "")}/`),
      `${file}: social image must use the deployed site URL`,
    );
    assert.ok(
      meta('meta[property="og:image:alt"]'),
      `${file}: missing social image description`,
    );
    const imagePath = new URL(image).pathname.slice(base.length);
    const png = readFileSync(path.join(output, imagePath));
    assert.equal(png.readUInt32BE(16), 1200, `${file}: social image width`);
    assert.equal(png.readUInt32BE(20), 630, `${file}: social image height`);
  }
  dom.window.close();
}

if (siteUrl) {
  const robots = readFileSync(path.join(output, "robots.txt"), "utf8");
  const sitemapUrl = new URL("sitemap.xml", `${siteUrl.replace(/\/$/, "")}/`)
    .href;
  assert.ok(
    robots.includes(`Sitemap: ${sitemapUrl}`),
    "robots.txt must link to the deployed sitemap",
  );
  assert.ok(
    existsSync(path.join(output, "sitemap.xml")),
    "Missing sitemap.xml",
  );
}
console.log(
  `Verified titles, headings, descriptions, images, and deployment metadata for ${files.length} documentation pages.`,
);
