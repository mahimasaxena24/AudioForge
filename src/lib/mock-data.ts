export interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  uploadDate: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  progress: number;
  coverColor: string;
  chapters: Chapter[];
  totalDuration?: string;
  fileSize?: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  duration: string;
  status: "pending" | "processing" | "completed" | "failed";
}

export const mockBooks: Book[] = [
  {
    id: "1",
    title: "The Art of Modern Architecture",
    author: "Dr. Sarah Mitchell",
    language: "English",
    uploadDate: "2026-03-08",
    status: "completed",
    progress: 100,
    coverColor: "gradient-primary",
    totalDuration: "4h 32m",
    fileSize: "342 MB",
    chapters: [
      { id: "1-1", bookId: "1", title: "Chapter 1: Foundations", duration: "28:15", status: "completed" },
      { id: "1-2", bookId: "1", title: "Chapter 2: Materials", duration: "35:42", status: "completed" },
      { id: "1-3", bookId: "1", title: "Chapter 3: Form & Function", duration: "41:08", status: "completed" },
      { id: "1-4", bookId: "1", title: "Chapter 4: Urban Design", duration: "33:55", status: "completed" },
      { id: "1-5", bookId: "1", title: "Chapter 5: Sustainability", duration: "29:30", status: "completed" },
    ],
  },
  {
    id: "2",
    title: "Digital Governance Handbook",
    author: "Ministry of IT",
    language: "English",
    uploadDate: "2026-03-07",
    status: "processing",
    progress: 67,
    coverColor: "gradient-accent",
    chapters: [
      { id: "2-1", bookId: "2", title: "Chapter 1: Introduction", duration: "22:10", status: "completed" },
      { id: "2-2", bookId: "2", title: "Chapter 2: E-Services", duration: "38:45", status: "completed" },
      { id: "2-3", bookId: "2", title: "Chapter 3: Data Privacy", duration: "--:--", status: "processing" },
      { id: "2-4", bookId: "2", title: "Chapter 4: Infrastructure", duration: "--:--", status: "pending" },
    ],
  },
  {
    id: "3",
    title: "History of Ancient Civilizations",
    author: "Prof. James Chen",
    language: "English",
    uploadDate: "2026-03-06",
    status: "completed",
    progress: 100,
    coverColor: "gradient-warm",
    totalDuration: "6h 15m",
    fileSize: "498 MB",
    chapters: [
      { id: "3-1", bookId: "3", title: "Chapter 1: Mesopotamia", duration: "45:20", status: "completed" },
      { id: "3-2", bookId: "3", title: "Chapter 2: Egypt", duration: "52:11", status: "completed" },
      { id: "3-3", bookId: "3", title: "Chapter 3: Indus Valley", duration: "38:45", status: "completed" },
    ],
  },
  {
    id: "4",
    title: "Public Health Policy Guide",
    author: "WHO Research Team",
    language: "English",
    uploadDate: "2026-03-05",
    status: "uploaded",
    progress: 0,
    coverColor: "gradient-primary",
    chapters: [],
  },
  {
    id: "5",
    title: "Introduction to Machine Learning",
    author: "Dr. Aisha Patel",
    language: "English",
    uploadDate: "2026-03-04",
    status: "failed",
    progress: 34,
    coverColor: "gradient-accent",
    chapters: [
      { id: "5-1", bookId: "5", title: "Chapter 1: Basics of ML", duration: "30:00", status: "completed" },
      { id: "5-2", bookId: "5", title: "Chapter 2: Neural Networks", duration: "--:--", status: "failed" },
    ],
  },
];

export const stats = {
  totalBooks: 127,
  completedAudiobooks: 98,
  inProgress: 12,
  totalListeningHours: 534,
};
