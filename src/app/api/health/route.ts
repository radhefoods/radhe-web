// `GET /api/health`: answers as soon as the shop's server runs. It asks the
// API for nothing and renders no page, so it is the address for an uptime
// monitor, for the timer that keeps the process awake on a host that stops
// idle apps (Hostinger), and for the check after a deployment or a change
// of host (`doc/DEPLOYMENT.md`).
//
// Answered at every request and kept by nobody: a copy from a cache would
// say "ok" for a server that is down.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
