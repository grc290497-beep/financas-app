import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage() {
  const t = await getTranslations("Auth.login");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("signUpLink")}
          </Link>
        </>
      }
    >
      {/* LoginForm reads ?next= and ?error= from the URL. */}
      <Suspense fallback={<FormSkeleton fields={2} />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
