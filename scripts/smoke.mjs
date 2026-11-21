// Starts the built shop the way a host does and asks it for a handful of
// pages: the check that a build is fit for production, on either host.
//
//   npm run build && npm run smoke
//       the ordinary build, started with `next start` (what Vercel builds)
//
//   NEXT_OUTPUT=standalone npm run build:webpack && npm run smoke -- --standalone
//       the standalone server, built with webpack (what Hostinger builds
//       and starts)
//
// The mock API is started next to the shop, on ports of their own
// (`SMOKE_API_PORT`, `SMOKE_PORT`), so a shop in development on 3000/3001
// is left alone. Nothing here reaches the real API.

import { spawn } from "node:child_process";
import { cp } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standalone = process.argv.includes("--standalone");
const apiPort = Number(process.env.SMOKE_API_PORT || 3100);
const port = Number(process.env.SMOKE_PORT || 3101);
const apiUrl = `http://127.0.0.1:${apiPort}`;

/** The address the build was made for, read the way `src/config/env.ts` does. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "")
  .trim()
  .replace(
    /^https?:\/\/(?:www\.)?radhefoods\.de(?=$|[/?#])/i,
    "https://www.radhefoods.de",
  );

const children = [];

function start(name, args, options) {
  const child = spawn(process.execPath, args, {
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  child.log = "";
  const keep = (chunk) => {
    child.log = (child.log + chunk).slice(-4000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.on("exit", (code) => {
    child.exited = code ?? 1;
  });
  child.label = name;
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) child.kill();
}

/** One request to the shop; redirects are not followed. */
function get(pathname, { host, base = `http://127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      base + pathname,
      { headers: host ? { Host: host } : {}, timeout: 30_000 },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
      },
    );
    request.on("timeout", () => request.destroy(new Error("timed out")));
    request.on("error", reject);
  });
}

async function waitFor(child, pathname, base) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exited !== undefined) {
      throw new Error(
        `${child.label} stopped (code ${child.exited}):\n${child.log}`,
      );
    }
    try {
      const { status } = await get(pathname, { base });
      if (status === 200) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${child.label} did not answer in time:\n${child.log}`);
}

const results = [];

async function check(name, run) {
  try {
    const note = await run();
    results.push({ name, ok: true, note });
  } catch (error) {
    results.push({ name, ok: false, note: error.message });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const mock = start(
    "mock API",
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "mocks/server.ts"],
    { cwd: root, env: { ...process.env, MOCK_PORT: String(apiPort) } },
  );
  await waitFor(mock, "/health/live", apiUrl);

  // The server reads this address when it runs: no rebuild is needed to
  // point a built shop at another API.
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    API_INTERNAL_URL: apiUrl,
  };
  let shop;
  if (standalone) {
    // The standalone folder holds the server and its modules; the files
    // of `public` and the built scripts and styles are put next to it, as
    // the host does.
    const folder = path.join(root, ".next", "standalone");
    await cp(path.join(root, "public"), path.join(folder, "public"), {
      recursive: true,
    });
    await cp(
      path.join(root, ".next", "static"),
      path.join(folder, ".next", "static"),
      { recursive: true },
    );
    shop = start("standalone server", ["server.js"], { cwd: folder, env });
  } else {
    shop = start(
      "next start",
      [
        path.join("node_modules", "next", "dist", "bin", "next"),
        "start",
        "--port",
        String(port),
        "--hostname",
        "127.0.0.1",
      ],
      { cwd: root, env },
    );
  }
  await waitFor(shop, "/api/health");

  await check("/api/health answers and is not kept", async () => {
    const { status, headers, body } = await get("/api/health");
    expect(status === 200, `status ${status}`);
    expect(JSON.parse(body).status === "ok", `body ${body}`);
    expect(headers["cache-control"] === "no-store", "cache-control");
  });

  await check("/ leads to a language", async () => {
    const { status, headers } = await get("/");
    expect(status === 307 || status === 308, `status ${status}`);
    expect(/\/(en|de)$/.test(headers.location ?? ""), headers.location);
    return `${status} ${headers.location}`;
  });

  let home = "";
  await check("/en renders with the security headers", async () => {
    const { status, headers, body } = await get("/en");
    expect(status === 200, `status ${status}`);
    expect(body.includes('<html lang="en"'), "no <html lang>");
    expect(headers["content-security-policy"], "no CSP");
    expect(headers["strict-transport-security"], "no HSTS");
    expect(headers["x-powered-by"] === undefined, "x-powered-by is sent");
    home = body;
  });

  await check("/de renders", async () => {
    const { status, body } = await get("/de");
    expect(status === 200, `status ${status}`);
    expect(body.includes('<html lang="de"'), "no <html lang>");
  });

  await check("a built style sheet is served for good", async () => {
    const file = /\/_next\/static\/[^"']+\.css/.exec(home)?.[0];
    expect(file, "no style sheet in the home page");
    const { status, headers } = await get(file);
    expect(status === 200, `status ${status} for ${file}`);
    expect(
      /immutable/.test(headers["cache-control"] ?? ""),
      `cache-control ${headers["cache-control"]}`,
    );
  });

  await check("a file of public/ is served", async () => {
    const { status } = await get("/brand/radhe-logo-240.webp");
    expect(status === 200, `status ${status}`);
  });

  await check("the product list renders from the API", async () => {
    const { status, body } = await get("/en/products");
    expect(status === 200, `status ${status}`);
    expect(body.includes("/en/products/"), "no product link in the list");
  });

  await check("a product page is rendered once, then kept", async () => {
    const list = await get("/v1/store/products?limit=1&locale=en", {
      base: apiUrl,
    });
    const product = JSON.parse(list.body).items[0];
    const slug = product.variants?.[0]?.slug ?? product.slug;
    const first = await get(`/en/products/${slug}`);
    expect(first.status === 200, `status ${first.status} for ${slug}`);
    const second = await get(`/en/products/${slug}`);
    const kept = second.headers["x-nextjs-cache"];
    expect(kept === "HIT" || kept === "STALE", `x-nextjs-cache ${kept}`);
    expect(
      /s-maxage=300/.test(second.headers["cache-control"] ?? ""),
      `cache-control ${second.headers["cache-control"]}`,
    );
    return `${slug}: ${first.headers["x-nextjs-cache"]} then ${kept}`;
  });

  await check("a legal text is read from content/", async () => {
    const { status, body } = await get("/en/legal/cookies");
    expect(status === 200, `status ${status}`);
    expect(/cookie/i.test(body), "no text");
  });

  await check("robots.txt names the sitemap", async () => {
    const { status, body } = await get("/robots.txt");
    expect(status === 200, `status ${status}`);
    expect(/^Sitemap: .+\/sitemap\.xml$/m.test(body), body);
  });

  await check("sitemap.xml lists the shop", async () => {
    const { status, body } = await get("/sitemap.xml");
    expect(status === 200, `status ${status}`);
    expect(body.includes("<urlset"), "no <urlset>");
    expect(body.includes("/en/products/"), "no product in the sitemap");
  });

  await check("a page that does not exist answers 404", async () => {
    const { status } = await get("/en/no-such-page");
    expect(status === 404, `status ${status}`);
  });

  await check("the bare domain leads to www", async () => {
    let site;
    try {
      site = new URL(siteUrl);
    } catch {
      return "skipped: NEXT_PUBLIC_SITE_URL is not set";
    }
    if (site.protocol !== "https:" || !site.hostname.startsWith("www.")) {
      return `skipped: ${site.origin} is not a www address`;
    }
    const bare = site.hostname.slice(4);
    const moved = await get("/en/cart?from=smoke", { host: bare });
    expect(moved.status === 308, `status ${moved.status} for ${bare}`);
    expect(
      moved.headers.location === `${site.origin}/en/cart?from=smoke`,
      `location ${moved.headers.location}`,
    );
    const stays = await get("/en", { host: site.hostname });
    expect(stays.status === 200, `status ${stays.status} for www`);
    return `${bare} → ${moved.headers.location}`;
  });
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error.message);
} finally {
  stopAll();
}

for (const { name, ok, note } of results) {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${note ? `  (${note})` : ""}`);
}
if (failed || results.some((result) => !result.ok)) {
  console.error(
    `\nThe ${standalone ? "standalone server" : "shop"} is not fit to deploy.`,
  );
  process.exit(1);
}
console.log(
  `\n${results.length} checks passed against the ${standalone ? "standalone server" : "next start server"}.`,
);
process.exit(0);
