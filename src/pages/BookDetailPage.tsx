import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchBookWithChapters, DbChapter } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Headphones, BookOpen } from "lucide-react";
import { parseDurationToSeconds, updateChapterProgress } from "@/lib/listeningProgress";

const BookDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["book-with-chapters", id],
    queryFn: () => fetchBookWithChapters(id!),
    enabled: Boolean(id),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { book, chapters } = data;
  const completedChapters = chapters.filter((c) => c.status === "completed" && c.audio_path);
  const currentChapter: DbChapter | undefined =
    chapters.find((c) => c.id === activeChapterId) || completedChapters[0] || chapters[0];

  const handleTimeUpdate = () => {
    if (!audioRef.current || !currentChapter) return;
    const listened = audioRef.current.currentTime;
    const totalSeconds =
      parseDurationToSeconds(currentChapter.duration) || audioRef.current.duration || listened;
    updateChapterProgress(book.id, currentChapter.id, listened, totalSeconds);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">{book.title}</h1>
          <p className="mt-1 text-muted-foreground">{book.author || "Unknown author"}</p>
        </div>
        <Badge
          className={
            book.status === "completed"
              ? "bg-success text-success-foreground"
              : book.status === "processing"
              ? "bg-warning text-warning-foreground"
              : book.status === "failed"
              ? "bg-destructive text-destructive-foreground"
              : "bg-muted text-muted-foreground"
          }
        >
          {book.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <Card className="shadow-card">
          <CardHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <Headphones className="h-5 w-5 text-primary" />
                  Audio Player
                </CardTitle>
                <CardDescription>
                  Listen to the audiobook and follow along with the chapter text.
                </CardDescription>
              </div>
              {book.total_duration && (
                <div className="text-xs text-muted-foreground">
                  Total duration: <span className="font-mono">{book.total_duration}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {currentChapter && currentChapter.audio_path ? (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">{currentChapter.title}</p>
                  <audio
                    ref={audioRef}
                    controls
                    className="w-full"
                    src={currentChapter.audio_path}
                    onTimeUpdate={handleTimeUpdate}
                  />
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
                  {currentChapter.text_content ? (
                    currentChapter.text_content.split(/\n{2,}/).map((para, idx) => (
                      <p key={idx} className="whitespace-pre-wrap">
                        {para.trim()}
                      </p>
                    ))
                  ) : (
                    <p className="italic text-muted-foreground/80">
                      No text content available for this chapter.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This chapter does not have audio yet. Check back after conversion is complete.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Chapters
              </CardTitle>
              <CardDescription>Jump between chapters and sections.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs
                value={activeChapterId || currentChapter?.id || (chapters[0] && chapters[0].id)}
                onValueChange={(val) => setActiveChapterId(val)}
                className="w-full"
              >
                <TabsList className="w-full justify-start overflow-x-auto">
                  {chapters.map((ch) => (
                    <TabsTrigger
                      key={ch.id}
                      value={ch.id}
                      className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      {ch.title}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {chapters.map((ch) => (
                  <TabsContent key={ch.id} value={ch.id} className="mt-4">
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>Status: {ch.status}</span>
                        <span className="font-mono">{ch.duration || "--:--"}</span>
                      </div>
                      {ch.status === "completed" && (
                        <Progress className="h-1.5" value={100} />
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card className="shadow-card gradient-accent text-accent-foreground">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Listening tips</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-accent-foreground/80 space-y-1.5">
              <p>Use the chapter tabs to quickly jump between major sections of the book.</p>
              <p>Your listening progress is tracked locally so you can see how much you&apos;ve heard.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BookDetailPage;

