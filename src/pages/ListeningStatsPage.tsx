import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DbBook, DbChapter, fetchBooks, fetchChapters } from "@/lib/api";
import {
  loadProgress,
  getBookProgressPercent,
  parseDurationToSeconds,
  updateChapterProgress,
  type ProgressStore,
} from "@/lib/listeningProgress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  BarChart2,
  Play,
  Square,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const ListeningStatsPage = () => {
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
    refetchInterval: 10000,
  });

  // Only show completed books
  const completedBooks = (books || []).filter((b) => b.status === "completed");

  const [progressStore, setProgressStore] = useState<ProgressStore>(() => loadProgress());

  useEffect(() => {
    // keep store in sync with localStorage if needed
    setProgressStore(loadProgress());
  }, []);

  const booksWithProgress = completedBooks.map((b) => ({
    ...b,
    listenedPercent: getBookProgressPercent(progressStore, b.id),
  }));

  const anyCompleted = booksWithProgress.length > 0;

  // Shared audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<{ bookId: string; chapterId: string } | null>(
    null,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeBookRef = useRef<DbBook | null>(null);
  const activeChapterRef = useRef<DbChapter | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncPlaybackState = () => {
      const nextIsPlaying = !audio.paused && !audio.ended;
      const activeBook = activeBookRef.current;
      const activeChapter = activeChapterRef.current;
      const nextTime = audio.currentTime || 0;
      const totalSeconds =
        parseDurationToSeconds(activeChapter?.duration) || audio.duration || nextTime || 0;

      setIsPlaying(nextIsPlaying);
      setCurrentTime(nextTime);
      setDuration(totalSeconds);

      if (activeBook && activeChapter) {
        const updated = updateChapterProgress(
          activeBook.id,
          activeChapter.id,
          nextTime,
          totalSeconds,
        );
        setProgressStore(updated);
      }
    };

    const handleEnded = () => {
      syncPlaybackState();
      setCurrentTime(0);
      setCurrentTrack(null);
    };

    audio.addEventListener("play", syncPlaybackState);
    audio.addEventListener("pause", syncPlaybackState);
    audio.addEventListener("timeupdate", syncPlaybackState);
    audio.addEventListener("loadedmetadata", syncPlaybackState);
    audio.addEventListener("ratechange", syncPlaybackState);
    audio.addEventListener("ended", handleEnded);

    const progressInterval = window.setInterval(() => {
      if (!audio.paused && !audio.ended) {
        syncPlaybackState();
      }
    }, 250);

    document.addEventListener("visibilitychange", syncPlaybackState);
    window.addEventListener("focus", syncPlaybackState);

    return () => {
      audio.removeEventListener("play", syncPlaybackState);
      audio.removeEventListener("pause", syncPlaybackState);
      audio.removeEventListener("timeupdate", syncPlaybackState);
      audio.removeEventListener("loadedmetadata", syncPlaybackState);
      audio.removeEventListener("ratechange", syncPlaybackState);
      audio.removeEventListener("ended", handleEnded);
      window.clearInterval(progressInterval);
      document.removeEventListener("visibilitychange", syncPlaybackState);
      window.removeEventListener("focus", syncPlaybackState);
    };
  }, [currentTrack]);

  const startPlayback = (book: DbBook, chapter: DbChapter) => {
    if (!chapter.audio_path) return;

    const src = chapter.audio_path;
    let audio = audioRef.current;

    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
    }

    activeBookRef.current = book;
    activeChapterRef.current = chapter;
    setCurrentTrack({ bookId: book.id, chapterId: chapter.id });

    // If we're resuming the same track, just play from the current time
    if (
      currentTrack &&
      currentTrack.bookId === book.id &&
      currentTrack.chapterId === chapter.id &&
      audio.src === src
    ) {
      audio.playbackRate = playbackRate;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error("Failed to resume audio", err);
        });
      return;
    }

    // Otherwise start a new track from the beginning
    audio.src = src;
    audio.playbackRate = playbackRate;

    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err) => {
        console.error("Failed to play audio", err);
      });
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const seekTo = (time: number) => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const total = audio.duration || duration || 0;
    const clamped = Math.max(0, Math.min(time, total || time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Listening Insights</h1>
          <p className="mt-1 text-muted-foreground">
            See all completed audiobooks and track your detailed listening progress.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Playback speed</span>
          <select
            className="rounded-md border bg-background px-2 py-1 text-xs"
            value={playbackRate}
            onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !anyCompleted ? (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-display">No completed books yet</CardTitle>
            <CardDescription>
              Finish listening to a book to see insights here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {booksWithProgress.map((book) => (
            <BookListeningCard
              key={book.id}
              book={book}
              listenedPercent={book.listenedPercent}
              expanded={expandedBookId === book.id}
              onToggleExpand={() =>
                setExpandedBookId((prev) => (prev === book.id ? null : book.id))
              }
              currentTrack={currentTrack}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onPlay={startPlayback}
              onStop={stopPlayback}
              onSeek={seekTo}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface BookListeningCardProps {
  book: DbBook & { listenedPercent: number };
  listenedPercent: number;
  expanded: boolean;
  onToggleExpand: () => void;
  currentTrack: { bookId: string; chapterId: string } | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  onPlay: (book: DbBook, chapter: DbChapter) => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

const BookListeningCard = ({
  book,
  listenedPercent,
  expanded,
  onToggleExpand,
  currentTrack,
  currentTime,
  duration,
  isPlaying,
  onPlay,
  onStop,
  onSeek,
}: BookListeningCardProps) => {
  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["chapters", book.id],
    queryFn: () => fetchChapters(book.id),
    refetchInterval: 10000,
  });

  const completedChapters = chapters.filter((c) => c.status === "completed" && c.audio_path);
  const primaryChapter = completedChapters[0] || chapters[0];

  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, "0")}`;
  };

  const currentPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleChapterPlay = (chapter: DbChapter) => {
    onPlay(book, chapter);
  };

  const handleDownloadChapter = (chapter: DbChapter) => {
    if (!chapter.audio_path) return;
    const url = chapter.audio_path;
    const link = document.createElement("a");
    link.href = url;
    link.download = `${book.title || "audiobook"} - ${chapter.title || "chapter"}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="shadow-card">
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-display truncate flex items-center gap-2">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              {book.title}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {book.author || "Unknown"} • {book.total_duration || "--:--"} total
            </CardDescription>
          </div>
          <BarChart2 className="h-4 w-4 text-primary shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Book listening progress</span>
            <span className="font-mono">{listenedPercent}%</span>
          </div>
          <Progress value={listenedPercent} className="h-2" />
        </div>

        {primaryChapter && (
          <div className="space-y-2 rounded-md bg-muted/60 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  Now playing: {primaryChapter.title}
                </p>
                <p className="text-muted-foreground">{primaryChapter.duration || "--:--"}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadChapter(primaryChapter);
                  }}
                >
                  <Download className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={duration || currentTime || 0}
                value={Math.min(currentTime, duration || currentTime || 0)}
                onChange={(e) => {
                  const nextTime = Number(e.target.value);
                  if (Number.isNaN(nextTime)) return;
                  onSeek(nextTime);
                }}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}

        {expanded && (
          <div className="mt-2 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : chapters.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No chapter information available for this book.
              </p>
            ) : (
              <div className="space-y-1">
                {chapters.map((ch) => {
                  const isChapterPlaying =
                    isPlaying &&
                    currentTrack &&
                    currentTrack.bookId === book.id &&
                    currentTrack.chapterId === ch.id;

                  const chapterDurationSeconds = parseDurationToSeconds(ch.duration);

                  const chapterPercent =
                    isChapterPlaying && duration
                      ? Math.min(100, (currentTime / duration) * 100)
                      : chapterDurationSeconds
                      ? 0
                      : 0;

                  return (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate text-foreground">{ch.title}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={chapterPercent} className="h-1.5 flex-1" />
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {ch.duration || "--:--"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {ch.audio_path && (
                          <>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isChapterPlaying) {
                                  onStop();
                                } else {
                                  handleChapterPlay(ch);
                                }
                              }}
                            >
                              {isChapterPlaying ? (
                                <Square className="h-3 w-3" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border bg-background text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadChapter(ch);
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ListeningStatsPage;


