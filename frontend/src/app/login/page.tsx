"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Email atau password tidak sesuai.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Gagal menghubungi layanan autentikasi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="af-auth">
      <section className="af-auth-panel">
        <Link
          href="/"
          className="text-white text-decoration-none af-brand fs-4"
        >
          AssetFlow EAM
        </Link>

        <div>
          <span className="text-uppercase small">
            Enterprise Asset Management
          </span>

          <h1 className="mt-4">
            One platform.
            <br />
            Complete control.
          </h1>

          <p className="mt-4 opacity-75">
            Kelola inventaris, operasional, pemeliharaan, dan seluruh siklus
            hidup aset perusahaan dalam satu platform.
          </p>
        </div>

        <small className="opacity-75">AssetFlow Secure Workspace</small>
      </section>

      <section className="af-auth-content">
        <div className="af-auth-form">
          <Link href="/" className="text-decoration-none small">
            Kembali ke Beranda
          </Link>

          <h2 className="mt-5 mb-2">Masuk ke AssetFlow</h2>

          <p className="text-body-secondary mb-4">
            Gunakan akun perusahaan yang telah terdaftar.
          </p>

          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="email" className="form-label fw-semibold">
                Email
              </label>

              <input
                id="email"
                type="email"
                className="form-control"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="form-label fw-semibold">
                Password
              </label>

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-control"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <label className="d-flex align-items-center gap-2 mt-3 small">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                Tampilkan password
              </label>
            </div>

            {errorMessage && (
              <div className="alert alert-danger" role="alert">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? "Memverifikasi..." : "Masuk Dashboard"}
            </button>
          </form>

          <p className="text-body-secondary small text-center mt-4">
            Akun pengguna dikelola oleh administrator sistem.
          </p>
        </div>
      </section>
    </main>
  );
}
