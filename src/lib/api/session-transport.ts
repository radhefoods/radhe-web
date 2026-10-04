import { hasErrorCode, isApiError } from "./errors";
import {
  parseJson,
  send,
  type RequestOptions,
  type Requester,
  type TransportConfig,
} from "./http";

const REFRESH_PATH = "/v1/store/auth/refresh";
const AUTH_PREFIX = "/v1/store/auth/";

export interface SessionTransport {
  /** JSON calls with refresh-and-retry. */
  request: Requester;
  /** The raw answer (for the invoice PDF), with the same session handling. */
  raw: (path: string, options?: RequestOptions) => Promise<Response>;
  /**
   * Asks for a new access cookie. Resolves `true` when the session lives on,
   * `false` when it is over. Calls made at the same time share one request.
   */
  refresh: () => Promise<boolean>;
  /** Called when the session turns out to be over (refresh was refused). */
  onSessionEnded: (listener: () => void) => () => void;
}

/**
 * The browser's way to the API (doc 0.5): cookies travel with every call; on
 * `401 AUTH_TOKEN_INVALID` the refresh endpoint is asked once and the call is
 * repeated; when the refresh is refused the session is over.
 *
 * Refresh tokens rotate, so parallel calls must not each refresh: all calls
 * that fail at the same time wait for one refresh.
 */
export function createSessionTransport(
  config: TransportConfig,
): SessionTransport {
  const transport: TransportConfig = { ...config, credentials: "include" };
  const listeners = new Set<() => void>();
  let refreshing: Promise<boolean> | null = null;

  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        await send(transport, REFRESH_PATH, { method: "POST" });
        return true;
      } catch (error) {
        if (
          hasErrorCode(error, "AUTH_REFRESH_INVALID") ||
          hasErrorCode(error, "CUSTOMER_BLOCKED")
        ) {
          for (const listener of listeners) listener();
          return false;
        }
        // The network failed or the API is down: the session may well be
        // alive. Report the failure of this call, keep the session.
        throw error;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function raw(
    path: string,
    options?: RequestOptions,
  ): Promise<Response> {
    try {
      return await send(transport, path, options);
    } catch (error) {
      const expired =
        isApiError(error) &&
        error.code === "AUTH_TOKEN_INVALID" &&
        !path.startsWith(AUTH_PREFIX);
      if (!expired) throw error;
      const alive = await refresh();
      if (!alive) throw error;
      return send(transport, path, options);
    }
  }

  return {
    raw,
    refresh,
    request: async <T>(path: string, options?: RequestOptions) =>
      parseJson<T>(await raw(path, options)),
    onSessionEnded(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
