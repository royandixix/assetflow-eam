"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";

type Theme = "light" | "dark" | "system";

type GeneralSettings = {
  app_name: string;
  organization_name: string;
  contact_email: string;
  timezone: string;
  date_format: string;
  updated_at: string;
  updated_by: string;
};

type GeneralForm = Pick<
  GeneralSettings,
  | "app_name"
  | "organization_name"
  | "contact_email"
  | "timezone"
  | "date_format"
>;

type Preferences = {
  theme: Theme;
  updated_at: string | null;
};

type PasswordForm = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

type LoadedSettings = {
  general: GeneralSettings;
  preferences: Preferences;
};

const emptyGeneral: GeneralForm = {
  app_name: "",
  organization_name: "",
  contact_email: "",
  timezone: "Asia/Makassar",
  date_format: "DD/MM/YYYY",
};

const emptyPassword: PasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : `Permintaan gagal: HTTP ${response.status}`;

    throw new Error(message);
  }

  return body as T;
}

async function fetchAllSettings(): Promise<LoadedSettings> {
  const [generalResponse, preferencesResponse] = await Promise.all([
    fetch("/api/settings", {
      method: "GET",
      cache: "no-store",
    }),
    fetch("/api/settings/preferences", {
      method: "GET",
      cache: "no-store",
    }),
  ]);

  const [general, preferences] = await Promise.all([
    readResponse<GeneralSettings>(generalResponse),
    readResponse<Preferences>(preferencesResponse),
  ]);

  return { general, preferences };
}

function formatSavedDate(value: string, timezone: string, dateFormat: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  const day = get("day");
  const month = get("month");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");

  const formattedDate =
    dateFormat === "YYYY-MM-DD"
      ? `${year}-${month}-${day}`
      : `${day}/${month}/${year}`;

  const zoneLabel =
    timezone === "Asia/Jakarta"
      ? "WIB"
      : timezone === "Asia/Jayapura"
        ? "WIT"
        : "WITA";

  return `${formattedDate}, ${hour}:${minute} ${zoneLabel}`;
}

export default function SettingsManager() {
  const [general, setGeneral] = useState<GeneralForm>(emptyGeneral);

  const [savedGeneral, setSavedGeneral] = useState<GeneralSettings | null>(
    null,
  );

  const [theme, setTheme] = useState<Theme>("system");
  const [savedTheme, setSavedTheme] = useState<Theme>("system");

  const [password, setPassword] = useState<PasswordForm>(emptyPassword);

  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [error, setError] = useState("");
  const [generalMessage, setGeneralMessage] = useState("");
  const [themeMessage, setThemeMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const applyLoadedSettings = useCallback((data: LoadedSettings) => {
    setSavedGeneral(data.general);

    setGeneral({
      app_name: data.general.app_name,
      organization_name: data.general.organization_name,
      contact_email: data.general.contact_email,
      timezone: data.general.timezone,
      date_format: data.general.date_format,
    });

    setTheme(data.preferences.theme);
    setSavedTheme(data.preferences.theme);
  }, []);

  useEffect(() => {
    let active = true;

    void fetchAllSettings()
      .then((data) => {
        if (!active) return;

        applyLoadedSettings(data);
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error ? err.message : "Gagal memuat pengaturan",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [applyLoadedSettings]);

  async function reloadSettings() {
    setLoading(true);
    setError("");
    setGeneralMessage("");
    setThemeMessage("");

    try {
      const data = await fetchAllSettings();
      applyLoadedSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }

  function updateGeneral<K extends keyof GeneralForm>(
    key: K,
    value: GeneralForm[K],
  ) {
    setGeneral((previous) => ({
      ...previous,
      [key]: value,
    }));

    setGeneralMessage("");
  }

  function updatePassword<K extends keyof PasswordForm>(
    key: K,
    value: PasswordForm[K],
  ) {
    setPassword((previous) => ({
      ...previous,
      [key]: value,
    }));

    setPasswordMessage("");
  }

  const generalChanged =
    savedGeneral !== null &&
    (general.app_name !== savedGeneral.app_name ||
      general.organization_name !== savedGeneral.organization_name ||
      general.contact_email !== savedGeneral.contact_email ||
      general.timezone !== savedGeneral.timezone ||
      general.date_format !== savedGeneral.date_format);

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!generalChanged) return;

    setSavingGeneral(true);
    setError("");
    setGeneralMessage("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(general),
      });

      const result = await readResponse<{
        message: string;
        data: GeneralSettings;
      }>(response);

      setSavedGeneral(result.data);

      setGeneral({
        app_name: result.data.app_name,
        organization_name: result.data.organization_name,
        contact_email: result.data.contact_email,
        timezone: result.data.timezone,
        date_format: result.data.date_format,
      });

      setGeneralMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal menyimpan pengaturan umum",
      );
    } finally {
      setSavingGeneral(false);
    }
  }

  async function saveTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (theme === savedTheme) return;

    setSavingTheme(true);
    setError("");
    setThemeMessage("");

    try {
      const response = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme }),
      });

      const result = await readResponse<{
        message: string;
        data: Preferences;
      }>(response);

      setTheme(result.data.theme);
      setSavedTheme(result.data.theme);

      try {
        window.localStorage.setItem("assetflow-theme", result.data.theme);
      } catch {
        // Preferensi tetap tersimpan pada server.
      }

      window.dispatchEvent(new Event("assetflow-theme-updated"));

      setThemeMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan tampilan");
    } finally {
      setSavingTheme(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setPasswordMessage("");

    if (password.new_password.length < 12) {
      setError("Password baru minimal 12 karakter");
      return;
    }

    if (password.new_password !== password.confirm_password) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    setSavingPassword(true);

    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(password),
      });

      const result = await readResponse<{
        message: string;
      }>(response);

      setPassword(emptyPassword);
      setPasswordMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengganti password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">Pengaturan</h3>

          <p className="text-body-secondary mb-0">
            Kelola konfigurasi aplikasi, tampilan, dan keamanan akun.
          </p>
        </div>

        <Button
          variant="outline-primary"
          disabled={loading || savingGeneral || savingTheme || savingPassword}
          onClick={() => void reloadSettings()}
        >
          Muat Ulang
        </Button>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />

          <p className="text-body-secondary mt-3">Memuat pengaturan...</p>
        </div>
      ) : (
        <div className="d-grid gap-4">
          <Card className="shadow-sm">
            <Card.Header className="bg-body py-3">
              <h5 className="fw-semibold mb-1">Pengaturan Umum</h5>

              <p className="text-body-secondary small mb-0">
                Identitas organisasi dan preferensi format aplikasi.
              </p>
            </Card.Header>

            <Card.Body className="p-4">
              {generalMessage && (
                <Alert variant="success">{generalMessage}</Alert>
              )}

              {savedGeneral ? (
                <Form onSubmit={saveGeneral}>
                  <Row className="g-4">
                    <Col md={6}>
                      <Form.Group controlId="settings-app-name">
                        <Form.Label>Nama Aplikasi</Form.Label>

                        <Form.Control
                          required
                          maxLength={100}
                          value={general.app_name}
                          onChange={(event) =>
                            updateGeneral("app_name", event.target.value)
                          }
                        />

                        <Form.Text className="text-body-secondary">
                          Nama aplikasi yang disimpan pada sistem.
                        </Form.Text>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="settings-org-name">
                        <Form.Label>Nama Organisasi</Form.Label>

                        <Form.Control
                          required
                          maxLength={150}
                          value={general.organization_name}
                          onChange={(event) =>
                            updateGeneral(
                              "organization_name",
                              event.target.value,
                            )
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="settings-email">
                        <Form.Label>Email Kontak Organisasi</Form.Label>

                        <Form.Control
                          type="email"
                          maxLength={254}
                          value={general.contact_email}
                          onChange={(event) =>
                            updateGeneral("contact_email", event.target.value)
                          }
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="settings-timezone">
                        <Form.Label>Zona Waktu</Form.Label>

                        <Form.Select
                          value={general.timezone}
                          onChange={(event) =>
                            updateGeneral("timezone", event.target.value)
                          }
                        >
                          <option value="Asia/Jakarta">
                            WIB — Asia/Jakarta
                          </option>

                          <option value="Asia/Makassar">
                            WITA — Asia/Makassar
                          </option>

                          <option value="Asia/Jayapura">
                            WIT — Asia/Jayapura
                          </option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group controlId="settings-date-format">
                        <Form.Label>Format Tanggal</Form.Label>

                        <Form.Select
                          value={general.date_format}
                          onChange={(event) =>
                            updateGeneral("date_format", event.target.value)
                          }
                        >
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>

                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>

                  <hr className="my-4" />

                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <span className="text-body-secondary small">
                      Terakhir disimpan:{" "}
                      {formatSavedDate(
                        savedGeneral.updated_at,
                        general.timezone,
                        general.date_format,
                      )}
                    </span>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={savingGeneral || !generalChanged}
                    >
                      {savingGeneral ? "Menyimpan..." : "Simpan Pengaturan"}
                    </Button>
                  </div>
                </Form>
              ) : (
                <p className="text-body-secondary">
                  Data pengaturan belum tersedia.
                </p>
              )}
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-body py-3">
              <h5 className="fw-semibold mb-1">Pengaturan Tampilan</h5>

              <p className="text-body-secondary small mb-0">
                Atur tema aplikasi untuk akun yang sedang digunakan.
              </p>
            </Card.Header>

            <Card.Body className="p-4">
              {themeMessage && <Alert variant="success">{themeMessage}</Alert>}

              <Form onSubmit={saveTheme}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group controlId="settings-theme">
                      <Form.Label>Tema Aplikasi</Form.Label>

                      <Form.Select
                        value={theme}
                        onChange={(event) => {
                          setTheme(event.target.value as Theme);

                          setThemeMessage("");
                        }}
                      >
                        <option value="light">Terang</option>

                        <option value="dark">Gelap</option>

                        <option value="system">Ikuti Sistem</option>
                      </Form.Select>

                      <Form.Text className="text-body-secondary">
                        Tema disimpan per pengguna pada PostgreSQL.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex justify-content-end mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingTheme || theme === savedTheme}
                  >
                    {savingTheme ? "Menyimpan..." : "Simpan Tampilan"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-body py-3">
              <h5 className="fw-semibold mb-1">Keamanan Akun</h5>

              <p className="text-body-secondary small mb-0">
                Ubah password akun melalui Supabase Auth.
              </p>
            </Card.Header>

            <Card.Body className="p-4">
              {passwordMessage && (
                <Alert variant="success">{passwordMessage}</Alert>
              )}

              <Form onSubmit={changePassword}>
                <Row className="g-4">
                  <Col md={6}>
                    <Form.Group controlId="current-password">
                      <Form.Label>Password Saat Ini</Form.Label>

                      <Form.Control
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password.current_password}
                        onChange={(event) =>
                          updatePassword("current_password", event.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="new-password">
                      <Form.Label>Password Baru</Form.Label>

                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                        value={password.new_password}
                        onChange={(event) =>
                          updatePassword("new_password", event.target.value)
                        }
                      />

                      <Form.Text className="text-body-secondary">
                        Minimal 12 karakter. Gunakan password unik.
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group controlId="confirm-password">
                      <Form.Label>Konfirmasi Password Baru</Form.Label>

                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                        value={password.confirm_password}
                        onChange={(event) =>
                          updatePassword("confirm_password", event.target.value)
                        }
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex justify-content-end mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingPassword}
                  >
                    {savingPassword ? "Memperbarui..." : "Ubah Password"}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </div>
      )}
    </div>
  );
}
