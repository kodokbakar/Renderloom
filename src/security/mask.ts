export function maskApiKey(key: string): string {
  if (!key || typeof key !== "string") {
    return "";
  }

  const trimmed = key.trim();
  if (trimmed.length === 0) {
    return "";
  }

  if (trimmed.length <= 8) {
    return "***";
  }

  if (trimmed.length <= 12) {
    return `${trimmed.slice(0, 2)}...${trimmed.slice(-2)}`;
  }

  if (trimmed.startsWith("sk-ant-")) {
    return `${trimmed.slice(0, 7)}...${trimmed.slice(-4)}`;
  }

  if (trimmed.startsWith("sk-")) {
    return `${trimmed.slice(0, 3)}...${trimmed.slice(-4)}`;
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}
