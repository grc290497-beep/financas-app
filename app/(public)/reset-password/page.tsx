import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { NewPasswordForm } from "@/components/forms/new-password-form";
import { requireUser } from "@/lib/auth";

// Reached signed in: from the reset e-mail (via /auth/callback) or from Ajustes.
export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth.reset");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={
        <Link
          href="/app"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      }
    >
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <SignedIn>
          <NewPasswordForm />
        </SignedIn>
      </Suspense>
    </AuthShell>
  );
}

/** Without a session (an expired link) requireUser sends the user to /login. */
async function SignedIn({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
