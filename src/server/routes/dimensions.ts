import { ValidationError } from "../../domain/errors";
import { resolveDimensions } from "../../styles/dimensions";
import { validateResolveDimensionsRequest } from "../validation";

export async function handleDimensionRoute(
  req: Request,
  url: URL,
): Promise<Response | null> {
  const pathname = url.pathname;

  try {
    // POST /api/dimensions/resolve
    if (req.method === "POST" && pathname === "/api/dimensions/resolve") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        throw new ValidationError("Invalid JSON body");
      }

      const valid = validateResolveDimensionsRequest(body);
      const dimensions = resolveDimensions(valid);
      return Response.json({ dimensions });
    }

    return null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof ValidationError ? err.details : undefined;
    return Response.json({ error: message, details }, { status: 400 });
  }
}
