"use client";

// ============================================================
// /reset-password — the form the password-reset email leads to.
//
// The emailed link goes to /api/auth/reset-password/<token>, which
// checks the token and redirects here with ?token=… (valid) or
// ?error=INVALID_TOKEN (spent / expired). No token → say so, with a way
// to request a new one, rather than bouncing to /login with no
// explanation (issue #592). Resetting revokes every session, so the
// user signs in again afterwards.
//
// Not gated by the proxy on purpose: the "expired" state must be
// reachable signed-out, and a signed-in visitor must not be redirected
// away from the very page they need.
// ============================================================

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, MailX } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

type Status = "ready" | "expired" | "done";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const t = useTranslations("ResetPasswordPage");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>(
    token && !searchParams.get("error") ? "ready" : "expired",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordsMismatch"));
      return;
    }
    // Same floor as /signup.
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setSaving(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token: token ?? "",
    });
    setSaving(false);

    if (error) {
      if (error.code === "INVALID_TOKEN" || error.status === 400) {
        setStatus("expired");
        return;
      }
      setError(authErrorMessage(error, t("resetFailed")));
      return;
    }
    setStatus("done");
  };

  if (status === "expired") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-card-2 px-4 py-10">
        <Card className="w-full max-w-md rounded-2xl border-border bg-card px-2 py-7 shadow-soft sm:px-4">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-status-warning-bg">
              <MailX className="h-6 w-6 text-status-warning" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {t("expiredTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("expiredDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/forgot-password">
              <Button className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {t("requestNewLink")}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t("backToSignIn")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-card-2 px-4 py-10">
        <Card className="w-full max-w-md rounded-2xl border-border bg-card px-2 py-7 shadow-soft sm:px-4">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
              {t("successTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("successDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* A reset signs out every session, so continue at /login. */}
            <Link href="/login">
              <Button className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {t("backToSignIn")}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-card-2 px-4 py-10">
      <Card className="w-full max-w-md rounded-2xl border-border bg-card px-2 py-7 shadow-soft sm:px-4">
        <CardHeader className="items-center text-center">
          <BrandLogo className="mx-auto mb-3 h-12" priority />
          <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("desc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-status-critical/20 bg-status-critical/10 px-4 py-3 text-sm text-status-critical">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-muted-foreground">
                {t("passwordLabel")}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={t("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">
                {t("confirmPasswordLabel")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder={t("confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("saving") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
