#!/usr/bin/env node
// Product rule guard: certain words must never appear in the app, its prompts, or its tests.
// The word list is assembled from fragments so this file never contains a forbidden word itself.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["client/src", "server/src", "server/tests"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html", ".json", ".md"]);
const FORBIDDEN = [["sub", "ordinate"]].map((parts) => parts.join(""));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if ([...EXTENSIONS].some((ext) => path.endsWith(ext))) out.push(path);
  }
  return out;
}

const hits = [];
for (const root of ROOTS) {
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const file of files) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const word of FORBIDDEN) {
        if (line.toLowerCase().includes(word)) hits.push(`${relative(process.cwd(), file)}:${i + 1}`);
      }
    });
  }
}

if (hits.length) {
  console.error(`Forbidden word found in ${hits.length} place(s):`);
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`Forbidden-word check passed (${ROOTS.join(", ")}).`);
