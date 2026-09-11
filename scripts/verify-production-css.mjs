import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve(process.env.NEXT_BUILD_DIR ?? ".next");
const manifestPath = path.join(buildDirectory, "app-build-manifest.json");

function fail(message) {
  console.error(`Production CSS verification failed: ${message}`);
  process.exitCode = 1;
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const cssAssets = [
    ...new Set(
      Object.values(manifest.pages ?? {})
        .flat()
        .filter((asset) => typeof asset === "string" && asset.endsWith(".css")),
    ),
  ];

  if (cssAssets.length === 0) {
    fail(`${manifestPath} does not reference a CSS asset`);
  } else {
    const stylesheets = await Promise.all(
      cssAssets.map(async (asset) => {
        const assetPath = path.join(buildDirectory, asset);
        await access(assetPath);
        const details = await stat(assetPath);
        if (details.size === 0) throw new Error(`${asset} is empty`);
        return readFile(assetPath, "utf8");
      }),
    );
    const compiledCss = stylesheets.join("\n");

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
      fail(`compiled styles are missing: ${missingRules.join(", ")}`);
    } else {
      console.log(
        `Verified ${cssAssets.length} production CSS asset(s): ${cssAssets.join(", ")}`,
      );
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
