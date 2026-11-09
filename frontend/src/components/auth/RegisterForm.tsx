"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "./AuthShell";
import { createClient } from "@/lib/supabase/client";

export default function RegisterForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setSuccessMessage("Akun berhasil dibuat. Mengalihkan ke halaman login...");
    setTimeout(() => {
      router.push("/login?registered=1");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthShell
      title="Buat akun AssetFlow"
      subtitle="Daftarkan akun baru untuk mulai menggunakan sistem AssetFlow EAM."
      footerText="Sudah punya akun?"
      footerLinkHref="/login"
      footerLinkLabel="Masuk di sini"
    >
      {errorMessage ? (
        <div className="alert alert-danger" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="alert alert-success" role="alert">
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="register-name" className="form-label fw-semibold">
            Nama Lengkap
          </label>
          <input
            id="register-name"
            type="text"
            className="form-control form-control-lg"
            placeholder="Nama lengkap"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="register-email" className="form-label fw-semibold">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            className="form-control form-control-lg"
            placeholder="nama@perusahaan.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="register-password" className="form-label fw-semibold">
            Password
          </label>
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            className="form-control form-control-lg"
            placeholder="Masukkan password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="mb-2">
          <label
            htmlFor="register-confirm-password"
            className="form-label fw-semibold"
          >
            Konfirmasi Password
          </label>
          <input
            id="register-confirm-password"
            type={showPassword ? "text" : "password"}
            className="form-control form-control-lg"
            placeholder="Ulangi password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>

        <div className="form-check mb-4">
          <input
            id="show-register-password"
            type="checkbox"
            className="form-check-input"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          <label
            htmlFor="show-register-password"
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
          {loading ? "Memproses..." : "Daftar Sekarang"}
        </button>

        <p className="text-center text-secondary mt-4 mb-0 small">
          Setelah registrasi, role pengguna bisa diatur oleh administrator.
        </p>
      </form>
    </AuthShell>
  );
}
