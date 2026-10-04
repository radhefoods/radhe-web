import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import { clientMessages, type ClientArea } from "./client-messages";

// A client component can only use the translations that were sent to the
// browser. Which ones are sent depends on the area of the shop the
// component belongs to (`client-messages.ts`). This test reads the source:
// for every client component it collects the namespaces it uses, including
// those of everything it imports, and checks that its area provides them.
// Without it, a forgotten namespace shows up only as a missing text on a
// page nobody looked at.

const SRC = resolve(__dirname, "..");

/** The area a client component is rendered in, by its folder. */
const AREA_OF_FOLDER: Record<string, ClientArea> = {
  "components/account": "account",
  "components/auth": "signIn",
  "components/checkout": "checkout",
  "components/public": "emailLinks",
};

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, found);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) found.push(path);
  }
  return found;
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

interface FileInfo {
  client: boolean;
  namespaces: string[];
  imports: string[];
}

const files = new Map<string, FileInfo>();
for (const file of sourceFiles(SRC)) {
  const text = readFileSync(file, "utf8");
  files.set(file, {
    client: /^"use client"/m.test(text),
    namespaces: [...text.matchAll(/useTranslations\(\s*"(\w+)"\s*\)/g)].map(
      (match) => match[1],
    ),
    imports: [...text.matchAll(/from\s+"([^"]+)"/g)]
      .map((match) => resolveImport(file, match[1]))
      .filter((path): path is string => path !== null),
  });
}

function namespacesOf(file: string, seen = new Set<string>()): Set<string> {
  const result = new Set<string>();
  if (seen.has(file)) return result;
  seen.add(file);
  const info = files.get(file);
  if (!info) return result;
  for (const namespace of info.namespaces) result.add(namespace);
  for (const dependency of info.imports) {
    for (const namespace of namespacesOf(dependency, seen)) {
      result.add(namespace);
    }
  }
  return result;
}

describe("translations sent to the browser", () => {
  it("finds the client components", () => {
    const clients = [...files.values()].filter((info) => info.client);
    expect(clients.length).toBeGreaterThan(30);
  });

  it("cover every namespace a client component uses, in its area", () => {
    const missing: string[] = [];
    for (const [file, info] of files) {
      if (!info.client) continue;
      const path = file.slice(SRC.length + 1).replaceAll("\\", "/");
      const area = AREA_OF_FOLDER[path.split("/").slice(0, 2).join("/")];
      const sent = Object.keys(clientMessages(en, area));
      for (const namespace of namespacesOf(file)) {
        if (!sent.includes(namespace)) {
          missing.push(`${path} uses "${namespace}" (area: ${area ?? "base"})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("sends only the basic namespaces with every page", () => {
    const base = Object.keys(clientMessages(en));
    expect(base).toContain("cart");
    expect(base).not.toContain("orders");
    expect(base).not.toContain("checkout");
    expect(Object.keys(clientMessages(en, "account"))).toContain("orders");
  });
});
