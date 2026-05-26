"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    
    // Check if there's a recovery token in the hash
    if (hash.includes("type=recovery") && hash.includes("access_token")) {
      // Redirect to password reset page with the token hash
      router.push(`/auth/reset-password${hash}`);
    }
  }, [router]);

  return null;
}
