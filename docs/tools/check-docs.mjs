// Checks the documents in `docs/` against the code. Reads only; no
// dependencies. The rules are in docs/development/documentation-standard.md.
//
//   node docs/tools/check-docs.mjs            verify; exit code 1 on a problem
//   node docs/tools/check-docs.mjs routes     every page with its addresses
//   node docs/tools/check-docs.mjs endpoints  every endpoint the client names
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS = join(ROOT, "docs");
const slash = (path) => path.split("\\").join("/");
const fromRoot = (path) => slash(relative(ROOT, path));
const read = (path) => readFileSync(path, "utf8");

/** Every file under a folder, as absolute paths. */
function walk(folder, keep = () => true) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : walk(path, keep);
    }
    return keep(path) ? [path] : [];
  });
}

// Kept as they were written: copies of the backend's documents, carried-out
// plans, and the log of decisions with the paths of its day.
const KEPT_AS_WRITTEN = [
  "docs/archive/",
  "docs/reference/backend/",
  "docs/decisions/decision-log.md",
];
const isKept = (file) =>
  KEPT_AS_WRITTEN.some((prefix) => fromRoot(file).startsWith(prefix));
// The indexes of those folders are written today and are checked, but they
// are where the old names are mapped to the new ones.
const isLiving = (file) => !isKept(file) || fromRoot(file).endsWith("/README.md");

/** A document without its code blocks: links and paths in them are examples. */
function prose(text) {
  return text.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, "");
}

/** The anchors of a document's headings, as GitHub makes them. */
function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();
  for (const line of prose(text).split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const base = heading[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[`*_]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

const address = (locale, path) => `/${locale}${path === "/" ? "" : path}`;

/** The pages and handlers of `src/app`, with their localised addresses. */
function routes() {
  const routing = read(join(ROOT, "src/i18n/routing.ts"));
  const localised = new Map();
  for (const match of routing.matchAll(
    /"(\/[^"]*)":\s*(?:\{\s*en:\s*"([^"]*)",\s*de:\s*"([^"]*)"\s*,?\s*\}|"([^"]*)")/g,
  )) {
    localised.set(match[1], {
      en: match[2] ?? match[4],
      de: match[3] ?? match[4],
    });
  }
  const names = /[\\/](page\.tsx|route\.ts|sitemap\.ts|robots\.ts|manifest\.ts)$/;
  return walk(join(ROOT, "src/app"), (path) => names.test(path))
    .map((path) => {
      const file = fromRoot(path);
      const inApp = file.slice("src/app/".length);
      const parts = inApp.split("/").slice(0, -1);
      const isPage = inApp.endsWith("page.tsx");
      const underLocale = parts[0] === "[locale]";
      const internal =
        "/" +
        parts
          .slice(underLocale ? 1 : 0)
          .filter((part) => !/^\(.*\)$/.test(part))
          .join("/");
      const paths = localised.get(internal);
      return {
        file,
        key: inApp,
        en: isPage && underLocale ? address("en", paths?.en ?? internal) : "",
        de: isPage && underLocale ? address("de", paths?.de ?? internal) : "",
        internal,
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

/** `${…}` of the code and `{name}` of a document become the same mark. */
const endpointShape = (path) =>
  path
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/[.,;:)]+$/, "")
    .replace(/\/$/, "");

/** Every `/v1/…` path the API client names. */
function endpoints() {
  const found = new Map();
  const files = walk(
    join(ROOT, "src/lib/api"),
    (path) => /\.ts$/.test(path) && !/\.test\.ts$/.test(path),
  );
  for (const file of files) {
    if (fromRoot(file).endsWith("types.ts")) continue;
    for (const match of read(file).matchAll(
      /[`"'](\/v1\/(?:\$\{[^}]*\}|[^`"'?\s$])*)/g,
    )) {
      const shape = endpointShape(match[1]);
      if (!found.has(shape)) found.set(shape, fromRoot(file));
    }
  }
  return found;
}

function environmentVariables() {
  const files = [
    ...walk(join(ROOT, "src"), (path) => /\.(ts|tsx)$/.test(path)),
    ...walk(join(ROOT, "scripts")),
    ...walk(join(ROOT, "mocks"), (path) => /\.ts$/.test(path)),
    join(ROOT, "next.config.ts"),
    join(ROOT, "playwright.config.ts"),
  ].filter((path) => existsSync(path) && !/\.test\.tsx?$/.test(path));
  const names = new Map();
  for (const file of files) {
    for (const match of read(file).matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      if (!names.has(match[1])) names.set(match[1], fromRoot(file));
    }
  }
  const example = join(ROOT, ".env.example");
  if (existsSync(example)) {
    for (const match of read(example).matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)) {
      if (!names.has(match[1])) names.set(match[1], ".env.example");
    }
  }
  return names;
}

const command = process.argv[2];

if (command === "routes") {
  console.log("| File | English | German |\n| --- | --- | --- |");
  for (const route of routes()) {
    console.log(
      `| \`${route.file}\` | ${route.en ? `\`${route.en}\`` : "–"} | ${route.de ? `\`${route.de}\`` : "–"} |`,
    );
  }
  process.exit(0);
}

if (command === "endpoints") {
  console.log("| Path | First named in |\n| --- | --- |");
  for (const [path, file] of [...endpoints()].sort()) {
    console.log(`| \`${path}\` | \`${file}\` |`);
  }
  process.exit(0);
}

// ---- verify ------------------------------------------------------------------

const problems = [];
const problem = (file, text) => problems.push(`${fromRoot(file)}: ${text}`);

const documents = walk(DOCS, (path) => path.endsWith(".md"));
const texts = new Map(documents.map((file) => [file, read(file)]));
const anchors = new Map();
const anchorsIn = (file) => {
  if (!anchors.has(file)) anchors.set(file, anchorsOf(texts.get(file) ?? read(file)));
  return anchors.get(file);
};

// Links, and the documents reachable from the index.
const linked = new Map(documents.map((file) => [file, new Set()]));
for (const file of documents) {
  const living = isLiving(file);
  for (const match of prose(texts.get(file)).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [path, anchor] = target.split("#");
    const to = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
    if (!existsSync(to)) {
      if (living) problem(file, `link to a file that does not exist: ${target}`);
      continue;
    }
    const index = statSync(to).isDirectory() ? join(to, "README.md") : to;
    if (texts.has(index)) linked.get(file).add(index);
    if (anchor && living && texts.has(index) && !anchorsIn(index).has(anchor)) {
      problem(file, `link to a heading that does not exist: ${target}`);
    }
  }
}
const index = join(DOCS, "README.md");
if (!texts.has(index)) problem(index, "the index of the documentation is missing");
const reached = new Set([index]);
for (const queue = [index]; queue.length > 0; ) {
  for (const next of linked.get(queue.pop()) ?? []) {
    if (!reached.has(next)) {
      reached.add(next);
      queue.push(next);
    }
  }
}
for (const file of documents) {
  if (!reached.has(file)) problem(file, "not reachable from docs/README.md");
}

// Paths in backticks, and old names.
const PATH = /`((?:src|e2e|mocks|messages|scripts|public|content|docs)\/[^`\s]*)`/g;
for (const file of documents.filter(isLiving)) {
  const text = prose(texts.get(file));
  for (const match of text.matchAll(PATH)) {
    const written = match[1];
    if (/[*<>{}…|]|\.\.\./.test(written)) continue;
    const path = written.replace(/[.,;:]+$/, "").replace(/:\d+(-\d+)?$/, "");
    if (!existsSync(join(ROOT, path))) {
      problem(file, `names a path that does not exist: ${written}`);
    }
  }
  if (isKept(file)) continue;
  for (const match of text.matchAll(/(?<![\w/.-])doc\/[A-Za-z_]+\.md/g)) {
    problem(file, `names an old path: ${match[0]}`);
  }
}

// Every feature document says its state.
const STATUS = /\|\s*\*\*Status\*\*\s*\|\s*\**(Implemented|Partially implemented|Planned|Deprecated)\b/;
for (const file of documents) {
  const name = fromRoot(file);
  if (!name.startsWith("docs/features/") || name.endsWith("README.md")) continue;
  if (!STATUS.test(texts.get(file))) {
    problem(file, "has no Status of the four in its header");
  }
}

const textOf = (name) => texts.get(join(DOCS, name)) ?? "";

// Every page is in the list of routes.
const routing = textOf("architecture/routing.md");
for (const route of routes()) {
  const short = route.key.replace(/^\[locale\]\//, "");
  if (!routing.includes(route.file) && !routing.includes(short)) {
    problem(join(DOCS, "architecture/routing.md"), `does not list ${route.file}`);
  }
}

// Every endpoint of the client is in the list of endpoints.
const documented = new Set(
  [...textOf("api/endpoints.md").matchAll(/\/v1\/[^\s`|)]*/g)].map((match) =>
    endpointShape(match[0]),
  ),
);
for (const [path, file] of endpoints()) {
  // A prefix the client compares addresses with is not a call.
  if (path.endsWith("/auth")) continue;
  if (!documented.has(path)) {
    problem(join(DOCS, "api/endpoints.md"), `does not list ${path} (${file})`);
  }
}

// Every environment variable is explained.
const configuration = textOf("architecture/configuration.md");
for (const [name, file] of environmentVariables()) {
  if (!configuration.includes(`\`${name}\``)) {
    problem(
      join(DOCS, "architecture/configuration.md"),
      `does not explain ${name} (${file})`,
    );
  }
}

// Every area of the code is in a document.
const living = documents.filter(isLiving).map((file) => texts.get(file)).join("\n");
for (const parent of ["src/components", "src/features", "src/lib"]) {
  for (const entry of readdirSync(join(ROOT, parent), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = `${parent}/${entry.name}`;
    if (!living.includes(folder)) {
      problem(DOCS, `no document names the folder ${folder}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s) in ${documents.length} documents.`);
  process.exit(1);
}
console.log(
  `${documents.length} documents, ${routes().length} routes, ${endpoints().size} endpoints, ${environmentVariables().size} variables: no problems.`,
);
