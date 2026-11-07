"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";

type SettingsData = {
  app_name: string;
  organization_name: string;
  contact_email: string;
  timezone: string;
  date_format: string;
  updated_at: string;
  updated_by: string;
};

type SettingsForm = Pick<
  SettingsData,
  | "app_name"
  | "organization_name"
  | "contact_email"
  | "timezone"
  | "date_format"
>;

const initialForm: SettingsForm = {
  app_name: "",
  organization_name: "",
  contact_email: "",
  timezone: "Asia/Makassar",
  date_format: "DD/MM/YYYY",
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : "Terjadi kesalahan pada permintaan";

    throw new Error(message);
  }

  return body as T;
}

export default function SettingsManager() {
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [saved, setSaved] = useState<SettingsData | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/settings", {
        method: "GET",
        cache: "no-store",
      });

      const data = await readResponse<SettingsData>(response);

      setForm({
        app_name: data.app_name,
        organization_name: data.organization_name,
        contact_email: data.contact_email,
        timezone: data.timezone,
        date_format: data.date_format,
      });

      setSaved(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateField<K extends keyof SettingsForm>(
    field: K,
    value: SettingsForm[K],
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const result = await readResponse<{
        message: string;
        data: SettingsData;
      }>(response);

      setSaved(result.data);

      setForm({
        app_name: result.data.app_name,
        organization_name: result.data.organization_name,
        contact_email: result.data.contact_email,
        timezone: result.data.timezone,
        date_format: result.data.date_format,
      });

      setSuccess(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan",
      );
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    saved !== null &&
    (form.app_name !== saved.app_name ||
      form.organization_name !== saved.organization_name ||
      form.contact_email !== saved.contact_email ||
      form.timezone !== saved.timezone ||
      form.date_format !== saved.date_format);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">Pengaturan</h3>
          <p className="text-body-secondary mb-0">
            Kelola konfigurasi dasar aplikasi AssetFlow EAM.
          </p>
        </div>

        <Button
          variant="outline-primary"
          disabled={loading || saving}
          onClick={() => void loadSettings()}
        >
          Muat Ulang
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Card className="shadow-sm border-0">
        <Card.Header className="bg-body border-bottom py-3">
          <h5 className="fw-semibold mb-1">Pengaturan Umum</h5>
          <div className="text-body-secondary small">
            Identitas organisasi dan preferensi format aplikasi.
          </div>
        </Card.Header>

        <Card.Body className="p-4">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="text-body-secondary mt-3">Memuat pengaturan...</p>
            </div>
          ) : saved ? (
            <Form onSubmit={handleSubmit}>
              <Row className="g-4">
                <Col md={6}>
                  <Form.Group controlId="settings-app-name">
                    <Form.Label>Nama Aplikasi</Form.Label>

                    <Form.Control
                      required
                      maxLength={100}
                      value={form.app_name}
                      onChange={(event) =>
                        updateField("app_name", event.target.value)
                      }
                      placeholder="AssetFlow EAM"
                    />

                    <Form.Text className="text-body-secondary">
                      Identitas nama aplikasi yang tersimpan.
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group controlId="settings-org-name">
                    <Form.Label>Nama Organisasi</Form.Label>

                    <Form.Control
                      required
                      maxLength={150}
                      value={form.organization_name}
                      onChange={(event) =>
                        updateField("organization_name", event.target.value)
                      }
                      placeholder="Nama organisasi"
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group controlId="settings-email">
                    <Form.Label>Email Kontak Organisasi</Form.Label>

                    <Form.Control
                      type="email"
                      maxLength={254}
                      value={form.contact_email}
                      onChange={(event) =>
                        updateField("contact_email", event.target.value)
                      }
                      placeholder="admin@organisasi.com"
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group controlId="settings-timezone">
                    <Form.Label>Zona Waktu</Form.Label>

                    <Form.Select
                      value={form.timezone}
                      onChange={(event) =>
                        updateField("timezone", event.target.value)
                      }
                    >
                      <option value="Asia/Jakarta">WIB — Asia/Jakarta</option>

                      <option value="Asia/Makassar">
                        WITA — Asia/Makassar
                      </option>

                      <option value="Asia/Jayapura">WIT — Asia/Jayapura</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group controlId="settings-date">
                    <Form.Label>Format Tanggal</Form.Label>

                    <Form.Select
                      value={form.date_format}
                      onChange={(event) =>
                        updateField("date_format", event.target.value)
                      }
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>

                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              <hr className="my-4" />

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div className="text-body-secondary small">
                  {saved.updated_at
                    ? `Terakhir disimpan: ${new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Makassar",
                      }).format(new Date(saved.updated_at))} WITA`
                    : "Belum ada informasi perubahan"}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || !hasChanges}
                >
                  {saving ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Pengaturan"
                  )}
                </Button>
              </div>
            </Form>
          ) : (
            <div className="text-body-secondary py-4">
              Data pengaturan belum dapat ditampilkan.
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
