"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Modal,
  Spinner,
  Table,
} from "react-bootstrap";

type User = {
  id: string;
  full_name: string;
  email: string;
  role_code: string;
  is_active: boolean;
  created_at: string;
};

type ListResponse = {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const roles: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ASSET_ADMIN: "Asset Admin",
  MANAGER: "Manager",
  TECHNICIAN: "Technician",
  STAFF: "Staff",
};

const operationalRoles = Object.entries(roles).filter(
  ([key]) => key !== "SUPER_ADMIN",
);

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/users${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      body?.message ?? `Permintaan gagal (HTTP ${response.status})`,
    );
  }

  return body as T;
}

function blurActive() {
  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [revision, setRevision] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("TECHNICIAN");

  const [editing, setEditing] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("STAFF");
  const [editActive, setEditActive] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const params = new URLSearchParams({
      page: String(page),
      q: query,
      role: roleFilter,
      state: stateFilter,
    });

    api<ListResponse>(`?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!active) return;

        setUsers(result.data ?? []);
        setTotal(result.pagination?.total ?? 0);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Gagal memuat pengguna");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [page, query, roleFilter, stateFilter, revision]);

  function reload() {
    setLoading(true);
    setRevision((current) => current + 1);
  }

  function openInvite() {
    blurActive();

    setInviteName("");
    setInviteEmail("");
    setInviteRole("TECHNICIAN");
    setModalError("");
    setShowInvite(true);
  }

  function openEdit(user: User) {
    if (user.role_code === "SUPER_ADMIN") {
      return;
    }

    blurActive();

    setEditing(user);
    setEditName(user.full_name);
    setEditRole(user.role_code);
    setEditActive(user.is_active);
    setModalError("");
  }

  async function sendInvite() {
    if (saving) return;

    if (inviteName.trim().length < 3 || !inviteEmail.includes("@")) {
      setModalError(
        "Masukkan nama minimal 3 karakter dan alamat email yang valid.",
      );
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await api("/invite", {
        method: "POST",
        body: JSON.stringify({
          full_name: inviteName.trim(),
          email: inviteEmail.trim().toLowerCase(),
          role_code: inviteRole,
        }),
      });

      blurActive();
      setShowInvite(false);

      setNotice(
        "Undangan berhasil dikirim. Pengguna perlu menerima email dan menyiapkan password.",
      );

      setPage(1);
      reload();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal mengirim undangan",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing || saving) return;

    if (editName.trim().length < 3) {
      setModalError("Nama minimal 3 karakter.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await api(`/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editName.trim(),
          role_code: editRole,
          is_active: editActive,
        }),
      });

      blurActive();
      setEditing(null);

      setNotice("Data pengguna berhasil diperbarui.");
      reload();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal memperbarui pengguna",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderUser(user: User) {
    return (
      <div>
        <strong>{user.full_name}</strong>

        <div className="small text-body-secondary text-break">{user.email}</div>
      </div>
    );
  }

  function renderActions(user: User) {
    if (user.role_code === "SUPER_ADMIN") {
      return <small className="text-body-secondary">Dilindungi</small>;
    }

    return (
      <Button
        size="sm"
        variant="outline-primary"
        onClick={() => openEdit(user)}
      >
        Edit
      </Button>
    );
  }

  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Pengguna &amp; Role</h1>

          <p className="text-body-secondary mb-0">
            Pengelolaan pengguna dan hak akses AssetFlow EAM
          </p>
        </div>

        <Button onClick={openInvite}>+ Undang Pengguna</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex align-items-center justify-content-between">
          <strong>Daftar Pengguna</strong>

          <Badge bg="primary">{total} pengguna</Badge>
        </Card.Header>

        <Card.Body>
          <Form
            className="d-flex flex-wrap gap-2 mb-4"
            onSubmit={(event) => {
              event.preventDefault();

              setLoading(true);
              setPage(1);
              setQuery(search.trim());
              setRevision((current) => current + 1);
            }}
          >
            <Form.Control
              aria-label="Cari pengguna"
              placeholder="Cari nama atau email..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: "1 1 180px" }}
            />

            <Form.Select
              aria-label="Filter role"
              value={roleFilter}
              style={{ width: "auto" }}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setRoleFilter(event.target.value);
              }}
            >
              <option value="">Semua Role</option>

              {Object.entries(roles).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Form.Select>

            <Form.Select
              aria-label="Filter status"
              value={stateFilter}
              style={{ width: "auto" }}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setStateFilter(event.target.value);
              }}
            >
              <option value="">Semua Status</option>

              <option value="active">Aktif</option>

              <option value="inactive">Nonaktif</option>
            </Form.Select>

            <Button type="submit" variant="outline-primary">
              Cari
            </Button>

            <Button type="button" variant="outline-secondary" onClick={reload}>
              Muat Ulang
            </Button>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" className="me-2" />
              Memuat pengguna...
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-body-secondary py-4">
              Tidak ada pengguna.
            </p>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table hover responsive className="align-middle">
                  <thead>
                    <tr>
                      <th>Pengguna</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Terdaftar</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{renderUser(user)}</td>

                        <td>{roles[user.role_code] ?? user.role_code}</td>

                        <td>
                          <Badge bg={user.is_active ? "success" : "secondary"}>
                            {user.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </td>

                        <td>
                          {new Date(user.created_at).toLocaleDateString(
                            "id-ID",
                          )}
                        </td>

                        <td>{renderActions(user)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-lg-none d-grid gap-3">
                {users.map((user) => (
                  <Card key={user.id}>
                    <Card.Body>
                      {renderUser(user)}

                      <div className="small my-2">
                        Role: {roles[user.role_code] ?? user.role_code}
                      </div>

                      <Badge
                        bg={user.is_active ? "success" : "secondary"}
                        className="mb-3"
                      >
                        {user.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>

                      <div>{renderActions(user)}</div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </>
          )}

          <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
            <small>
              Halaman {page} dari {pages}
            </small>

            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
              >
                Sebelumnya
              </Button>

              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= pages}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showInvite}
        onHide={() => {
          if (!saving) {
            blurActive();
            setShowInvite(false);
          }
        }}
        centered
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Undang Pengguna</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <Alert variant="info">
            Pengguna menerima tautan aktivasi melalui email dan membuat password
            sendiri.
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>Nama lengkap</Form.Label>

            <Form.Control
              value={inviteName}
              maxLength={120}
              disabled={saving}
              onChange={(event) => setInviteName(event.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email pengguna</Form.Label>

            <Form.Control
              type="email"
              autoComplete="off"
              value={inviteEmail}
              disabled={saving}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </Form.Group>

          <Form.Group>
            <Form.Label>Role</Form.Label>

            <Form.Select
              value={inviteRole}
              disabled={saving}
              onChange={(event) => setInviteRole(event.target.value)}
            >
              {operationalRoles.map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={() => {
              blurActive();
              setShowInvite(false);
            }}
          >
            Batal
          </Button>

          <Button
            disabled={
              saving ||
              inviteName.trim().length < 3 ||
              !inviteEmail.includes("@")
            }
            onClick={() => void sendInvite()}
          >
            {saving ? "Mengirim..." : "Kirim Undangan"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={editing !== null}
        onHide={() => {
          if (!saving) {
            blurActive();
            setEditing(null);
          }
        }}
        centered
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Edit Pengguna</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <p className="small text-body-secondary text-break">
            {editing?.email}
          </p>

          <Form.Group className="mb-3">
            <Form.Label>Nama lengkap</Form.Label>

            <Form.Control
              maxLength={120}
              value={editName}
              disabled={saving}
              onChange={(event) => setEditName(event.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Role</Form.Label>

            <Form.Select
              value={editRole}
              disabled={saving}
              onChange={(event) => setEditRole(event.target.value)}
            >
              {operationalRoles.map(([code, label]) => (
                <option value={code} key={code}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Check
            type="switch"
            label="Pengguna aktif"
            checked={editActive}
            disabled={saving}
            onChange={(event) => setEditActive(event.target.checked)}
          />

          {!editActive && (
            <Alert variant="warning" className="mt-3 mb-0">
              Login pengguna ini akan diblokir oleh Supabase Auth.
            </Alert>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={() => {
              blurActive();
              setEditing(null);
            }}
          >
            Batal
          </Button>

          <Button
            disabled={saving || editName.trim().length < 3}
            onClick={() => void saveEdit()}
          >
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
