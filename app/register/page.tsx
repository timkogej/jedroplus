"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCompany } from "@/app/company-context";
import { useAuth } from "@/app/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { isCompanySelected, loading: companyLoading } = useCompany();
  const { user, loading, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (companyLoading || loading) {
      return;
    }
    // If user is already logged in, redirect to app
    if (user) {
      router.replace("/app");
      return;
    }
    // If no company selected, redirect to onboarding (use window.location to avoid RSC issues)
    if (!isCompanySelected) {
      window.location.href = "/onboarding";
      return;
    }
  }, [companyLoading, isCompanySelected, loading, router, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // Validate that emails match
    if (email !== confirmEmail) {
      setError("Email naslova se ne ujemata.");
      return;
    }

    setSubmitting(true);
    const errorMessage = await signUp(email, password);
    setSubmitting(false);

    if (errorMessage) {
      setError(errorMessage);
      return;
    }

    setNotice("Registracija uspešna. Nadaljuj s prijavo.");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #3B82F6, #06B6D4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Jedro+
          </h1>
          <p className="text-gray-600">Registracija novega računa</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@podjetje.si"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Potrdi email</label>
            <input
              type="email"
              name="confirmEmail"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              placeholder="email@podjetje.si"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Geslo</label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 text-white font-medium rounded-lg transition-all duration-300 ease-in-out hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'linear-gradient(to right, #8B5CF6, #06B6D4)',
            }}
          >
            {submitting ? "Registriram ..." : "Registriraj se"}
          </button>

          {notice ? (
            <p className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </p>
          ) : null}
        </form>

        {/* Login Link */}
        <p className="text-center mt-6 text-sm text-gray-600">
          Že imate račun?{' '}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="font-semibold text-violet-600 hover:text-violet-700 transition-colors"
          >
            Prijavite se
          </button>
        </p>
      </div>
    </div>
  );
}
