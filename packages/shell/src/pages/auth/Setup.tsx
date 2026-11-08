import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@groot/ui/button";
import { Form, FormField } from "@groot/ui/form";
import { Input } from "@groot/ui/input";
import { LoadingSpinner } from "@groot/ui/loading-spinner";
import { h1Class } from "@groot/ui/typography";
import { ApiError } from "@groot/shell/lib/api";
import { useShellConfig } from "@groot/shell/lib/shell-config";
import { useSetupStatus } from "@groot/shell/hooks/useSetupStatus";
import { loginErrorDescription, useAuthStore } from "@groot/shell/store/auth";

// Mirrors the server's createUserSchema (packages/core/src/auth/auth.schema.ts),
// plus a confirmation field that never leaves the browser.
const setupSchema = z
  .object({
    name: z.string(),
    email: z.email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type SetupValues = z.infer<typeof setupSchema>;

/**
 * First-run setup at `/setup`: create the first account and sign in as it.
 * Open only while the database has no users; afterwards it sends people to
 * `/login`.
 */
export function Setup() {
  const needsSetup = useSetupStatus();
  const setup = useAuthStore((state) => state.setup);
  const navigate = useNavigate();
  const { icon: BrandMark, label: brandLabel } = useShellConfig().brand;

  if (needsSetup === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/40">
        <LoadingSpinner size="md" />
      </div>
    );
  }
  if (!needsSetup) return <Navigate to="/login" replace />;

  const onSubmit = async ({ name, email, password }: SetupValues) => {
    try {
      await setup({ email, password, name: name.trim() || undefined });
      toast.success("Account created", { description: `Signed in as ${email}.` });
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        toast.error("Setup already complete", { description: "Sign in with an existing account." });
        navigate("/login", { replace: true });
        return;
      }
      toast.error("Setup Failed", {
        description: loginErrorDescription(error, "Could not create the account"),
      });
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BrandMark className="size-5" />
          </span>
          <span className="font-heading text-base font-semibold">{brandLabel}</span>
        </div>

        <h1 className={h1Class}>Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          No users exist yet. The account you create here signs you in, and this page closes once it
          exists.
        </p>

        <Form
          schema={setupSchema}
          defaultValues={{ name: "", email: "", password: "", confirmPassword: "" }}
          onSubmit={onSubmit}
          className="mt-6 space-y-4"
        >
          <FormField name="name" label="Name (optional)">
            <Input autoComplete="name" placeholder="Ada Lovelace" />
          </FormField>
          <FormField name="email" label="Email">
            <Input type="email" autoComplete="username" placeholder="you@example.com" />
          </FormField>
          <FormField name="password" label="Password">
            <Input type="password" autoComplete="new-password" placeholder="••••••••" />
          </FormField>
          <FormField name="confirmPassword" label="Confirm password">
            <Input type="password" autoComplete="new-password" placeholder="••••••••" />
          </FormField>
          <Button type="submit" size="lg" className="w-full">
            Create account
            <ArrowRight className="size-4" />
          </Button>
        </Form>
      </div>
    </div>
  );
}
