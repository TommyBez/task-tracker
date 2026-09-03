import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const root = process.cwd();
const recommendedMaximum = 300;
const hardMaximum = 400;

const excludedDirectories = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".git",
  ".native",
  ".next",
  ".turbo",
  ".venv",
  ".zig-cache",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor",
  "zig-out",
]);

const excludedFiles = new Set([
  "bun.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const binaryExtensions = new Set([
  ".avif", ".bmp", ".gif", ".gz", ".icns", ".ico", ".jpeg", ".jpg",
  ".mov", ".mp3", ".mp4", ".pdf", ".png", ".ttf", ".wav", ".webm",
  ".webp", ".woff", ".woff2", ".zip",
]);

const files = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    if (excludedFiles.has(entry.name)) continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(path);
    else if (entry.isFile() && !binaryExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
  }
}

function lineCount(source) {
  if (source.length === 0) return 0;
  let count = 1;
  for (const byte of source) {
    if (byte === 10) count += 1;
  }
  return source[source.length - 1] === 10 ? count - 1 : count;
}

function displayPath(path) {
  return relative(root, path).split(sep).join("/");
}

await collectFiles(root);

const results = [];
for (const path of files) {
  const source = await readFile(path);
  if (source.includes(0)) continue;
  results.push({ path: displayPath(path), lines: lineCount(source) });
}

const warnings = results.filter((result) => result.lines > recommendedMaximum);
warnings.sort((left, right) => right.lines - left.lines || left.path.localeCompare(right.path));

if (warnings.length === 0) {
  console.log(`Line count check passed: every authored text file is at or below ${recommendedMaximum} lines.`);
} else {
  console.warn(`Files above the recommended ${recommendedMaximum}-line maximum:`);
  for (const result of warnings) console.warn(`  ${result.lines}  ${result.path}`);
}

const failures = warnings.filter((result) => result.lines > hardMaximum);
if (failures.length > 0) {
  console.error(`Line count check failed: ${failures.length} file(s) exceed the hard ${hardMaximum}-line maximum.`);
  process.exitCode = 1;
}
