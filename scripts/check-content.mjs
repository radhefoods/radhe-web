// Lists the placeholders (`[[...]]`) that are still open in the content
// files of the shop, for example in the legal notice. Run it before launch:
//
//   npm run check:content
//
// It ends with an error while a placeholder is left.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "content");
const PLACEHOLDER = /\[\[([^\]]+)\]\]/g;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(full) : [full];
    }),
  );
  return nested.flat().filter((file) => file.endsWith(".md"));
}

let open = 0;
for (const file of (await filesIn(ROOT)).sort()) {
  // The comment at the top of a file explains the placeholders: skip it.
  const text = (await readFile(file, "utf8")).replace(/<!--[\s\S]*?-->/g, "");
  const found = [...text.matchAll(PLACEHOLDER)].map((match) => match[1]);
  if (found.length === 0) continue;
  open += found.length;
  console.log(`\n${path.relative(process.cwd(), file)}`);
  for (const placeholder of found) console.log(`  - ${placeholder}`);
}

if (open > 0) {
  console.log(`\n${open} placeholder(s) still to fill in.`);
  process.exit(1);
}
console.log("No placeholders left in the content files.");
