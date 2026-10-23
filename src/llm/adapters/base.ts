import { normalizeProviderError } from "../errors";

export type FetchFunction = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  fetchFn?: FetchFunction;
}

export async function executeProviderFetch(
  url: string,
  options: RequestOptions,
  providerId: string,
): Promise<Response> {
  const {
    timeoutMs = 15000,
    fetchFn = globalThis.fetch,
    ...fetchInit
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Request timed out"));
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(url, {
      ...fetchInit,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw normalizeProviderError(err, providerId);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorPayload: unknown;
    let errorMessage: string | undefined;

    try {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await response.json();
        errorPayload = json;
        if (json && typeof json === "object") {
          const errObj = (json as Record<string, unknown>).error;
          if (errObj && typeof errObj === "object") {
            errorMessage =
              typeof (errObj as Record<string, unknown>).message === "string"
                ? ((errObj as Record<string, unknown>).message as string)
                : undefined;
          } else if (typeof errObj === "string") {
            errorMessage = errObj;
          }
        }
      } else {
        const text = await response.text();
        errorPayload = text;
        errorMessage = text ? text.slice(0, 300) : undefined;
      }
    } catch {
      // Ignore body read errors
    }

    throw normalizeProviderError(
      {
        status: response.status,
        message: errorMessage,
        details: errorPayload,
      },
      providerId,
    );
  }

  return response;
}
