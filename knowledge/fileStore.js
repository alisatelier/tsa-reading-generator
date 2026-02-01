import fs from "node:fs";
import path from "node:path";

export function readKnowledgeTextFile(relativePath) {
  const absolutePath = path.join(process.cwd(), relativePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing knowledge file: ${relativePath}`);
  }

  return fs.readFileSync(absolutePath, "utf8");
}

