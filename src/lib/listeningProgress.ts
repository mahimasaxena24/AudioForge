export interface ChapterProgress {
  listenedSeconds: number;
  totalSeconds: number;
}

export type ProgressStore = Record<string, Record<string, ChapterProgress>>;

const STORAGE_KEY = "bookListeningProgress";

export function parseDurationToSeconds(duration?: string | null): number {
  if (!duration) return 0;
  const parts = duration.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

export function loadProgress(): ProgressStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ProgressStore;
  } catch {
    return {};
  }
}

export function saveProgress(store: ProgressStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

export function updateChapterProgress(
  bookId: string,
  chapterId: string,
  listenedSeconds: number,
  totalSeconds: number,
): ProgressStore {
  const store = loadProgress();
  const bookProgress = store[bookId] || {};
  const existing = bookProgress[chapterId];

  const safeTotal = totalSeconds || existing?.totalSeconds || listenedSeconds;
  const safeListened = Math.max(listenedSeconds, existing?.listenedSeconds || 0);

  bookProgress[chapterId] = {
    listenedSeconds: Math.min(safeListened, safeTotal),
    totalSeconds: safeTotal,
  };

  store[bookId] = bookProgress;
  saveProgress(store);
  return store;
}

export function getBookProgressPercent(store: ProgressStore, bookId: string): number {
  const bookProgress = store[bookId];
  if (!bookProgress) return 0;

  let listened = 0;
  let total = 0;

  Object.values(bookProgress).forEach((ch) => {
    listened += Math.min(ch.listenedSeconds, ch.totalSeconds);
    total += ch.totalSeconds;
  });

  if (!total) return 0;
  return Math.round((listened / total) * 100);
}

