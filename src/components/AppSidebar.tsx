import { NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart2,
  Headphones,
  LayoutDashboard,
  Library,
  Loader2,
  LogOut,
  Upload,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchDashboardSummary } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const adminNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/upload", icon: Upload, label: "Upload Book" },
  { to: "/library", icon: Library, label: "Audiobook Library" },
  { to: "/status", icon: Activity, label: "Conversion Status" },
  { to: "/listening", icon: BarChart2, label: "Listening Insights" },
  { to: "/users", icon: Users, label: "User Management" },
];

const userNavItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/library", icon: Library, label: "Audiobook Library" },
  { to: "/listening", icon: BarChart2, label: "Listening Insights" },
];

const AppSidebar = () => {
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const navItems = role === "admin" ? adminNavItems : userNavItems;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: fetchDashboardSummary,
    enabled: role === "admin",
    refetchInterval: 5000,
  });

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
          <Headphones className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-base font-bold text-sidebar-primary-foreground">AudioForge</h1>
          <p className="text-[10px] text-sidebar-muted">{role === "admin" ? "Admin Console" : "Listener Portal"}</p>
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-sidebar-border p-4">
        {role === "admin" && (
          <div className="rounded-lg bg-sidebar-accent p-3">
            <p className="text-xs font-medium text-sidebar-accent-foreground">Processing Queue</p>
            {isLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sidebar-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Refreshing queue...</span>
              </div>
            ) : (
              <>
                <p className="mt-1 text-lg font-bold text-sidebar-primary font-display">{summary?.queue_count ?? 0} books</p>
                <p className="text-[10px] text-sidebar-muted">{summary?.processing_books ?? 0} currently processing</p>
              </>
            )}
          </div>
        )}

        <div className="rounded-lg border border-sidebar-border/70 p-3">
          <p className="text-xs text-sidebar-muted">Signed in as</p>
          <p className="mt-1 truncate text-sm font-semibold text-sidebar-primary-foreground">{user?.name}</p>
          <p className="truncate text-[11px] text-sidebar-muted">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-3 h-8 w-full justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
