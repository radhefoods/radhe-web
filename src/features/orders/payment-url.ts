/**
 * Whether the browser may be sent to this payment page. The address comes
 * from the API (`POST …/checkout`); it must be a secure web address. Plain
 * `http` is accepted for the local machine only, where the mock API plays
 * the payment page during development.
 */
export function isSafePaymentUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  );
}
