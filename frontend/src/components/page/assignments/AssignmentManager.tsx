"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Swal from "sweetalert2";
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

type Assignment = {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  assigned_to: string;
  employee_name: string;
  employee_email: string;
  assigned_at: string;
  expected_return_at: string;
  returned_at: string;
  condition_out: string;
  condition_in: string;
  notes: string;
  return_notes: string;
  created_at: string;
};

type Asset = {
  id: string;
  code: string;
  name: string;
  condition: string;
};

type Employee = {
  id: string;
  name: string;
  email: string;
};

type AssignForm = {
  asset_id: string;
  assigned_to: string;
  assigned_at: string;
  expected_return_at: string;
  notes: string;
};

type ReturnForm = {
  returned_at: string;
  condition_in: string;
  return_notes: string;
};

type OptionsResponse = {
  assets: Asset[];
  employees: Employee[];
};

type ListResponse = {
  data: Assignment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const conditions: Record<string, string> = {
  GOOD: "Baik",
  FAIR: "Cukup Baik",
  DAMAGED: "Rusak",
};

function today() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/assignments${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.message || `Permintaan gagal (HTTP ${response.status})`,
    );
  }

  return data as T;
}

function StatusBadge({ item }: { item: Assignment }) {
  return item.returned_at ? (
    <Badge bg="success">Dikembalikan</Badge>
  ) : (
    <Badge bg="primary">Aktif</Badge>
  );
}

function blurAssignmentFocus() {
  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
}

export default function AssignmentManager() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [revision, setRevision] = useState(0);

  const [showAssign, setShowAssign] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const [detail, setDetail] = useState<Assignment | null>(null);
  const [returnTarget, setReturnTarget] = useState<Assignment | null>(null);

  const [assignForm, setAssignForm] = useState<AssignForm>({
    asset_id: "",
    assigned_to: "",
    assigned_at: today(),
    expected_return_at: "",
    notes: "",
  });

  const [returnForm, setReturnForm] = useState<ReturnForm>({
    returned_at: today(),
    condition_in: "GOOD",
    return_notes: "",
  });

  const pendingAssign = useRef<AssignForm | null>(null);
  const pendingReturn = useRef<{
    id: string;
    input: ReturnForm;
  } | null>(null);

  useEffect(() => {
    let active = true;

    api<OptionsResponse>("/options")
      .then((result) => {
        if (!active) return;

        setAssets(result.assets ?? []);
        setEmployees(result.employees ?? []);
      })
      .catch((err: unknown) => {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil pilihan aset dan pegawai",
        );
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams({
      page: String(page),
      q: search,
      status,
    });

    api<ListResponse>(`?${params.toString()}`)
      .then((result) => {
        if (!active) return;

        setItems(result.data ?? []);
        setTotal(result.pagination.total);
        setLimit(result.pagination.limit);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setItems([]);
        setTotal(0);

        setError(
          err instanceof Error ? err.message : "Gagal mengambil data penugasan",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, search, status, revision]);

  function refresh() {
    setLoading(true);
    setOptionsLoading(true);
    setRevision((value) => value + 1);
  }

  function openAssign() {
    setAssignForm({
      asset_id: "",
      assigned_to: "",
      assigned_at: today(),
      expected_return_at: "",
      notes: "",
    });

    setFormError("");
    blurAssignmentFocus();
    setShowAssign(true);
  }

  function openReturn(item: Assignment) {
    setReturnTarget(item);

    setReturnForm({
      returned_at: today(),
      condition_in: conditions[item.condition_out]
        ? item.condition_out
        : "GOOD",
      return_notes: "",
    });

    setFormError("");
    blurAssignmentFocus();
    setShowReturn(true);
  }

  function submitAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!assignForm.asset_id || !assignForm.assigned_to) {
      setFormError("Aset dan pegawai wajib dipilih.");
      return;
    }

    if (
      !assignForm.assigned_at ||
      (assignForm.expected_return_at &&
        assignForm.expected_return_at < assignForm.assigned_at)
    ) {
      setFormError("Tanggal penugasan tidak valid.");
      return;
    }

    pendingAssign.current = {
      ...assignForm,
      notes: assignForm.notes.trim(),
    };

    setShowAssign(false);
  }

  function submitReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !returnTarget) return;

    if (
      !returnForm.returned_at ||
      returnForm.returned_at < returnTarget.assigned_at
    ) {
      setFormError("Tanggal pengembalian tidak valid.");
      return;
    }

    pendingReturn.current = {
      id: returnTarget.id,
      input: {
        ...returnForm,
        return_notes: returnForm.return_notes.trim(),
      },
    };

    setShowReturn(false);
  }

  async function confirmAssign(input: AssignForm) {
    blurAssignmentFocus();
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Penugasan",
      text: "Yakin ingin menugaskan aset ini kepada pegawai?",
      showCancelButton: true,
      confirmButtonText: "Ya, Tugaskan",
      cancelButtonText: "Batal",
      reverseButtons: true,
      returnFocus: false,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) {
      blurAssignmentFocus();
      setShowAssign(true);
      return;
    }

    setSaving(true);

    try {
      await api("", {
        method: "POST",
        body: JSON.stringify(input),
      });

      refresh();

      blurAssignmentFocus();
      await Swal.fire({
        icon: "success",
        title: "Penugasan Berhasil",
        text: "Aset berhasil ditugaskan.",
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menugaskan aset";

      setFormError(message);

      blurAssignmentFocus();
      await Swal.fire({
        icon: "error",
        title: "Penugasan Gagal",
        text: message,
        heightAuto: false,
      });

      blurAssignmentFocus();
      setShowAssign(true);
    } finally {
      setSaving(false);
    }
  }

  async function confirmReturn(request: { id: string; input: ReturnForm }) {
    blurAssignmentFocus();
    const confirmation = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Pengembalian",
      text: "Yakin ingin mengembalikan aset ini?",
      showCancelButton: true,
      confirmButtonText: "Ya, Kembalikan",
      cancelButtonText: "Batal",
      reverseButtons: true,
      returnFocus: false,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) {
      blurAssignmentFocus();
      setShowReturn(true);
      return;
    }

    setSaving(true);

    try {
      await api(`/${request.id}/return`, {
        method: "POST",
        body: JSON.stringify(request.input),
      });

      refresh();

      blurAssignmentFocus();
      await Swal.fire({
        icon: "success",
        title: "Pengembalian Berhasil",
        text: "Riwayat pengembalian berhasil dicatat.",
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal mengembalikan aset";

      setFormError(message);

      blurAssignmentFocus();
      await Swal.fire({
        icon: "error",
        title: "Pengembalian Gagal",
        text: message,
        heightAuto: false,
      });

      blurAssignmentFocus();
      setShowReturn(true);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Penugasan Aset</h1>
          <p className="text-body-secondary mb-0">
            Pengelolaan penyerahan dan pengembalian aset perusahaan
          </p>
        </div>

        <Button onClick={openAssign} disabled={saving || optionsLoading}>
          + Tugaskan Aset
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Riwayat Penugasan Aset</strong>
          <Badge bg="primary">{total} data</Badge>
        </Card.Header>

        <Card.Body>
          <Form
            className="d-flex flex-wrap gap-2 mb-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
              refresh();
            }}
          >
            <Form.Control
              type="search"
              placeholder="Cari aset atau pegawai..."
              style={{ flex: "1 1 200px" }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <Form.Select
              aria-label="Filter status penugasan"
              style={{ width: "auto", minWidth: 160 }}
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
                setLoading(true);
              }}
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="RETURNED">Dikembalikan</option>
            </Form.Select>

            <Button type="submit" variant="outline-primary">
              Cari
            </Button>

            <Button type="button" variant="outline-secondary" onClick={refresh}>
              Muat Ulang
            </Button>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" />
              <span className="ms-2">Memuat data...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              Belum ada penugasan aset.
            </div>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table responsive hover className="align-middle">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Kode Aset</th>
                      <th>Nama Aset</th>
                      <th>Pegawai</th>
                      <th>Tanggal Serah</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(page - 1) * limit + index + 1}</td>
                        <td>{item.asset_code}</td>
                        <td>{item.asset_name}</td>
                        <td>{item.employee_name}</td>
                        <td>{formatDate(item.assigned_at)}</td>

                        <td>
                          <StatusBadge item={item} />
                        </td>

                        <td>
                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => setDetail(item)}
                            >
                              Detail
                            </Button>

                            {!item.returned_at && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                disabled={saving}
                                onClick={() => openReturn(item)}
                              >
                                Kembalikan
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-lg-none">
                <Row xs={1} md={2} className="g-3">
                  {items.map((item, index) => (
                    <Col key={item.id}>
                      <Card className="h-100">
                        <Card.Body>
                          <small className="text-body-secondary">
                            No. {(page - 1) * limit + index + 1}
                          </small>

                          <h2 className="h6 mt-2">{item.asset_name}</h2>
                          <p className="small mb-1">{item.asset_code}</p>
                          <p className="small mb-1">
                            Pegawai: {item.employee_name}
                          </p>
                          <p className="small mb-2">
                            {formatDate(item.assigned_at)}
                          </p>

                          <div className="mb-3">
                            <StatusBadge item={item} />
                          </div>

                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-2"
                            onClick={() => setDetail(item)}
                          >
                            Detail
                          </Button>

                          {!item.returned_at && (
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openReturn(item)}
                            >
                              Kembalikan
                            </Button>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </>
          )}

          <div className="d-flex justify-content-between align-items-center mt-4 gap-2">
            <small className="text-body-secondary">
              Halaman {page} dari {totalPages}
            </small>

            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value - 1);
                }}
              >
                Sebelumnya
              </Button>

              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= totalPages}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value + 1);
                }}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showAssign}
        onHide={() => {
          if (!saving) setShowAssign(false);
        }}
        onExited={() => {
          const pending = pendingAssign.current;
          pendingAssign.current = null;

          if (pending) void confirmAssign(pending);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Tugaskan Aset</Modal.Title>
        </Modal.Header>

        <Form onSubmit={submitAssign}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Pilih Aset</Form.Label>

              <Form.Select
                required
                value={assignForm.asset_id}
                onChange={(event) =>
                  setAssignForm((current) => ({
                    ...current,
                    asset_id: event.target.value,
                  }))
                }
              >
                <option value="">Pilih aset tersedia</option>

                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} — {asset.name}
                  </option>
                ))}
              </Form.Select>

              {!optionsLoading && assets.length === 0 && (
                <Form.Text muted>Tidak ada aset tersedia.</Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Pegawai Penerima</Form.Label>

              <Form.Select
                required
                value={assignForm.assigned_to}
                onChange={(event) =>
                  setAssignForm((current) => ({
                    ...current,
                    assigned_to: event.target.value,
                  }))
                }
              >
                <option value="">Pilih pegawai aktif</option>

                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} ({employee.email})
                  </option>
                ))}
              </Form.Select>

              {!optionsLoading && employees.length === 0 && (
                <Form.Text muted>Belum ada akun pegawai aktif.</Form.Text>
              )}
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Tanggal Penyerahan</Form.Label>

                  <Form.Control
                    type="date"
                    required
                    value={assignForm.assigned_at}
                    onChange={(event) =>
                      setAssignForm((current) => ({
                        ...current,
                        assigned_at: event.target.value,
                      }))
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Perkiraan Kembali</Form.Label>

                  <Form.Control
                    type="date"
                    min={assignForm.assigned_at}
                    value={assignForm.expected_return_at}
                    onChange={(event) =>
                      setAssignForm((current) => ({
                        ...current,
                        expected_return_at: event.target.value,
                      }))
                    }
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Catatan</Form.Label>

              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={assignForm.notes}
                onChange={(event) =>
                  setAssignForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </Form.Group>

            {formError && <Alert variant="danger">{formError}</Alert>}
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowAssign(false)}
            >
              Batal
            </Button>

            <Button
              type="submit"
              disabled={
                saving ||
                optionsLoading ||
                assets.length === 0 ||
                employees.length === 0
              }
            >
              Simpan Penugasan
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={showReturn}
        onHide={() => {
          if (!saving) setShowReturn(false);
        }}
        onExited={() => {
          const pending = pendingReturn.current;
          pendingReturn.current = null;

          if (pending) void confirmReturn(pending);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Pengembalian Aset</Modal.Title>
        </Modal.Header>

        <Form onSubmit={submitReturn}>
          <Modal.Body>
            <p>
              <strong>
                {returnTarget?.asset_code} — {returnTarget?.asset_name}
              </strong>
            </p>

            <p className="small">Pegawai: {returnTarget?.employee_name}</p>

            <Form.Group className="mb-3">
              <Form.Label>Tanggal Pengembalian</Form.Label>

              <Form.Control
                type="date"
                required
                min={returnTarget?.assigned_at}
                value={returnForm.returned_at}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    returned_at: event.target.value,
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Kondisi Aset</Form.Label>

              <Form.Select
                value={returnForm.condition_in}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    condition_in: event.target.value,
                  }))
                }
              >
                {Object.entries(conditions).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Catatan Pengembalian</Form.Label>

              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={returnForm.return_notes}
                onChange={(event) =>
                  setReturnForm((current) => ({
                    ...current,
                    return_notes: event.target.value,
                  }))
                }
              />
            </Form.Group>

            {formError && <Alert variant="danger">{formError}</Alert>}
          </Modal.Body>

          <Modal.Footer>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowReturn(false)}
            >
              Batal
            </Button>

            <Button type="submit" disabled={saving}>
              Simpan Pengembalian
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={detail !== null} onHide={() => setDetail(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detail Penugasan</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detail && (
            <div className="d-flex flex-column gap-3">
              <div>
                <small className="text-body-secondary">Aset</small>
                <div>
                  <strong>
                    {detail.asset_code} — {detail.asset_name}
                  </strong>
                </div>
              </div>

              <div>
                <small className="text-body-secondary">Pegawai</small>
                <div>{detail.employee_name}</div>
                <div>{detail.employee_email}</div>
              </div>

              <div>
                <small className="text-body-secondary">Status</small>
                <div>
                  <StatusBadge item={detail} />
                </div>
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <small className="text-body-secondary">Penyerahan</small>
                  <div>{formatDate(detail.assigned_at)}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">
                    Perkiraan Kembali
                  </small>
                  <div>{formatDate(detail.expected_return_at)}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Pengembalian</small>
                  <div>{formatDate(detail.returned_at)}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Kondisi Awal</small>
                  <div>
                    {conditions[detail.condition_out] || detail.condition_out}
                  </div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Kondisi Akhir</small>
                  <div>{conditions[detail.condition_in] || "—"}</div>
                </Col>
              </Row>

              <div>
                <small className="text-body-secondary">Catatan Penugasan</small>
                <p>{detail.notes || "—"}</p>
              </div>

              <div>
                <small className="text-body-secondary">
                  Catatan Pengembalian
                </small>
                <p>{detail.return_notes || "—"}</p>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
