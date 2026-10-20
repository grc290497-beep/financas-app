import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/forms/signup-form";

export default async function SignupPage() {
  const t = await getTranslations("Auth.signup");

  return (
    <AuthShell
      title={t("title")}
      description={t("subtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("loginLink")}
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
