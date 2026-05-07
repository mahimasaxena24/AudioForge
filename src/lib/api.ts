const API_BASE = import.meta.env.VITE_API_URL || "/api";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const TOKEN_KEY = "audioforge-token";

export type UserRole = "admin" | "user";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at?: string | null;
  created_by_admin?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type DbBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  status: string;
  progress: number;
  extracted_text: string | null;
  file_path: string | null;
  total_duration: string | null;
  file_size: string | null;
  voice_id?: string | null;
  voice_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type DbChapter = {
  id: string;
  book_id: string;
  title: string;
  text_content: string | null;
  audio_path: string | null;
  duration: string | null;
  status: string;
  chapter_order: number;
  created_at: string;
};

export type VoiceOption = {
  voice_id: string;
  name: string;
  preview_url?: string | null;
  category?: string | null;
};

export type DashboardSummary = {
  total_books: number;
  completed_books: number;
  processing_books: number;
  queued_books: number;
  uploaded_books: number;
  failed_books: number;
  queue_count: number;
  recent_books: DbBook[];
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
};

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, useAuth = true): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (useAuth) {
    const token = getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : payload?.detail?.message || payload?.detail || payload?.error || "Request failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload as T;
}

export async function loginRequest(email: string, password: string) {
  return request<LoginResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );
}

export async function fetchCurrentUser() {
  return request<AuthUser>("/auth/me");
}

export async function fetchDashboardSummary() {
  return request<DashboardSummary>("/dashboard/summary");
}

export async function fetchBooks() {
  return request<DbBook[]>("/books");
}

export async function fetchBookWithChapters(bookId: string) {
  return request<{ book: DbBook; chapters: DbChapter[] }>(`/books/${bookId}`);
}

export async function fetchChapters(bookId: string) {
  return request<DbChapter[]>(`/books/${bookId}/chapters`);
}

export async function fetchVoices() {
  return request<VoiceOption[]>("/voices");
}

export async function uploadBook(file: File, title: string, author: string, voiceId: string, voiceName: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("title", title);
  formData.append("author", author);
  formData.append("voice_id", voiceId);
  formData.append("voice_name", voiceName);

  return request<DbBook>("/books/upload", {
    method: "POST",
    body: formData,
  });
}

export async function deleteBook(bookId: string) {
  return request<void>(`/books/${bookId}`, { method: "DELETE" });
}

export async function fetchUsers() {
  return request<AuthUser[]>("/users");
}

export async function createUser(payload: CreateUserPayload) {
  return request<AuthUser>("/users", {
    method: "POST",
    body: JSON.stringify({ ...payload, role: payload.role || "user" }),
  });
}

export async function deleteUser(userId: string) {
  return request<void>(`/users/${userId}`, { method: "DELETE" });
}

export function getAudioUrl(audioPath: string) {
  if (!SUPABASE_URL) {
    return audioPath;
  }
  return `${SUPABASE_URL}/storage/v1/object/public/audiobooks/${audioPath}`;
}
