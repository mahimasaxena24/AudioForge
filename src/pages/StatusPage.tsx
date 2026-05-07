import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchBooks, fetchChapters, DbBook } from "@/lib/api";

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="h-4 w-4 text-success" />,
  processing: <Loader2 className="h-4 w-4 text-warning animate-spin" />,
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  failed: <AlertCircle className="h-4 w-4 text-destructive" />,
};

const StatusPage = () => {
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: fetchBooks,
    refetchInterval: 3000,
  });

  const activeBooks = books.filter((b) => b.status !== "uploaded");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">Conversion Status</h1>
        <p className="mt-1 text-muted-foreground">Monitor the progress of audiobook conversions</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : activeBooks.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground">No active conversions. Upload a book to get started.</p>
      ) : (
        <div className="space-y-4">
          {activeBooks.map((book) => (
            <BookStatusCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
};

function BookStatusCard({ book }: { book: DbBook }) {
  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", book.id],
    queryFn: () => fetchChapters(book.id),
    refetchInterval: 3000,
  });

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display text-lg">{book.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{book.author || "Unknown"}</p>
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
        {book.status === "processing" && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Overall Progress</span>
              <span>{book.progress}%</span>
            </div>
            <Progress value={book.progress} className="h-2" />
          </div>
        )}
      </CardHeader>
      {chapters.length > 0 && (
        <CardContent>
          <div className="space-y-2">
            {chapters.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  {statusIcon[ch.status] || statusIcon.pending}
                  <span className="text-sm font-medium text-foreground">{ch.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">{ch.duration || "--:--"}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default StatusPage;
