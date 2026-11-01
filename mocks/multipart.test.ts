import { describe, expect, it } from "vitest";
import { boundaryOf, parseMultipart } from "./multipart.ts";

describe("multipart bodies", () => {
  it("reads the boundary of the content type", () => {
    expect(boundaryOf("multipart/form-data; boundary=----abc123")).toBe(
      "----abc123",
    );
    expect(boundaryOf('multipart/form-data; boundary="quoted bound"')).toBe(
      "quoted bound",
    );
    expect(boundaryOf("application/json")).toBeNull();
    expect(boundaryOf(undefined)).toBeNull();
  });

  it("splits the parts into fields and files with their bytes", () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="note"\r\n\r\nhello\r\n--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="b.jpg"\r\nContent-Type: image/jpeg\r\n\r\nJPEGDATA\r\n--${boundary}--\r\n`,
      ),
    ]);
    const parsed = parseMultipart(body, boundary);
    expect(parsed.fields).toEqual({ note: "hello" });
    expect(parsed.files.map((f) => [f.field, f.filename, f.type])).toEqual([
      ["files", "a.png", "image/png"],
      ["files", "b.jpg", "image/jpeg"],
    ]);
    expect(parsed.files[0].data.equals(png)).toBe(true);
    expect(parsed.files[1].data.toString()).toBe("JPEGDATA");
  });

  it("reads what the platform's FormData sends", async () => {
    const form = new FormData();
    form.append(
      "files",
      new Blob([Buffer.from("WEBP")], { type: "image/webp" }),
      "c.webp",
    );
    const request = new Request("http://localhost/", {
      method: "POST",
      body: form,
    });
    const boundary = boundaryOf(
      request.headers.get("content-type") ?? undefined,
    )!;
    const parsed = parseMultipart(
      Buffer.from(await request.arrayBuffer()),
      boundary,
    );
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      filename: "c.webp",
      type: "image/webp",
    });
    expect(parsed.files[0].data.toString()).toBe("WEBP");
  });
});
