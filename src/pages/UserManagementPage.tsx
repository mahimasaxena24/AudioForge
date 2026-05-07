import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createUser, deleteUser, fetchUsers } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setForm(initialForm);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User created",
        description: "The new user account is ready to sign in.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User removed",
        description: "The account has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({ ...form, role: "user" });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">User Management</h1>
        <p className="mt-1 text-muted-foreground">Create listener accounts and control access to AudioForge.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Create User
            </CardTitle>
            <CardDescription>Only admins can create new user accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Reader name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="reader@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                Role: <span className="font-medium text-foreground">User</span>
              </div>
              <Button className="w-full" disabled={createMutation.isPending} type="submit">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating user...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display">Existing Users</CardTitle>
            <CardDescription>Admins remain protected. User accounts can be removed here.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{user.name}</p>
                        <Badge className={user.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}>
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={user.role === "admin" || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(user.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserManagementPage;
