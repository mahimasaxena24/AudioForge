import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import AppLayout from "./components/AppLayout";
import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/UploadPage";
import LibraryPage from "./pages/LibraryPage";
import StatusPage from "./pages/StatusPage";
import BookDetailPage from "./pages/BookDetailPage";
import ListeningStatsPage from "./pages/ListeningStatsPage";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/library" element={<LibraryPage />} />
                <Route path="/books/:id" element={<BookDetailPage />} />
                <Route path="/listening" element={<ListeningStatsPage />} />

                <Route element={<RoleRoute allowedRoles={["admin"]} />}>
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/status" element={<StatusPage />} />
                  <Route path="/users" element={<UserManagementPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
            <Route path="/app" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
