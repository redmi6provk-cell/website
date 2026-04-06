function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveAssetUrl(src: string) {
  if (typeof window === "undefined") {
    return src;
  }

  try {
    const parsed = new URL(src);
    if (
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      !isLocalHostname(window.location.hostname)
    ) {
      if (window.location.hostname.includes("vkshivshakti.in")) {
        const baseDomain = window.location.hostname.split(".").slice(-2).join(".");
        parsed.hostname = `api.${baseDomain}`;
        parsed.port = "";
        parsed.protocol = "https:";
      } else {
        parsed.hostname = window.location.hostname;
      }
      return parsed.toString();
    }
  } catch {
    return src;
  }

  return src;
}

export function shouldBypassImageOptimization(src: string) {
  return src.includes("/uploads/") || src.includes("localhost:8081") || src.includes("127.0.0.1:8081");
}
