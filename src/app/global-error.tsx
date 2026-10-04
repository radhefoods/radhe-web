"use client";

// The last resort: shown when the frame of the shop itself fails, so no
// layout, no translations and no style sheet can be relied on. Both
// languages on one plain page, and one button to try again. Errors of a
// single page never get here: they are caught by the `error.tsx` files.

const box = {
  maxWidth: "32rem",
  margin: "0 auto",
  padding: "4rem 1.5rem",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  color: "#0a1d5c",
  lineHeight: 1.5,
  textAlign: "center",
} as const;

const button = {
  marginTop: "1.5rem",
  minHeight: "3rem",
  padding: "0 1.5rem",
  border: 0,
  borderRadius: "10px",
  background: "#1a45cc",
  color: "#ffffff",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <title>Radhe Foods</title>
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ margin: 0, background: "#ffffff" }}>
        <main style={box}>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Radhe Foods</h1>
          <p lang="en">
            The shop could not be loaded. Please try again in a moment.
          </p>
          <p lang="de">
            Der Shop konnte nicht geladen werden. Bitte versuchen Sie es gleich
            noch einmal.
          </p>
          <button type="button" style={button} onClick={reset}>
            Try again / Erneut versuchen
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.875rem" }}>
              Reference / Referenz: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
