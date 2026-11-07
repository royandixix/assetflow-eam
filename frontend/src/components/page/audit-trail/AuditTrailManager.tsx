"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

type AuditEntry = {
  id: number;
  actor_id: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource: string;
  resource_id: string;
  method: string;
  route: string;
  http_status: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
};

type AuditResponse = {
  data: AuditEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  message?: string;
};

type Filters = {
  q: string;
  action: string;
  resource: string;
  from: string;
  to: string;
};

const emptyFilters: Filters = {
  q: "",
  action: "",
  resource: "",
  from: "",
  to: "",
};

const actionLabels: Record<string, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  INVITE: "Undang",
  START: "Mulai",
  COMPLETE: "Selesai",
  CLOSE: "Tutup",
  APPROVE: "Setujui",
  REJECT: "Tolak",
  CANCEL: "Batalkan",
  RETURN: "Kembalikan",
  REVIEW: "Tinjau",
  IMAGE_CHANGE: "Ubah Gambar",
};

const resourceLabels: Record<string, string> = {
  assets: "Aset",
  "asset-categories": "Kategori Aset",
  "asset-assignments": "Penugasan Aset",
  "asset-transfers": "Mutasi Aset",
  "maintenance-requests": "Permintaan Maintenance",
  "work-orders": "Work Orders",
  departments: "Departemen",
  locations: "Lokasi",
  vendors: "Vendor",
  users: "Pengguna & Role",
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ASSET_ADMIN: "Asset Admin",
  MANAGER: "Manager",
  TECHNICIAN: "Technician",
  STAFF: "Staff",
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Makassar",
  });
}

function actionColor(action: string): string {
  if (["CREATE", "INVITE"].includes(action)) {
    return "success";
  }

  if (["DELETE", "CANCEL", "REJECT"].includes(action)) {
    return "danger";
  }

  if (["COMPLETE", "CLOSE", "APPROVE"].includes(action)) {
    return "primary";
  }

  return "info";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Gagal memuat riwayat Audit Trail";
}

export default function AuditTrailManager() {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AuditEntry | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);

      const params = new URLSearchParams({
        page: String(page),
        ...filters,
      });

      try {
        const response = await fetch(
          `/api/audit-trail?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result =
          (await response.json()) as AuditResponse;

        if (!response.ok) {
          throw new Error(
            result.message ??
              `Gagal memuat aktivitas (HTTP ${response.status})`,
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        setEntries(
          Array.isArray(result.data) ? result.data : [],
        );
        setTotal(result.pagination?.total ?? 0);
        setError("");
      } catch (err: unknown) {
        if (controller.signal.aborted) {
          return;
        }

        setEntries([]);
        setTotal(0);
        setError(getErrorMessage(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [page, filters, revision]);

  function updateDraft(name: keyof Filters, value: string) {
    setDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPage(1);
    setFilters({
      ...draft,
      q: draft.q.trim(),
    });
    setRevision((current) => current + 1);
  }

  function resetFilters() {
    setDraft({ ...emptyFilters });
    setFilters({ ...emptyFilters });
    setPage(1);
    setRevision((current) => current + 1);
  }

  function refresh() {
    setRevision((current) => current + 1);
  }

  const limit = 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Audit Trail</h1>
          <p className="text-body-secondary mb-0">
            Riwayat aktivitas dan perubahan data AssetFlow EAM.
          </p>
        </div>

        <Button
          variant="outline-primary"
          onClick={refresh}
          disabled={loading}
        >
          Muat Ulang
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Riwayat Aktivitas</strong>
          <Badge bg="primary">
            {total.toLocaleString("id-ID")} aktivitas
          </Badge>
        </Card.Header>

        <Card.Body>
          <Form onSubmit={submitFilters} className="mb-4">
            <Row className="g-3 align-items-end">
              <Col xs={12} lg={4}>
                <Form.Label>Cari Aktivitas</Form.Label>
                <Form.Control
                  value={draft.q}
                  placeholder="Nama, email, ID target..."
                  onChange={(event) =>
                    updateDraft("q", event.target.value)
                  }
                />
              </Col>

              <Col xs={12} sm={6} lg={4}>
                <Form.Label>Tindakan</Form.Label>
                <Form.Select
                  value={draft.action}
                  onChange={(event) =>
                    updateDraft("action", event.target.value)
                  }
                >
                  <option value="">Semua Tindakan</option>
                  {Object.entries(actionLabels).map(
                    ([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ),
                  )}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} lg={4}>
                <Form.Label>Modul</Form.Label>
                <Form.Select
                  value={draft.resource}
                  onChange={(event) =>
                    updateDraft("resource", event.target.value)
                  }
                >
                  <option value="">Semua Modul</option>
                  {Object.entries(resourceLabels).map(
                    ([code, label]) => (
                      <option value={code} key={code}>
                        {label}
                      </option>
                    ),
                  )}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label>Dari Tanggal (WITA)</Form.Label>
                <Form.Control
                  type="date"
                  value={draft.from}
                  onChange={(event) =>
                    updateDraft("from", event.target.value)
                  }
                />
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label>Sampai Tanggal (WITA)</Form.Label>
                <Form.Control
                  type="date"
                  value={draft.to}
                  onChange={(event) =>
                    updateDraft("to", event.target.value)
                  }
                />
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Button type="submit" className="w-100">
                  Terapkan Filter
                </Button>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Button
                  type="button"
                  variant="outline-secondary"
                  className="w-100"
                  onClick={resetFilters}
                >
                  Reset Filter
                </Button>
              </Col>
            </Row>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" />
              <p className="text-body-secondary mt-3">
                Memuat aktivitas...
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-5">
              <h5>Belum ada aktivitas</h5>
              <p className="text-body-secondary mb-0">
                Aktivitas baru akan tampil setelah pencatatan
                Audit Trail aktif dan perubahan data berhasil.
              </p>
            </div>
          ) : (
            <Table responsive hover className="align-middle">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Role</th>
                  <th>Tindakan</th>
                  <th>Modul</th>
                  <th>Target</th>
                  <th>Detail</th>
                </tr>
              </thead>

              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="small text-nowrap">
                      {formatDate(entry.created_at)}
                    </td>

                    <td>
                      <strong>{entry.actor_name || "-"}</strong>
                      <div className="small text-body-secondary text-break">
                        {entry.actor_email}
                      </div>
                    </td>

                    <td className="small">
                      {roleLabels[entry.actor_role] ??
                        entry.actor_role}
                    </td>

                    <td>
                      <Badge bg={actionColor(entry.action)}>
                        {actionLabels[entry.action] ??
                          entry.action}
                      </Badge>
                    </td>

                    <td>
                      {resourceLabels[entry.resource] ??
                        entry.resource}
                    </td>

                    <td className="small text-break">
                      {entry.resource_id || "-"}
                    </td>

                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => setSelected(entry)}
                      >
                        Lihat
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
            <small className="text-body-secondary">
              Halaman {page} dari {totalPages}
            </small>

            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Sebelumnya
              </Button>

              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={selected !== null}
        onHide={() => setSelected(null)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Detail Audit Trail</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selected && (
            <Table borderless className="mb-0">
              <tbody>
                {[
                  ["Waktu", formatDate(selected.created_at)],
                  ["Nama", selected.actor_name],
                  ["Email", selected.actor_email],
                  [
                    "Role",
                    roleLabels[selected.actor_role] ??
                      selected.actor_role,
                  ],
                  [
                    "Tindakan",
                    actionLabels[selected.action] ??
                      selected.action,
                  ],
                  [
                    "Modul",
                    resourceLabels[selected.resource] ??
                      selected.resource,
                  ],
                  ["ID Target", selected.resource_id],
                  ["Metode", selected.method],
                  ["Endpoint", selected.route],
                  ["HTTP Status", String(selected.http_status)],
                  ["IP Address", selected.ip_address],
                  ["Browser", selected.user_agent],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <th className="text-nowrap">{label}</th>
                    <td className="text-break">{value || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => setSelected(null)}
          >
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
