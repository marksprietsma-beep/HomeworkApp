import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve(process.env.NEXT_BUILD_DIR ?? ".next");
const manifestNames = ["app-build-manifest.json", "build-manifest.json"];

function fail(message) {
  console.error(`Production asset verification failed: ${message}`);
  process.exitCode = 1;
}

function collectStaticAssets(value, assets = new Set()) {
  if (typeof value === "string") {
    if (/^static\/.+\.(?:css|js)$/.test(value)) assets.add(value);
    return assets;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStaticAssets(item, assets);
    return assets;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStaticAssets(item, assets);
  }
  return assets;
}

try {
  const manifests = await Promise.all(
    manifestNames.map(async (name) =>
      JSON.parse(await readFile(path.join(buildDirectory, name), "utf8")),
    ),
  );
  const assets = [...collectStaticAssets(manifests)].sort();
  const cssAssets = assets.filter((asset) => asset.endsWith(".css"));
  const jsAssets = assets.filter((asset) => asset.endsWith(".js"));

  if (cssAssets.length === 0) throw new Error("build manifests reference no CSS assets");
  if (jsAssets.length === 0) throw new Error("build manifests reference no JavaScript assets");

  const contents = new Map(
    await Promise.all(
      assets.map(async (asset) => {
        const assetPath = path.join(buildDirectory, asset);
        await access(assetPath);
        const details = await stat(assetPath);
        if (details.size === 0) throw new Error(`${asset} is empty`);
        return [asset, await readFile(assetPath, "utf8")];
      }),
    ),
  );
  const compiledCss = cssAssets.map((asset) => contents.get(asset)).join("\n");

  // These cover Tailwind's reset/utilities and the appearance rules introduced
  // for student preferences. Their absence means a build can render as plain HTML.
  const requiredRules = [
    ["Tailwind preflight", "box-sizing:border-box"],
    ["Tailwind layout utilities", ".flex{"],
    ["Clarion page theme", "--page:#f8fafc"],
    ["student dark theme", "html[data-theme=dark]"],
    ["student large text", "html[data-text-size=large]"],
  ];
  const missingRules = requiredRules
    .filter(([, marker]) => !compiledCss.includes(marker))
    .map(([name]) => name);
  if (missingRules.length > 0) {
    throw new Error(`compiled styles are missing: ${missingRules.join(", ")}`);
  }

  console.log(
    `Verified ${cssAssets.length} CSS and ${jsAssets.length} JavaScript production assets`,
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
