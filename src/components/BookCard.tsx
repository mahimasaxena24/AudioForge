import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Clock, Download, FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { DbBook, DbChapter, deleteBook, fetchChapters, getAudioUrl } from "@/lib/api";

interface BookCardProps {
  book: DbBook;
  onSelect?: (book: DbBook) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Uploaded", className: "bg-info text-info-foreground" },
  queued: { label: "Queued", className: "bg-secondary text-secondary-foreground" },
  processing: { label: "Processing", className: "bg-warning text-warning-foreground" },
  completed: { label: "Completed", className: "bg-success text-success-foreground" },
  failed: { label: "Failed", className: "bg-destructive text-destructive-foreground" },
};

const coverGradients = ["gradient-primary", "gradient-accent", "gradient-warm"];

const BookCard = ({ book, onSelect }: BookCardProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const { toast } = useToast();
  const status = statusConfig[book.status] || statusConfig.uploaded;
  const gradient = coverGradients[book.title.length % 3];

  const getPrimaryChapter = (chapters: DbChapter[]) =>
    chapters.find((chapter) => chapter.status === "completed" && chapter.audio_path) ||
    chapters.find((chapter) => chapter.audio_path);

  const deleteMutation = useMutation({
    mutationFn: () => deleteBook(book.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["books"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast({
        title: "Book deleted",
        description: `"${book.title}" has been removed.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    try {
      const chapters = await fetchChapters(book.id);
      const chapter = getPrimaryChapter(chapters);
      if (!chapter || !chapter.audio_path) {
        console.warn("No audio available for download");
        return;
      }
      const url = getAudioUrl(chapter.audio_path);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${book.title || "audiobook"}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error loading chapters for download", error);
    }
  };

  return (
    <Card
      className="group cursor-pointer shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated"
      onClick={() => {
        if (onSelect) {
          onSelect(book);
        } else {
          navigate(`/books/${book.id}`);
        }
      }}
    >
      <CardContent className="p-0">
        <div className={`h-2 rounded-t-lg ${gradient}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-display font-semibold text-foreground truncate">{book.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{book.author || "Unknown"}</p>
            </div>
            <Badge className={status.className}>{status.label}</Badge>
          </div>

          {(book.status === "processing" || book.status === "queued") && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{book.status === "queued" ? "Queued..." : "Converting..."}</span>
                <span>{book.progress}%</span>
              </div>
              <Progress value={book.progress} className="h-1.5" />
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            {book.file_size && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {book.file_size}
              </span>
            )}
            {book.total_duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {book.total_duration}
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            {book.status === "completed" && (
              <Button
                size="sm"
                className="flex-1 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDownload();
                }}
              >
                <Download className="mr-1 h-3 w-3" /> Download
              </Button>
            )}
            {role === "admin" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={deleteMutation.isPending}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteMutation.mutate();
                }}
              >
                <Trash2 className="mr-1 h-3 w-3" /> Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BookCard;
