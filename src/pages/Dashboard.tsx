import { BookOpen, Headphones, Loader2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import StatsCard from "@/components/StatsCard";
import BookCard from "@/components/BookCard";
import { fetchDashboardSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Dashboard = () => {
  const { role, user } = useAuth();
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    refetchInterval: 5000,
  });

  const recentBooks = summary?.recent_books || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">
          {role === "admin" ? "Admin Dashboard" : "User Dashboard"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {role === "admin"
            ? "Manage uploads, conversion progress, and platform users from one place."
            : `Welcome back, ${user?.name}. Continue listening to your audiobook library.`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Books" value={summary?.total_books ?? 0} icon={BookOpen} gradient="gradient-primary" />
        {role === "admin" && (
          <>
            <StatsCard title="Audiobooks Ready" value={summary?.completed_books ?? 0} icon={Headphones} gradient="gradient-accent" />
            <StatsCard
              title="Processing Queue"
              value={summary?.queue_count ?? 0}
              icon={Loader2}
              gradient="gradient-warm"
              subtitle={`${summary?.queued_books ?? 0} queued`}
            />
            <StatsCard
              title="Platform Users"
              value="RBAC"
              icon={Users}
              gradient="gradient-primary"
              subtitle="Admin + listener roles enabled"
            />
          </>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold font-display text-foreground">Recent Books</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recentBooks.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {role === "admin" ? "No books uploaded yet. Start from Upload Book." : "No audiobooks are available yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {recentBooks.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
