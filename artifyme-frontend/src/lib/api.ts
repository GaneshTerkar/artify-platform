const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function getToken(): string | null {
  return localStorage.getItem("artify_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("artify_refresh_token");
}

export function setTokens(token: string, refreshToken?: string) {
  localStorage.setItem("artify_token", token);
  if (refreshToken) {
    localStorage.setItem("artify_refresh_token", refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem("artify_token");
  localStorage.removeItem("artify_refresh_token");
  localStorage.removeItem("artify_user");
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem("artify_device_id");
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "dev-" + Math.random().toString(36).substring(2, 12) + "-" + Date.now().toString(36);
    localStorage.setItem("artify_device_id", deviceId);
  }
  return deviceId;
}

export function getDeviceInfo(): { device_id: string; device_name: string; device_type: string } {
  const device_id = getDeviceId();
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let device_type = "DESKTOP";
  if (/mobile|android|iphone|ipod/i.test(ua)) {
    device_type = "MOBILE";
  } else if (/ipad|tablet/i.test(ua)) {
    device_type = "TABLET";
  }

  let browser = "Browser";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edg")) browser = "Edge";

  let os = "Desktop";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone")) os = "iOS";

  return {
    device_id,
    device_name: `${browser} on ${os}`,
    device_type,
  };
}

let refreshPromise: Promise<string | null> | null = null;

async function executeRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("artify:session_expired"));
      }
      return null;
    }

    const data = await res.json();
    const newToken = data.token || data.Token;
    const newRefreshToken = data.refresh_token || data.RefreshToken;
    if (newToken) {
      setTokens(newToken, newRefreshToken);
      return newToken;
    }

    clearTokens();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("artify:session_expired"));
    }
    return null;
  } catch {
    clearTokens();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("artify:session_expired"));
    }
    return null;
  } finally {
    refreshPromise = null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Handle 401 Unauthorized with token refresh rotation
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (!refreshPromise) {
      refreshPromise = executeRefreshToken();
    }
    const refreshedToken = await refreshPromise;
    if (refreshedToken) {
      headers.set("Authorization", `Bearer ${refreshedToken}`);
      const retryRes = await fetch(`${API_URL}${path}`, { ...options, headers });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new Error(err.error ?? retryRes.statusText);
      }
      return retryRes.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function uploadFile(
  file: File,
): Promise<{ url: string; filename: string; size: number }> {
  const formData = new FormData();
  formData.append("file", file);
  return api<{ url: string; filename: string; size: number }>("/api/v1/upload", {
    method: "POST",
    body: formData,
  });
}

export { API_URL };
