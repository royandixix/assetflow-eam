"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 12) {
      setError("Password minimal 12 karakter.");
      return;
    }

    if (password !== confirm) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      setError("Konfigurasi Supabase publik belum tersedia.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError(
          "Sesi undangan tidak ditemukan. Buka kembali tautan dari email.",
        );
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Gagal memperbarui password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      className="container d-flex align-items-center justify-content-center py-5"
      style={{
        minHeight: "100vh",
        maxWidth: 520,
      }}
    >
      <Card className="w-100 shadow-sm">
        <Card.Body className="p-4">
          <h1 className="h4 mb-2">Aktivasi Akun AssetFlow EAM</h1>

          <p className="text-body-secondary">
            Buat password akun yang menerima undangan.
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={submit}>
            <Form.Group className="mb-3">
              <Form.Label>Password baru</Form.Label>

              <Form.Control
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                disabled={saving}
                onChange={(event) => setPassword(event.target.value)}
              />

              <Form.Text muted>Minimal 12 karakter.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Konfirmasi password</Form.Label>

              <Form.Control
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                disabled={saving}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Form.Group>

            <Button type="submit" className="w-100" disabled={saving}>
              {saving ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Menyimpan...
                </>
              ) : (
                "Aktifkan Akun"
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </main>
  );
}
