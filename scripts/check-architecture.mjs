import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const scopedDirs = [
  "app/server-actions",
  "app/api",
  "lib/intake",
  "lib/pipeline/steps",
  "lib/analysis/extract",
  "lib/analysis/llm",
  "prisma/schema",
];

const scopedFiles = [];

function collectPageHelpers(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectPageHelpers(fullPath);
      continue;
    }

    if (/page-helpers\.tsx?$/.test(entry.name)) {
      scopedFiles.push(fullPath);
    }
  }
}

function collectFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }

    if (/\.(ts|tsx|prisma)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

function stripDirectives(source) {
  let current = source.trimStart().replace(/^\uFEFF/, "");
  let changed = true;

  while (changed) {
    changed = false;
    const match = current.match(/^(["'])use (client|server)\1;?\s*/u);

    if (match) {
      current = current.slice(match[0].length).trimStart();
      changed = true;
    }
  }

  return current;
}

function hasHeaderComment(filePath, source) {
  const normalized = filePath.endsWith(".prisma")
    ? source.trimStart().replace(/^\uFEFF/, "")
    : stripDirectives(source);

  return normalized.startsWith("/**") || normalized.startsWith("//");
}

const targets = [];
for (const dir of scopedDirs) {
  if (fs.existsSync(path.join(repoRoot, dir))) {
    collectFiles(path.join(repoRoot, dir), targets);
  }
}

collectPageHelpers(path.join(repoRoot, "app/app"));
targets.push(...scopedFiles);

const uniqueTargets = [...new Set(targets)];
const missingHeaders = [];

for (const absolutePath of uniqueTargets) {
  const source = fs.readFileSync(absolutePath, "utf8");
  if (!hasHeaderComment(absolutePath, source)) {
    missingHeaders.push(path.relative(repoRoot, absolutePath));
  }
}

if (missingHeaders.length > 0) {
  console.error("Architecture check failed. Add a short file header comment to:");
  for (const file of missingHeaders) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`Architecture check passed for ${uniqueTargets.length} scoped files.`);
