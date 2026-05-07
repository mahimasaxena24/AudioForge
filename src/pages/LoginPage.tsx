import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Headphones, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const LoginPage = () => {
  const { isAuthenticated, login, isLoading, user } = useAuth();
  const [email, setEmail] = useState("admin@audioforge.com");
  const [password, setPassword] = useState("admin123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  if (!isLoading && isAuthenticated) {
    const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={nextPath || "/"} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login(email, password);
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(nextPath || "/", { replace: true });
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Unable to sign in.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_45%),linear-gradient(135deg,_hsl(var(--background)),_hsl(var(--muted)))] px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full gap-8 rounded-[2rem] border border-border/60 bg-background/85 p-6 shadow-elevated backdrop-blur lg:grid-cols-[1.1fr,0.9fr] lg:p-10">
          <section className="flex flex-col justify-between rounded-[1.5rem] gradient-primary p-8 text-primary-foreground">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Headphones className="h-6 w-6" />
              </div>
              <h1 className="mt-8 font-display text-4xl font-bold">AudioForge</h1>
              <p className="mt-3 max-w-md text-sm text-primary-foreground/85">
                Secure AI audiobook conversion for admins and listeners. Sign in to manage uploads, monitor processing, or jump straight into playback.
              </p>
            </div>
            <div className="space-y-3 text-sm text-primary-foreground/85">
              <div className="flex items-center gap-3 rounded-2xl bg-black/15 px-4 py-3">
                <ShieldCheck className="h-5 w-5" />
                JWT sessions with role-based access for Admin and User accounts.
              </div>
            </div>
          </section>

          <Card className="border-none bg-transparent shadow-none">
            <CardHeader className="px-0 pt-2">
              <CardTitle className="font-display text-2xl">Sign in</CardTitle>
              <CardDescription>
                {user ? `Continue as ${user.name}` : "Use your AudioForge account to continue."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button className="w-full" size="lg" disabled={isSubmitting} type="submit">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
                    </>
                  ) : (
                    "Login"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
