"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth-context";

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  useEffect(() => {
    const run = async () => {
      await signOut();
      router.replace("/login");
    };
    run();
  }, [router, signOut]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-black">
      <p className="text-sm uppercase tracking-widest">Odjavljam ...</p>
    </div>
  );
}
