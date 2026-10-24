import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { transform } from "lightningcss";

const projectRoot = process.cwd();
const siteDirectory = path.resolve(
  projectRoot,
  process.env.SITE_DIRECTORY || ".",
);
const excludedDirectories = new Set([".git", ".github", "dist", "node_modules", "scripts"]);

function discoverPages(directory = siteDirectory, relativeDirectory = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) return [];
      return discoverPages(path.join(directory, entry.name), path.join(relativeDirectory, entry.name));
    }

    return entry.isFile() && entry.name === "index.html"
      ? [path.join(relativeDirectory, entry.name)]
      : [];
  });
}

const pages = discoverPages();
const guideSlugs = [
  "cap-cana-vs-punta-cana-village",
  "best-beaches-near-punta-cana",
  "where-to-stay-near-puj-airport",
  "ojos-indigenas-guide",
  "october-events-punta-cana-village-2026",
  "october-events-cap-cana-2026",
];

function sitePath(file) {
  return path.join(siteDirectory, file);
}

function readSiteFile(file) {
  return readFileSync(sitePath(file), "utf8");
}

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
      .map(([, name, doubleQuoted, singleQuoted, unquoted]) => [
        name.toLowerCase(),
        doubleQuoted ?? singleQuoted ?? unquoted ?? "",
      ]),
  );
}

function localAssetPath(reference, page) {
  if (
    !reference ||
    reference.startsWith("#") ||
    reference.startsWith("//") ||
    /^(?:data|mailto|tel|javascript):/i.test(reference) ||
    /^[a-z][a-z\d+.-]*:/i.test(reference)
  ) {
    return null;
  }

  const cleanReference = reference.split(/[?#]/, 1)[0];
  if (!cleanReference) return null;

  const fromPage = path.dirname(sitePath(page));
  return cleanReference.startsWith("/")
    ? path.join(siteDirectory, cleanReference)
    : path.resolve(fromPage, cleanReference);
}

function assertLocalReferenceExists(reference, page) {
  const filePath = localAssetPath(reference, page);
  if (!filePath) return;

  const resolvedPath = existsSync(filePath) && statSync(filePath).isDirectory()
    ? path.join(filePath, "index.html")
    : filePath;

  assert.ok(
    existsSync(resolvedPath),
    `${page} references a missing local file: ${reference}`,
  );
}

function inlineScripts(html) {
  return [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
}

test("every page has core metadata and accessible page landmarks", () => {
  for (const page of pages) {
    const html = readSiteFile(page);
    assert.match(html, /<!doctype html>/i, `${page} is missing a doctype`);
    assert.match(html, /<html\b[^>]*\blang=["']en(?:-[^"']+)?["']/i, `${page} is missing a language`);
    assert.equal((html.match(/<title>/gi) || []).length, 1, `${page} needs one title`);
    assert.match(html, /<meta\b[^>]*name=["']description["']/i, `${page} is missing a description`);
    assert.equal(
      (html.match(/<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main-content["']/gi) || []).length,
      1,
      `${page} needs one skip link`,
    );
    assert.equal(
      (html.match(/<main\b[^>]*id=["']main-content["'][^>]*tabindex=["']-1["']/gi) || []).length,
      1,
      `${page} needs one focusable main landmark`,
    );
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${page} needs one H1`);
  }
});

test("HTML references resolve locally and new tabs are safe", () => {
  for (const page of pages) {
    const html = readSiteFile(page);

    for (const tag of html.match(/<(?:a|img|script|source|link)\b[^>]*>/gi) || []) {
      const attrs = attributes(tag);
      if (attrs.href) assertLocalReferenceExists(attrs.href, page);
      if (attrs.src) assertLocalReferenceExists(attrs.src, page);
      if (attrs.srcset) {
        for (const source of attrs.srcset.split(",")) {
          assertLocalReferenceExists(source.trim().split(/\s+/, 1)[0], page);
        }
      }
      if (tag.startsWith("<a") && attrs.target === "_blank") {
        assert.match(
          attrs.rel || "",
          /(?:^|\s)noopener(?:\s|$)/,
          `${page} has a new-tab link without rel=noopener`,
        );
      }
    }

    for (const image of html.match(/<img\b[^>]*>/gi) || []) {
      assert.match(image, /\balt\s*=/i, `${page} has an image without alt text`);
    }
  }
});

test("CSS and executable JavaScript parse", () => {
  const cssFiles = ["property.css", "guide.css"];
  const homeHtml = readSiteFile("index.html");
  const inlineStyles = [...homeHtml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1],
  );

  for (const [index, css] of [
    ...cssFiles.map(readSiteFile),
    ...inlineStyles,
  ].entries()) {
    assert.doesNotThrow(
      () => transform({ code: Buffer.from(css), filename: `style-${index}.css` }),
      `CSS ${index} does not parse`,
    );
  }

  for (const scriptFile of ["analytics.js", "availability.js", "property.js"]) {
    assert.doesNotThrow(
      () => new vm.Script(readSiteFile(scriptFile), { filename: scriptFile }),
      `${scriptFile} does not parse`,
    );
  }

  for (const page of pages) {
    for (const [, scriptAttributes, script] of inlineScripts(readSiteFile(page))) {
      if (/type=["']application\/ld\+json["']/i.test(scriptAttributes)) continue;
      if (script.trim()) {
        assert.doesNotThrow(
          () => new Function(script),
          `${page} has inline JavaScript that does not parse`,
        );
      }
    }
  }
});

test("structured data is valid JSON-LD", () => {
  for (const page of pages) {
    for (const [, scriptAttributes, json] of inlineScripts(readSiteFile(page))) {
      if (!/type=["']application\/ld\+json["']/i.test(scriptAttributes)) continue;
      assert.doesNotThrow(
        () => JSON.parse(json),
        `${page} has invalid JSON-LD`,
      );
    }
  }
});

test("availability data is complete and its browser snapshot matches", () => {
  const availability = JSON.parse(readSiteFile("availability.json"));
  assert.equal(availability.version, 1);

  for (const property of ["dreamcatcher", "happy-place"]) {
    const ranges = availability.properties?.[property]?.unavailable;
    assert.ok(Array.isArray(ranges), `${property} needs unavailable date ranges`);

    for (const range of ranges) {
      assert.match(range.start, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(range.end, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(range.start < range.end, `${property} has an invalid date range`);
    }
  }

  const context = { window: {} };
  vm.runInNewContext(readSiteFile("availability.js"), context, {
    filename: "availability.js",
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.window.ORSINI_AVAILABILITY)),
    availability,
  );
});

test("Instagram links and analytics tracking remain wired", () => {
  const html = readSiteFile("index.html");
  const analytics = readSiteFile("analytics.js");

  assert.equal(
    (html.match(/data-instagram-type="reel"/g) || []).length,
    4,
    "Home page should contain four featured Reels",
  );
  assert.match(html, /https:\/\/www\.instagram\.com\/orsinistays\//);
  assert.match(analytics, /view_instagram_reel/);
  assert.match(analytics, /follow_instagram/);
});

test("travel guide routes, article schema, and sitemap stay in sync", () => {
  const guideIndex = readSiteFile("guides/index.html");
  const sitemap = readSiteFile("sitemap.xml");

  for (const slug of guideSlugs) {
    const page = `guides/${slug}/index.html`;
    const html = readSiteFile(page);
    assert.match(guideIndex, new RegExp(`href=["']${slug}/["']`));
    assert.match(html, new RegExp(`data-guide=["']${slug}["']`));
    assert.match(html, /["']@type["']\s*:\s*["']BlogPosting["']/);
    assert.match(sitemap, new RegExp(`<loc>https://www\\.orsinistays\\.com/guides/${slug}/</loc>`));
  }

  assert.match(sitemap, /<loc>https:\/\/www\.orsinistays\.com\/guides\/<\/loc>/);
  assert.match(readSiteFile("analytics.js"), /view_guide/);
});
