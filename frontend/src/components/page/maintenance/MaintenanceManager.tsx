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

type Item = {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  reporter_name: string;
  description: string;
  priority: string;
  status: string;
  review_note: string;
  created_at: string;
  can_review: boolean;
};

type Asset = {
  id: string;
  code: string;
  name: string;
};

type MaintenanceList = {
  data: Item[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
};

type MaintenanceOptions = {
  assets: Asset[];
};

const priorities: Record<string, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
  CRITICAL: "Kritis",
};

const statuses: Record<string, string> = {
  REPORTED: "Dilaporkan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  IN_PROGRESS: "Dikerjakan",
  COMPLETED: "Selesai",
  CLOSED: "Ditutup",
};

const colors: Record<string, string> = {
  REPORTED: "warning",
  APPROVED: "primary",
  REJECTED: "danger",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CLOSED: "secondary",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/maintenance${path}`, {
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
      body?.message || `Permintaan gagal (HTTP ${response.status})`,
    );
  }

  return body as T;
}

function blurActiveElement() {
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

export default function MaintenanceManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");

  const [review, setReview] = useState<Item | null>(null);
  const [decision, setDecision] = useState("APPROVED");
  const [note, setNote] = useState("");

  const [detail, setDetail] = useState<Item | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const params = new URLSearchParams({
      page: String(page),
      q: query,
      status,
    });

    Promise.all([
      api<MaintenanceList>(`?${params.toString()}`, {
        signal: controller.signal,
      }),
      api<MaintenanceOptions>("/options", {
        signal: controller.signal,
      }),
    ])
      .then(([list, options]) => {
        if (!active) return;

        setItems(list.data ?? []);
        setTotal(list.pagination?.total ?? 0);
        setAssets(options.assets ?? []);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;

        setError(
          err instanceof Error ? err.message : "Gagal memuat data Maintenance.",
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

  function changePage(nextPage: number) {
    setLoading(true);
    setPage(nextPage);
  }

  function changeStatus(nextStatus: string) {
    setLoading(true);
    setPage(1);
    setStatus(nextStatus);
  }

  function applySearch() {
    setLoading(true);
    setPage(1);
    setQuery(search.trim());
    setRevision((current) => current + 1);
  }

  function openCreate() {
    blurActiveElement();

    setSelected("");
    setPriority("MEDIUM");
    setDescription("");
    setModalError("");
    setShowCreate(true);
  }

  function closeCreate() {
    if (saving) return;

    blurActiveElement();
    setModalError("");
    setShowCreate(false);
  }

  function openReview(item: Item, value: string) {
    blurActiveElement();

    setReview(item);
    setDecision(value);
    setNote("");
    setModalError("");
  }

  function closeReview() {
    if (saving) return;

    blurActiveElement();
    setModalError("");
    setReview(null);
  }

  function openDetail(item: Item) {
    blurActiveElement();
    setDetail(item);
  }

  function closeDetail() {
    blurActiveElement();
    setDetail(null);
  }

  async function create() {
    if (saving) return;

    if (!selected || description.trim().length < 10) {
      setModalError("Pilih aset dan isi deskripsi minimal 10 karakter.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await api<{ message: string }>("", {
        method: "POST",
        body: JSON.stringify({
          asset_id: selected,
          priority,
          description: description.trim(),
        }),
      });

      blurActiveElement();
      setShowCreate(false);
      setNotice("Laporan berhasil dibuat.");
      setPage(1);
      reload();
    } catch (err) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Gagal membuat laporan Maintenance.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReview() {
    if (!review || saving) return;

    if (decision === "REJECTED" && note.trim().length < 10) {
      setModalError("Alasan penolakan minimal 10 karakter.");
      return;
    }

    setSaving(true);
    setModalError("");

    try {
      await api<{ message: string }>(`/${review.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          note: note.trim(),
        }),
      });

      blurActiveElement();
      setReview(null);
      setNotice("Keputusan berhasil disimpan.");
      reload();
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Gagal memverifikasi laporan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderActions(item: Item) {
    return (
      <div className="d-flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => openDetail(item)}
        >
          Detail
        </Button>

        {item.can_review && (
          <>
            <Button
              size="sm"
              variant="outline-success"
              onClick={() => openReview(item, "APPROVED")}
            >
              Setujui
            </Button>

            <Button
              size="sm"
              variant="outline-danger"
              onClick={() => openReview(item, "REJECTED")}
            >
              Tolak
            </Button>
          </>
        )}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Maintenance Aset</h1>

          <p className="text-body-secondary mb-0">
            Pelaporan kerusakan dan verifikasi pemeliharaan
          </p>
        </div>

        <Button onClick={openCreate}>+ Laporkan Kerusakan</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Riwayat Maintenance</strong>

          <Badge bg="primary">{total} data</Badge>
        </Card.Header>

        <Card.Body>
          <Form
            className="d-flex flex-wrap gap-2 mb-4"
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <Form.Control
              value={search}
              aria-label="Cari aset atau pelapor"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari aset atau pelapor..."
              style={{ flex: "1 1 180px" }}
            />

            <Form.Select
              value={status}
              aria-label="Filter status"
              onChange={(event) => changeStatus(event.target.value)}
              style={{ width: "auto" }}
            >
              <option value="">Semua Status</option>

              {Object.entries(statuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
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
              Memuat laporan...
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-body-secondary py-4">
              Belum ada laporan.
            </p>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table hover responsive className="align-middle">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Aset</th>
                      <th>Pelapor</th>
                      <th>Prioritas</th>
                      <th>Status</th>
                      <th>Tanggal</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(page - 1) * 10 + index + 1}</td>

                        <td>
                          <strong>{item.asset_name}</strong>

                          <div className="small text-body-secondary">
                            {item.asset_code}
                          </div>
                        </td>

                        <td>{item.reporter_name}</td>

                        <td>{priorities[item.priority] ?? item.priority}</td>

                        <td>
                          <Badge bg={colors[item.status] ?? "secondary"}>
                            {statuses[item.status] ?? item.status}
                          </Badge>
                        </td>

                        <td>{formatDate(item.created_at)}</td>

                        <td>{renderActions(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-lg-none d-grid gap-3">
                {items.map((item) => (
                  <Card key={item.id}>
                    <Card.Body>
                      <small className="text-body-secondary">
                        {item.asset_code}
                      </small>

                      <h2 className="h6 mt-1">{item.asset_name}</h2>

                      <div className="small mb-1">
                        Pelapor: {item.reporter_name}
                      </div>

                      <div className="small mb-2">
                        Prioritas: {priorities[item.priority] ?? item.priority}
                      </div>

                      <Badge bg={colors[item.status] ?? "secondary"}>
                        {statuses[item.status] ?? item.status}
                      </Badge>

                      <div className="small text-body-secondary my-2">
                        {formatDate(item.created_at)}
                      </div>

                      {renderActions(item)}
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </>
          )}

          <div className="d-flex justify-content-between align-items-center gap-2 mt-3">
            <small>
              Halaman {page} dari {totalPages}
            </small>

            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
              >
                Sebelumnya
              </Button>

              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => changePage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showCreate} onHide={closeCreate} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Laporkan Kerusakan</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <Form.Group className="mb-3">
            <Form.Label>Aset</Form.Label>

            <Form.Select
              value={selected}
              disabled={saving}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Pilih Aset</option>

              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.code} — {asset.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Prioritas</Form.Label>

            <Form.Select
              value={priority}
              disabled={saving}
              onChange={(event) => setPriority(event.target.value)}
            >
              {Object.entries(priorities).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label>Deskripsi Kerusakan</Form.Label>

            <Form.Control
              as="textarea"
              rows={4}
              maxLength={2000}
              value={description}
              disabled={saving}
              onChange={(event) => setDescription(event.target.value)}
            />

            <Form.Text muted>Minimal 10 karakter.</Form.Text>
          </Form.Group>
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
            disabled={saving || !selected || description.trim().length < 10}
            onClick={() => void create()}
          >
            {saving ? "Menyimpan..." : "Kirim Laporan"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={review !== null} onHide={closeReview} centered>
        <Modal.Header closeButton={!saving}>
          <Modal.Title>Verifikasi Maintenance</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {modalError && <Alert variant="danger">{modalError}</Alert>}

          <p>
            {review?.asset_code} — {review?.asset_name}
          </p>

          <Form.Group className="mb-3">
            <Form.Label>Keputusan</Form.Label>

            <Form.Select
              value={decision}
              disabled={saving}
              onChange={(event) => setDecision(event.target.value)}
            >
              <option value="APPROVED">Setujui</option>

              <option value="REJECTED">Tolak</option>
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label>Catatan</Form.Label>

            <Form.Control
              as="textarea"
              rows={3}
              maxLength={1000}
              value={note}
              disabled={saving}
              onChange={(event) => setNote(event.target.value)}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            disabled={saving}
            onClick={closeReview}
          >
            Batal
          </Button>

          <Button
            disabled={
              saving || (decision === "REJECTED" && note.trim().length < 10)
            }
            onClick={() => void submitReview()}
          >
            Simpan Keputusan
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={detail !== null} onHide={closeDetail} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detail Maintenance</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            <strong>Aset: </strong>
            {detail?.asset_code} — {detail?.asset_name}
          </p>

          <p>
            <strong>Pelapor: </strong>
            {detail?.reporter_name}
          </p>

          <p>
            <strong>Status: </strong>
            {detail ? (statuses[detail.status] ?? detail.status) : ""}
          </p>

          <p>
            <strong>Prioritas: </strong>
            {detail ? (priorities[detail.priority] ?? detail.priority) : ""}
          </p>

          <strong>Deskripsi Kerusakan:</strong>

          <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>
            {detail?.description}
          </p>

          {detail?.review_note && (
            <>
              <strong>Catatan Verifikasi:</strong>

              <p className="text-break" style={{ whiteSpace: "pre-wrap" }}>
                {detail.review_note}
              </p>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeDetail}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
