const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function getToken(): string | null {
  return localStorage.getItem("artify_token");
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
