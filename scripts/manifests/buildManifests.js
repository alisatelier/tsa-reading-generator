import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_ROOT = path.join(process.cwd(), "knowledge");
const DATA_ROOT = path.join(process.cwd(), "data");

function ensureDataFolderExists() {
  if (!fs.existsSync(DATA_ROOT)) {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
  }
}

function listAllTextFilesRecursively(folderAbsolutePath) {
  const results = [];
  const entries = fs.readdirSync(folderAbsolutePath, { withFileTypes: true });

  for (const entry of entries) {
    const entryAbsolutePath = path.join(folderAbsolutePath, entry.name);

    if (entry.isDirectory()) {
      results.push(...listAllTextFilesRecursively(entryAbsolutePath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".txt")) {
      results.push(entryAbsolutePath);
    }
  }

  return results;
}

function toRelativeKnowledgePath(absolutePath) {
  // absolute => "knowledge/..."
  const relative = path.relative(process.cwd(), absolutePath);
  return relative.split(path.sep).join("/");
}

function normalizeKey(text) {
  return String(text || "").trim().toLowerCase();
}

function extractFirstMatch(text, regex) {
  const match = String(text || "").match(regex);
  return match ? match[1].trim() : null;
}

function parseCardHeaderFields(cardText) {
  const cardId = extractFirstMatch(cardText, /CARD ID:\s*([0-9]+)/i);

  // IMPORTANT: Your header is often one long line; this captures canonical name safely.
  const canonicalName = extractFirstMatch(
    cardText,
    /CANONICAL TSA NAME[^:]*:\s*(.+?)(?=\s+RWS\s+EQUIVALENT|\s+ELEMENT:|\s+SUIT:|\s+PIP:|\s+NAMING RULE:|\n|$)/i
  );

  const suit = extractFirstMatch(cardText, /\bSUIT:\s*([A-Za-z]+)/i);
  const pip = extractFirstMatch(cardText, /\bPIP:\s*([A-Za-z0-9]+)/i);

  return { cardId, canonicalName, suit, pip };
}

function buildTarotManifest({ allKnowledgeTextFiles }) {
  const tarotManifest = {
    cardsById: {},
    cardsByCanonicalName: {}, // maps name -> id
  };

  for (const fileAbsolutePath of allKnowledgeTextFiles) {
    const relativePath = toRelativeKnowledgePath(fileAbsolutePath);

    // Only map actual card files
    if (!relativePath.startsWith("knowledge/cards/")) continue;

    const cardText = fs.readFileSync(fileAbsolutePath, "utf8");
    const { cardId, canonicalName, suit, pip } = parseCardHeaderFields(cardText);

    if (!cardId) continue;

    // Base mapping: exact card file
    const cardRecord = {
      cardPath: relativePath,
    };

    // Only pips have suit + pip layering
    if (suit && pip) {
      cardRecord.suitPath = `knowledge/minorArcana/suits/${normalizeKey(suit)}.txt`;
      cardRecord.pipPath = `knowledge/minorArcana/pips/${normalizeKey(pip)}.txt`;
    }

    tarotManifest.cardsById[String(cardId)] = cardRecord;

    if (canonicalName) {
      tarotManifest.cardsByCanonicalName[normalizeKey(canonicalName)] = String(cardId);
    }
  }

  return tarotManifest;
}

function buildSpreadManifest() {
  // You already have positions files at: knowledge/positions/*.txt
  // And you have spread keys like: ppf, fml, kdk, pphao, gsbbl, this-or-that, horoscope, etc.
  //
  // Since your spread definitions exist as text files (or can), we’ll map spread -> ordered position keys.
  //
  // Update these arrays to match YOUR spreads.
  // (You can also generate these automatically later, but this is clear and deterministic.)

  return {
    ppf: {
      spreadPath: "knowledge/spreads/ppf.txt",
      positions: ["past", "present", "future_directional"],
    },
    pphao: {
      spreadPath: "knowledge/spreads/pphao.txt",
      positions: ["past", "present", "hidden_issues", "advice", "outcome"],
    },
    kdk: {
      spreadPath: "knowledge/spreads/kdk.txt",
      positions: ["what_i_know", "what_i_dont_know", "what_i_need_to_know"],
    },
    gsbbl: {
      spreadPath: "knowledge/spreads/gsbbl.txt",
      positions: ["goal", "status", "block", "bridge", "lesson"],
    },
    fml: {
      spreadPath: "knowledge/spreads/fml.txt",
      positions: ["focus", "moving_forward", "letting_go"],
    },
    tot: {
      spreadPath: "knowledge/spreads/this-or-that.txt",
      // Your note: Focus + Pro/Con for A and B = total 5 cards
      positions: ["focus", "option_a_pro", "option_a_con", "option_b_pro", "option_b_con"],
    },
    horoscope: {
      spreadPath: "knowledge/spreads/horoscope.txt",
      // dynamic positions handled in code; this is still the “template”
      positions: ["sign_1", "sign_2", "sign_3", "sign_4", "sign_5", "sign_6", "sign_7", "sign_8", "sign_9", "sign_10", "sign_11", "sign_12"],
    },
  };
}

function writeJsonFile({ relativePath, data }) {
  const absolutePath = path.join(process.cwd(), relativePath);
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), "utf8");
}

function main() {
  ensureDataFolderExists();

  const allKnowledgeTextFiles = listAllTextFilesRecursively(KNOWLEDGE_ROOT);

  const tarotManifest = buildTarotManifest({ allKnowledgeTextFiles });
  const spreadManifest = buildSpreadManifest();

  writeJsonFile({ relativePath: "data/tarotManifest.json", data: tarotManifest });
  writeJsonFile({ relativePath: "data/spreadManifest.json", data: spreadManifest });

  console.log("✅ Manifests written:");
  console.log(" - data/tarotManifest.json");
  console.log(" - data/spreadManifest.json");
  console.log(`✅ Cards mapped: ${Object.keys(tarotManifest.cardsById).length}`);
  console.log(`✅ Spreads mapped: ${Object.keys(spreadManifest).length}`);
}

main();
