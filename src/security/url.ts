import { ValidationError } from "../domain/errors";

const CLOUD_METADATA_HOSTS: Record<string, true> = {
  "169.254.169.254": true,
  "metadata.google.internal": true,
  "metadata.google": true,
  "100.100.100.200": true,
  metadata: true,
};

function isPrivateIp(hostname: string): boolean {
  // Check IPv4 link-local (169.254.0.0/16)
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  // Check 10.0.0.0/8
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  // Check 172.16.0.0/12 (172.16 - 172.31)
  const match172 = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = Number(match172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }

  // Check 192.168.0.0/16
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  return false;
}

function isLoopback(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("127.")
  );
}

export function validateBaseUrl(url: string, allowCustom = false): string {
  if (!url || typeof url !== "string") {
    throw new ValidationError("Base URL must be a non-empty string");
  }

  const trimmed = url.trim();

  // Check for path traversal in raw string before URL parsing normalization
  if (
    trimmed.includes("/../") ||
    trimmed.endsWith("/..") ||
    trimmed.includes("/..?") ||
    trimmed.includes("/..#") ||
    trimmed.toLowerCase().includes("%2e%2e")
  ) {
    throw new ValidationError(
      "Custom base URL must not contain path traversal",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new ValidationError("Invalid base URL format");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: are allowed`,
    );
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError("Custom base URL must not contain credentials");
  }

  const hostname = parsed.hostname.toLowerCase();
  const unbracketedHost = hostname.replace(/^\[|\]$/g, "");

  // Cloud metadata protection (always forbidden)
  if (
    CLOUD_METADATA_HOSTS[hostname] ||
    CLOUD_METADATA_HOSTS[unbracketedHost] ||
    hostname.endsWith(".metadata.google.internal") ||
    unbracketedHost === "fd00:ec2::254" ||
    unbracketedHost.startsWith("169.254.")
  ) {
    throw new ValidationError(
      "Access to cloud metadata endpoints is forbidden",
    );
  }

  // Check loopback and private networks
  const loopback = isLoopback(hostname);
  const privateIp = isPrivateIp(hostname);

  if (!allowCustom) {
    if (loopback || privateIp) {
      throw new ValidationError(
        `Local or private network host '${hostname}' is not allowed`,
      );
    }
  }

  // Traversal check on parsed pathname segments
  const segments = parsed.pathname.split("/");
  if (segments.includes("..")) {
    throw new ValidationError(
      "Custom base URL must not contain path traversal",
    );
  }

  // Construct sanitized URL string without trailing slash
  let result = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  if (result.endsWith("/") && parsed.pathname !== "/") {
    result = result.replace(/\/+$/, "");
  } else if (result.endsWith("/") && parsed.pathname === "/") {
    result = `${parsed.protocol}//${parsed.host}`;
  }

  if (parsed.search) {
    result += parsed.search;
  }

  return result;
}
