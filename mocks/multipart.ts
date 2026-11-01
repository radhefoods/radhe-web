// A small reader of `multipart/form-data` bodies, for the photos of a
// problem report (doc 23): the parts between the boundaries, each with its
// headers and its bytes. Enough for what a browser's FormData sends.

export interface MultipartFile {
  field: string;
  filename: string;
  type: string;
  data: Buffer;
}

export interface MultipartBody {
  fields: Record<string, string>;
  files: MultipartFile[];
}

/** The boundary of a `multipart/form-data` content type, or `null`. */
export function boundaryOf(contentType: string | undefined): string | null {
  const match = /^multipart\/form-data;.*boundary=(?:"([^"]+)"|([^;]+))/i.exec(
    contentType ?? "",
  );
  return match ? (match[1] ?? match[2]).trim() : null;
}

function headerValue(headers: string, name: string): string | null {
  const match = new RegExp(`^${name}:\\s*(.+)$`, "im").exec(headers);
  return match ? match[1].trim() : null;
}

function dispositionParam(disposition: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(disposition);
  return match ? match[1] : null;
}

export function parseMultipart(body: Buffer, boundary: string): MultipartBody {
  const result: MultipartBody = { fields: {}, files: [] };
  const delimiter = Buffer.from(`--${boundary}`);
  let position = body.indexOf(delimiter);
  while (position !== -1) {
    const next = body.indexOf(delimiter, position + delimiter.length);
    if (next === -1) break;
    // A part: CRLF, the headers, CRLF CRLF, the bytes, CRLF before the next boundary.
    const part = body.subarray(position + delimiter.length + 2, next - 2);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      position = next;
      continue;
    }
    const headers = part.subarray(0, headerEnd).toString("utf8");
    const data = part.subarray(headerEnd + 4);
    const disposition = headerValue(headers, "Content-Disposition") ?? "";
    const field = dispositionParam(disposition, "name") ?? "";
    const filename = dispositionParam(disposition, "filename");
    if (filename !== null) {
      result.files.push({
        field,
        filename,
        type:
          headerValue(headers, "Content-Type") ?? "application/octet-stream",
        data: Buffer.from(data),
      });
    } else {
      result.fields[field] = data.toString("utf8");
    }
    position = next;
  }
  return result;
}
