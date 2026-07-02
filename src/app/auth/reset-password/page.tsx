"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const t = useTranslations("appPages");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    const initializeRecovery = async () => {
      const hash = window.location.hash;
      
      // Check if there's a recovery token
      if (!hash.includes("type=recovery") || !hash.includes("access_token")) {
        setError("Invalid or expired recovery link");
        setTimeout(() => router.push("/auth/sign-in"), 3000);
        return;
      }

      // The Supabase client will automatically parse the hash and set up the session
      const supabase = createClient();
      
      // Verify we have a valid session from the recovery token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError("Failed to authenticate recovery link. Please request a new password reset.");
        setTimeout(() => router.push("/auth/sign-in"), 3000);
        return;
      }

      setIsTokenValid(true);
    };

    initializeRecovery();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      setError(updateError.message);
      setIsLoading(false);
      return;
    }

    // Success - sign out and redirect to sign-in
    await supabase.auth.signOut();
    router.push("/auth/sign-in?message=Password%20updated%20successfully");
  }

  if (!isTokenValid) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">{error || "Validating recovery link..."}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold">{t("reset_password")}</h1>
        
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
