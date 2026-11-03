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

type WorkOrder = {
  id: string;
  number: string;
  maintenance_id: string;
  asset_code: string;
  asset_name: string;
  reporter_name: string;
  technician_id: string;
  technician_name: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  start_date: string;
  due_date: string;
  started_at: string;
  completed_at: string;
  closed_at: string;
  completion_notes: string;
  verification_note: string;
  final_condition: string;
  created_at: string;
  can_start: boolean;
  can_complete: boolean;
  can_close: boolean;
};

type MaintenanceOption = {
  id: string;
  asset_code: string;
  asset_name: string;
  priority: string;
};

type Technician = {
  id: string;
  name: string;
};

type Options = {
  can_create: boolean;
  requests: MaintenanceOption[];
  technicians: Technician[];
};

type ListResponse = {
  data: WorkOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

type Action = "start" | "complete" | "close";

const statuses: Record<string, string> = {
  ASSIGNED: "Ditugaskan",
  IN_PROGRESS: "Dikerjakan",
  COMPLETED: "Menunggu Verifikasi",
  CLOSED: "Ditutup",
};

const statusColors: Record<string, string> = {
  ASSIGNED: "primary",
  IN_PROGRESS: "info",
  COMPLETED: "warning",
  CLOSED: "success",
};

const priorities: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/work-orders${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ?? `Permintaan gagal (HTTP ${response.status})`,
    );
  }

  return data as T;
}

function blurActive() {
  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function WorkOrderManager() {
  const [data, setData] = useState<WorkOrder[]>([]);

  const [options, setOptions] = useState<Options>({
    can_create: false,
    requests: [],
    technicians: [],
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<WorkOrder | null>(null);

  const [action, setAction] = useState<{
    item: WorkOrder;
    kind: Action;
  } | null>(null);

  const [maintenanceID, setMaintenanceID] = useState("");
  const [technicianID, setTechnicianID] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [condition, setCondition] = useState("GOOD");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const params = new URLSearchParams({
      page: String(page),
      q: query,
      status,
    });

    Promise.all([
      request<ListResponse>(`?${params}`, {
        signal: controller.signal,
      }),
      request<Options>("/options", {
        signal: controller.signal,
      }),
    ])
      .then(([list, available]) => {
        if (!active) return;

        setData(list.data ?? []);
        setTotal(list.pagination?.total ?? 0);
        setOptions(available);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Gagal memuat Work Orders",
        );
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
  }, [page, query, status, revision]);

  function reload() {
    setLoading(true);
    setRevision((current) => current + 1);
  }

  function openCreate() {
    blurActive();

    setMaintenanceID("");
    setTechnicianID("");
    setTitle("");
    setDescription("");
    setStartDate("");
    setDueDate("");
    setModalError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) return;

    blurActive();
    setShowCreate(false);
  }

  function openAction(item: WorkOrder, kind: Action) {
    blurActive();

    setAction({ item, kind });
    setNotes("");
    setCondition("GOOD");
    setModalError("");
  }

  function closeAction() {
    if (saving) return;

    blurActive();
    setAction(null);
  }

  async function create() {
    if (saving) return;

    if (
      !maintenanceID ||
      !technicianID ||
      title.trim().length < 5 ||
      !startDate ||
      !dueDate ||
      dueDate < startDate
    ) {
      setModalError(
        "Pilih laporan, teknisi, judul minimal 5 karakter, dan tanggal yang valid.",
      );
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await request("", {
        method: "POST",
        body: JSON.stringify({
          maintenance_id: maintenanceID,
          technician_id: technicianID,
          title: title.trim(),
          description: description.trim(),
          start_date: startDate,
          due_date: dueDate,
        }),
      });

      blurActive();
      setShowCreate(false);
      setNotice("Work Order berhasil dibuat.");
      setPage(1);
      reload();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal membuat Work Order",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitAction() {
    if (!action || saving) return;

    if (action.kind !== "start" && notes.trim().length < 10) {
      setModalError("Catatan minimal 10 karakter.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      const body =
        action.kind === "complete"
          ? { notes: notes.trim() }
          : action.kind === "close"
            ? {
                note: notes.trim(),
                condition,
              }
            : {};

      await request(`/${action.item.id}/${action.kind}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      blurActive();
      setAction(null);

      setNotice(
        action.kind === "start"
          ? "Pekerjaan dimulai."
          : action.kind === "complete"
            ? "Hasil pekerjaan dikirim."
            : "Work Order berhasil ditutup.",
      );

      reload();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal memproses Work Order",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderActions(item: WorkOrder) {
    return (
      <div className="d-flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            blurActive();
            setDetail(item);
          }}
        >
          Detail
        </Button>

        {item.can_start && (
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => openAction(item, "start")}
          >
            Mulai
          </Button>
        )}

        {item.can_complete && (
          <Button
            size="sm"
            variant="outline-success"
            onClick={() => openAction(item, "complete")}
          >
            Selesaikan
          </Button>
        )}

        {item.can_close && (
          <Button
            size="sm"
            variant="outline-success"
            onClick={() => openAction(item, "close")}
          >
            Verifikasi
          </Button>
        )}
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Work Orders</h1>
          <p className="text-body-secondary mb-0">
            Penugasan teknisi dan tindak lanjut laporan Maintenance
          </p>
        </div>

        {options.can_create && (
          <Button onClick={openCreate}>+ Buat Work Order</Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex align-items-center justify-content-between">
          <strong>Riwayat Work Orders</strong>
          <Badge bg="primary">{total} data</Badge>
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
              aria-label="Cari Work Order"
              placeholder="Cari nomor WO, aset, teknisi..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: "1 1 200px" }}
            />

            <Form.Select
              aria-label="Filter status"
              value={status}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setStatus(event.target.value);
              }}
              style={{ width: "auto" }}
            >
              <option value="">Semua Status</option>

              {Object.entries(statuses).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
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
              Memuat Work Orders...
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-body-secondary py-4">
              Belum ada Work Order.
            </p>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table hover responsive className="align-middle">
                  <thead>
                    <tr>
                      <th>Nomor</th>
                      <th>Aset / Pekerjaan</th>
                      <th>Teknisi</th>
                      <th>Prioritas</th>
                      <th>Status</th>
                      <th>Target</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.map((item) => (
                      <tr key={item.id}>
                        <td>{item.number}</td>

                        <td>
                          <strong>{item.title}</strong>
                          <div className="small text-body-secondary">
                            {item.asset_code} — {item.asset_name}
                          </div>
                        </td>

                        <td>{item.technician_name}</td>

                        <td>{priorities[item.priority] ?? item.priority}</td>

                        <td>
                          <Badge bg={statusColors[item.status] ?? "secondary"}>
                            {statuses[item.status] ?? item.status}
                          </Badge>
                        </td>

                        <td>{item.due_date}</td>

                        <td>{renderActions(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-lg-none d-grid gap-3">
                {data.map((item) => (
                  <Card key={item.id}>
                    <Card.Body>
                      <div className="small text-body-secondary">
                        {item.number} · {item.asset_code}
                      </div>

                      <h2 className="h6 mt-1">{item.title}</h2>

                      <div className="small mb-1">{item.asset_name}</div>

                      <div className="small mb-1">
                        Teknisi: {item.technician_name}
                      </div>

                      <div className="small mb-2">Target: {item.due_date}</div>

                      <Badge
                        bg={statusColors[item.status] ?? "secondary"}
                        className="mb-3"
                      >
                        {statuses[item.status] ?? item.status}
                      </Badge>

                      {renderActions(item)}
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

      <Modal show={showCreate} onHide={closeCreate} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Buat Work Order</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Laporan Maintenance Disetujui</Form.Label>

            <Form.Select
              value={maintenanceID}
              disabled={saving}
              onChange={(event) => setMaintenanceID(event.target.value)}
            >
              <option value="">Pilih laporan</option>

              {options.requests.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.asset_code} — {item.asset_name}
                  {" ("}
                  {priorities[item.priority] ?? item.priority}
                  {")"}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Teknisi</Form.Label>

            <Form.Select
              value={technicianID}
              disabled={saving}
              onChange={(event) => setTechnicianID(event.target.value)}
            >
              <option value="">Pilih teknisi</option>

              {options.technicians.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Judul Pekerjaan</Form.Label>

            <Form.Control
              maxLength={160}
              value={title}
              disabled={saving}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Perbaikan perangkat..."
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Instruksi Kerja</Form.Label>

            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Form.Group>

          <div className="row g-3">
            <div className="col-12 col-sm-6">
              <Form.Group>
                <Form.Label>Tanggal Mulai Rencana</Form.Label>

                <Form.Control
                  type="date"
                  value={startDate}
                  disabled={saving}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Form.Group>
            </div>

            <div className="col-12 col-sm-6">
              <Form.Group>
                <Form.Label>Target Selesai</Form.Label>

                <Form.Control
                  type="date"
                  value={dueDate}
                  min={startDate || undefined}
                  disabled={saving}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </Form.Group>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={closeCreate}
          >
            Batal
          </Button>

          <Button
            disabled={
              saving ||
              !maintenanceID ||
              !technicianID ||
              title.trim().length < 5 ||
              !startDate ||
              !dueDate ||
              dueDate < startDate
            }
            onClick={() => void create()}
          >
            {saving ? "Menyimpan..." : "Simpan Work Order"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={action !== null} onHide={closeAction} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {action?.kind === "start"
              ? "Mulai Pekerjaan"
              : action?.kind === "complete"
                ? "Selesaikan Pekerjaan"
                : "Verifikasi & Tutup"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <p className="mb-3">
            {action?.item.number} — {action?.item.title}
          </p>

          {action?.kind === "start" ? (
            <Alert variant="warning" className="mb-0">
              Aset harus berstatus Tersedia dan tidak memiliki penugasan aktif.
              Setelah dimulai, status aset menjadi Maintenance.
            </Alert>
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>
                  {action?.kind === "complete"
                    ? "Hasil Pekerjaan"
                    : "Catatan Verifikasi"}
                </Form.Label>

                <Form.Control
                  as="textarea"
                  rows={4}
                  maxLength={action?.kind === "complete" ? 2000 : 1000}
                  value={notes}
                  disabled={saving}
                  onChange={(event) => setNotes(event.target.value)}
                />

                <Form.Text muted>Minimal 10 karakter.</Form.Text>
              </Form.Group>

              {action?.kind === "close" && (
                <Form.Group>
                  <Form.Label>Kondisi Aset Setelah Perbaikan</Form.Label>

                  <Form.Select
                    value={condition}
                    disabled={saving}
                    onChange={(event) => setCondition(event.target.value)}
                  >
                    <option value="GOOD">Baik</option>
                    <option value="FAIR">Cukup</option>
                  </Form.Select>
                </Form.Group>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={closeAction}
          >
            Batal
          </Button>

          <Button
            disabled={
              saving || (action?.kind !== "start" && notes.trim().length < 10)
            }
            onClick={() => void submitAction()}
          >
            {saving ? "Memproses..." : "Konfirmasi"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={detail !== null}
        onHide={() => {
          blurActive();
          setDetail(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Detail Work Order</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            <strong>Nomor:</strong> {detail?.number}
          </p>

          <p>
            <strong>Aset:</strong> {detail?.asset_code}
            {" — "}
            {detail?.asset_name}
          </p>

          <p>
            <strong>Pelapor:</strong> {detail?.reporter_name}
          </p>

          <p>
            <strong>Teknisi:</strong> {detail?.technician_name}
          </p>

          <p>
            <strong>Prioritas:</strong>{" "}
            {detail ? (priorities[detail.priority] ?? detail.priority) : ""}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {detail ? (statuses[detail.status] ?? detail.status) : ""}
          </p>

          <p>
            <strong>Jadwal:</strong> {detail?.start_date} sampai{" "}
            {detail?.due_date}
          </p>

          <p>
            <strong>Dibuat:</strong>{" "}
            {detail ? formatDate(detail.created_at) : ""}
          </p>

          <strong>Instruksi Kerja</strong>

          <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>
            {detail?.description || "-"}
          </p>

          {detail?.completion_notes && (
            <>
              <strong>Hasil Pekerjaan</strong>

              <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                {detail.completion_notes}
              </p>
            </>
          )}

          {detail?.verification_note && (
            <>
              <strong>Catatan Verifikasi</strong>

              <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                {detail.verification_note}
              </p>
            </>
          )}

          {detail?.final_condition && (
            <p>
              <strong>Kondisi Akhir:</strong>{" "}
              {detail.final_condition === "GOOD" ? "Baik" : "Cukup"}
            </p>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              blurActive();
              setDetail(null);
            }}
          >
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
