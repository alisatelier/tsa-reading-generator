import fs from "node:fs";
import path from "node:path";

function readJsonFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing manifest: ${relativePath}. Run: npm run manifests:build`);
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

export function loadTarotManifest() {
  return readJsonFile("data/tarotManifest.json");
}

export function loadSpreadManifest() {
  return readJsonFile("data/spreadManifest.json");
}
