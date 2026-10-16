import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import { transform } from "lightningcss";
import { minify as minifyJavaScript } from "terser";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputDirectory = path.join(projectRoot, "dist");

const ignoredDirectories = new Set([
  ".git",
  ".github",
  "dist",
  "node_modules",
  "scripts",
]);
const ignoredFiles = new Set(["package-lock.json", "package.json"]);
const deployableExtensions = new Set([
  ".css",
  ".gif",
  ".html",
  ".ico",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".png",
  ".svg",
  ".txt",
  ".webmanifest",
  ".webp",
  ".woff",
  ".woff2",
  ".xml",
]);
const deployableNames = new Set(["CNAME"]);

const htmlOptions = {
  caseSensitive: true,
  collapseWhitespace: "conservative",
  decodeEntities: true,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: {
    compress: { passes: 2 },
    ecma: 2022,
    format: { comments: false },
    mangle: true,
  },
  removeAttributeQuotes: false,
  removeComments: true,
  removeEmptyAttributes: false,
  removeOptionalTags: false,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  sortAttributes: false,
  sortClassName: false,
  useShortDoctype: true,
};

function relativePath(absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function isDeployable(filePath) {
  const name = path.basename(filePath);
  return (
    deployableNames.has(name) || deployableExtensions.has(path.extname(name).toLowerCase())
  );
}

async function findDeployableFiles(directory = projectRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".DS_Store" || ignoredFiles.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...(await findDeployableFiles(absolutePath)));
      }
      continue;
    }

    if (entry.isFile() && isDeployable(absolutePath)) files.push(absolutePath);
  }

  return files;
}

async function optimizeHtml(source, fileName) {
  try {
    return await minifyHtml(source, htmlOptions);
  } catch (error) {
    throw new Error(`Could not minify ${fileName}: ${error.message}`);
  }
}

async function optimizeCss(source, fileName) {
  try {
    return Buffer.from(
      transform({
        code: Buffer.from(source),
        filename: fileName,
        minify: true,
        sourceMap: false,
      }).code,
    ).toString("utf8");
  } catch (error) {
    throw new Error(`Could not minify ${fileName}: ${error.message}`);
  }
}

async function optimizeJavaScript(source, fileName) {
  const result = await minifyJavaScript(source, {
    compress: { passes: 2 },
    ecma: 2022,
    format: { comments: false },
    mangle: true,
    module: false,
  });

  if (!result.code) throw new Error(`Could not minify ${fileName}`);
  return result.code;
}

async function buildFile(sourcePath) {
  const outputPath = path.join(outputDirectory, relativePath(sourcePath));
  const extension = path.extname(sourcePath).toLowerCase();
  const originalSize = (await stat(sourcePath)).size;

  await mkdir(path.dirname(outputPath), { recursive: true });

  if (extension === ".html" || extension === ".css" || extension === ".js") {
    const source = await readFile(sourcePath, "utf8");
    const optimized =
      extension === ".html"
        ? await optimizeHtml(source, relativePath(sourcePath))
        : extension === ".css"
          ? await optimizeCss(source, relativePath(sourcePath))
          : await optimizeJavaScript(source, relativePath(sourcePath));

    await writeFile(outputPath, optimized, "utf8");
  } else {
    await cp(sourcePath, outputPath);
  }

  return {
    extension: extension || "other",
    originalSize,
    optimizedSize: (await stat(outputPath)).size,
  };
}

function formatBytes(bytes) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "unit",
    unit: "kilobyte",
    unitDisplay: "narrow",
  }).format(bytes / 1_024);
}

async function main() {
  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });

  const files = await findDeployableFiles();
  const results = await Promise.all(files.map(buildFile));
  const totals = results.reduce(
    (summary, result) => {
      summary.original += result.originalSize;
      summary.optimized += result.optimizedSize;
      return summary;
    },
    { optimized: 0, original: 0 },
  );
  const saved = totals.original - totals.optimized;
  const percent = totals.original
    ? ((saved / totals.original) * 100).toFixed(1)
    : "0.0";

  console.log(
    `Built ${results.length} files in dist/ — ${formatBytes(totals.original)} → ${formatBytes(totals.optimized)} (${formatBytes(saved)} / ${percent}% saved).`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
