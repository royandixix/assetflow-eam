"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell from "./AuthShell";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const registered = searchParams.get("registered") === "1";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="Masuk ke AssetFlow"
      subtitle="Gunakan akun perusahaan yang telah terdaftar untuk mengakses dashboard AssetFlow EAM."
      footerText="Belum punya akun?"
      footerLinkHref="/register"
      footerLinkLabel="Daftar di sini"
    >
      {registered ? (
        <div className="alert alert-success" role="alert">
          Registrasi berhasil. Silakan login menggunakan akun baru.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="alert alert-danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label fw-semibold">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="form-control form-control-lg"
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="mb-2">
          <label htmlFor="login-password" className="form-label fw-semibold">
            Password
          </label>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            className="form-control form-control-lg"
            placeholder="Masukkan password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="form-check mb-4">
          <input
            id="show-login-password"
            type="checkbox"
            className="form-check-input"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          <label
            htmlFor="show-login-password"
            className="form-check-label text-secondary"
          >
            Tampilkan password
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-100"
          disabled={loading}
        >
          {loading ? "Memproses..." : "Masuk Dashboard"}
        </button>

        <p className="text-center text-secondary mt-4 mb-0 small">
          Akun pengguna dikelola oleh administrator sistem.
        </p>
      </form>
    </AuthShell>
  );
}
