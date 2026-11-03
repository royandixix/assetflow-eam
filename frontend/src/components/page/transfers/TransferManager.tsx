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

type Transfer = {
  id: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  from_location: string;
  to_location: string;
  from_department: string;
  to_department: string;
  transfer_date: string;
  reason: string;
  notes: string;
  created_by_name: string;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string;
};

type Asset = {
  id: string;
  code: string;
  name: string;
  location_id: string;
  department_id: string;
};

type Master = {
  id: string;
  code: string;
  name: string;
};

type Options = {
  assets: Asset[];
  locations: Master[];
  departments: Master[];
};

type ListResponse = {
  data: Transfer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

type TransferInput = {
  asset_id: string;
  to_location_id: string;
  to_department_id: string;
  transfer_date: string;
  reason: string;
  notes: string;
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

  const date = new Date(value.slice(0, 10) + "T12:00:00");

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/transfers${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.message || `Permintaan gagal (HTTP ${response.status})`,
    );
  }

  return result as T;
}

export default function TransferManager() {
  const [items, setItems] = useState<Transfer[]>([]);

  const [options, setOptions] = useState<Options>({
    assets: [],
    locations: [],
    departments: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<Transfer | null>(null);

  const [form, setForm] = useState<TransferInput>({
    asset_id: "",
    to_location_id: "",
    to_department_id: "",
    transfer_date: today(),
    reason: "",
    notes: "",
  });

  const pendingCreate = useRef<TransferInput | null>(null);
  const pendingCancel = useRef<Transfer | null>(null);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams({
      page: String(page),
      q: search,
    });

    async function load() {
      try {
        const [list, choices] = await Promise.all([
          api<ListResponse>(`?${params.toString()}`),
          api<Options>("/options"),
        ]);

        if (!active) return;

        setItems(list.data ?? []);
        setTotal(list.pagination.total);
        setLimit(list.pagination.limit);

        setOptions({
          assets: choices.assets ?? [],
          locations: choices.locations ?? [],
          departments: choices.departments ?? [],
        });

        setError("");
      } catch (err) {
        if (!active) return;

        setItems([]);
        setTotal(0);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil data mutasi aset",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [page, search, revision]);

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  const selectedAsset = options.assets.find(
    (item) => item.id === form.asset_id,
  );

  function locationName(id: string) {
    return (
      options.locations.find((item) => item.id === id)?.name ||
      "—"
    );
  }

  function departmentName(id: string) {
    if (!id) return "Tanpa Departemen";

    return (
      options.departments.find((item) => item.id === id)?.name ||
      "—"
    );
  }

  function openCreate() {
    setForm({
      asset_id: "",
      to_location_id: "",
      to_department_id: "",
      transfer_date: today(),
      reason: "",
      notes: "",
    });

    setFormError("");
    setShowCreate(true);
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!selectedAsset || !form.to_location_id) {
      setFormError("Aset dan lokasi tujuan wajib dipilih.");
      return;
    }

    if (
      selectedAsset.location_id === form.to_location_id &&
      selectedAsset.department_id === form.to_department_id
    ) {
      setFormError(
        "Lokasi dan departemen tujuan sama dengan asal.",
      );
      return;
    }

    if (!form.transfer_date) {
      setFormError("Tanggal mutasi wajib diisi.");
      return;
    }

    if (
      form.reason.trim().length < 4 ||
      form.reason.trim().length > 500
    ) {
      setFormError(
        "Alasan mutasi harus terdiri dari 4 sampai 500 karakter.",
      );
      return;
    }

    if (form.notes.trim().length > 1000) {
      setFormError("Catatan maksimal 1000 karakter.");
      return;
    }

    pendingCreate.current = {
      ...form,
      reason: form.reason.trim(),
      notes: form.notes.trim(),
    };

    setShowCreate(false);
  }


  function queueCancel(item: Transfer) {
    if (item.cancelled_at || saving) return;

    pendingCancel.current = item;
    setDetail(null);
  }

  function openPendingCancel() {
    const item = pendingCancel.current;
    pendingCancel.current = null;

    if (item) {
      void confirmCancel(item);
    }
  }

  async function confirmCancel(item: Transfer) {
    if (item.cancelled_at || saving) return;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const prompt = await Swal.fire({
      returnFocus: false,
      title: "Batalkan mutasi aset?",
      text: `${item.asset_code} — ${item.asset_name}`,
      input: "textarea",
      inputLabel: "Alasan pembatalan (10–500 karakter)",
      inputPlaceholder: "Tuliskan alasan pembatalan...",
      inputAttributes: { maxlength: "500" },
      showCancelButton: true,
      confirmButtonText: "Ya, batalkan mutasi",
      cancelButtonText: "Kembali",
      confirmButtonColor: "#dc3545",
      preConfirm(value) {
        const reason = String(value ?? "").trim();
        const length = [...reason].length;

        if (length < 10 || length > 500) {
          Swal.showValidationMessage(
            "Alasan harus 10 sampai 500 karakter."
          );
          return false;
        }

        return reason;
      },
    });

    if (!prompt.isConfirmed || typeof prompt.value !== "string") {
      return;
    }

    setSaving(true);

    try {
      await api<{ message: string }>(`/${item.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: prompt.value }),
      });

      setDetail(null);
      setRevision((value) => value + 1);

      await Swal.fire({
        icon: "success",
        title: "Mutasi berhasil dibatalkan",
        text: "Posisi aset telah dikembalikan oleh backend.",
      });
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "Pembatalan gagal",
        text:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmCreate(input: TransferInput) {
    const asset = options.assets.find(
      (item) => item.id === input.asset_id,
    );

    const destination = options.locations.find(
      (item) => item.id === input.to_location_id,
    );

    const confirmation = await Swal.fire({
      icon: "question",
      title: "Konfirmasi Mutasi Aset",
      text: `Pindahkan ${asset?.name || "aset"} ke ${
        destination?.name || "lokasi tujuan"
      }?`,
      showCancelButton: true,
      confirmButtonText: "Ya, Simpan Mutasi",
      cancelButtonText: "Batal",
      reverseButtons: true,
      returnFocus: false,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) {
      setShowCreate(true);
      return;
    }

    setSaving(true);

    try {
      await api<{ message: string }>("", {
        method: "POST",
        body: JSON.stringify(input),
      });

      refresh();

      await Swal.fire({
        icon: "success",
        title: "Mutasi Berhasil",
        text: "Lokasi dan departemen aset telah diperbarui.",
        returnFocus: false,
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Gagal menyimpan mutasi aset.";

      setFormError(message);

      await Swal.fire({
        icon: "error",
        title: "Mutasi Gagal",
        text: message,
        returnFocus: false,
        heightAuto: false,
      });

      setShowCreate(true);
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit),
  );

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Mutasi Aset</h1>
          <p className="text-body-secondary mb-0">
            Pengelolaan perpindahan lokasi dan departemen aset
          </p>
        </div>

        <Button
          onClick={(event) => {
            event.currentTarget.blur();
            openCreate();
          }}
          disabled={loading || saving}
        >
          + Mutasi Aset
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Riwayat Mutasi Aset</strong>
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
              placeholder="Cari aset, lokasi, departemen..."
              style={{ flex: "1 1 200px" }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

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
              <span className="ms-2">Memuat mutasi aset...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              Belum ada data mutasi aset.
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
                      <th>Lokasi Asal</th>
                      <th>Lokasi Tujuan</th>
                      <th>Tanggal</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{(page - 1) * limit + index + 1}</td>

                        <td className="fw-semibold">{item.asset_code}</td>

                        <td>{item.asset_name}</td>
                        <td>{item.from_location}</td>
                        <td>{item.to_location}</td>
                        <td>{formatDate(item.transfer_date)}
                            <Badge
                              bg={item.cancelled_at ? "danger" : "success"}
                              className="ms-2"
                            >
                              {item.cancelled_at ? "Dibatalkan" : "Aktif"}
                            </Badge></td>

                        <td>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setDetail(item)}
                          >
                            Detail
                          </Button>
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

                          <div className="small mb-2">{item.asset_code}</div>

                          <div className="small">
                            <strong>Asal:</strong> {item.from_location}
                          </div>

                          <div className="small">
                            <strong>Tujuan:</strong> {item.to_location}
                          </div>

                          <div className="small mb-3">
                            {formatDate(item.transfer_date)}
                            <Badge
                              bg={item.cancelled_at ? "danger" : "success"}
                              className="ms-2"
                            >
                              {item.cancelled_at ? "Dibatalkan" : "Aktif"}
                            </Badge>
                          </div>

                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setDetail(item)}
                          >
                            Detail
                          </Button>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
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
        show={showCreate}
        onHide={() => {
          if (!saving) setShowCreate(false);
        }}
        onExited={() => {
          const pending = pendingCreate.current;
          pendingCreate.current = null;

          if (pending) void confirmCreate(pending);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Mutasi Aset</Modal.Title>
        </Modal.Header>

        <Form onSubmit={submitCreate}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Pilih Aset</Form.Label>

              <Form.Select
                required
                value={form.asset_id}
                onChange={(event) => {
                  const asset = options.assets.find(
                    (item) => item.id === event.target.value,
                  );

                  setForm((current) => ({
                    ...current,
                    asset_id: asset?.id || "",
                    to_location_id: "",
                    to_department_id: asset?.department_id || "",
                  }));

                  setFormError("");
                }}
              >
                <option value="">Pilih aset yang tersedia</option>

                {options.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code} — {asset.name}
                  </option>
                ))}
              </Form.Select>

              {options.assets.length === 0 && (
                <Form.Text muted>
                  Tidak ada aset tersedia untuk dimutasi.
                </Form.Text>
              )}
            </Form.Group>

            {selectedAsset && (
              <Alert variant="light" className="border">
                <strong>Informasi Asal Aset</strong>

                <div className="mt-2">
                  Lokasi: {locationName(selectedAsset.location_id)}
                </div>

                <div>
                  Departemen: {departmentName(selectedAsset.department_id)}
                </div>
              </Alert>
            )}

            <Row className="g-3 mb-3">
              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Lokasi Tujuan</Form.Label>

                  <Form.Select
                    required
                    value={form.to_location_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        to_location_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Pilih lokasi tujuan</option>

                    {options.locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.code} — {location.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Departemen Tujuan</Form.Label>

                  <Form.Select
                    value={form.to_department_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        to_department_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Tanpa Departemen</option>

                    {options.departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} — {department.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Tanggal Mutasi</Form.Label>

              <Form.Control
                type="date"
                required
                value={form.transfer_date}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    transfer_date: event.target.value,
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Alasan Mutasi</Form.Label>

              <Form.Control
                as="textarea"
                required
                rows={2}
                minLength={4}
                maxLength={500}
                placeholder="Contoh: Pemindahan perangkat untuk kebutuhan operasional unit kerja."
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Catatan Tambahan</Form.Label>

              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
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
              type="button"
              variant="secondary"
              onClick={() => setShowCreate(false)}
            >
              Batal
            </Button>

            <Button
              type="submit"
              disabled={
                saving ||
                options.assets.length === 0 ||
                options.locations.length === 0
              }
            >
              Simpan Mutasi
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={detail !== null}
        onHide={() => setDetail(null)}
        onExited={openPendingCancel}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Detail Mutasi Aset</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detail && (
            <div className="d-flex flex-column gap-3">
              {detail.cancelled_at && (
                <Alert variant="danger" className="mb-0">
                  <strong>Mutasi sudah dibatalkan</strong>
                  <div>Alasan: {detail.cancellation_reason || "—"}</div>
                  <div>Tanggal: {formatDate(detail.cancelled_at)}</div>
                </Alert>
              )}
              <div>
                <small className="text-body-secondary">Aset</small>
                <div>
                  <strong>
                    {detail.asset_code} — {detail.asset_name}
                  </strong>
                </div>
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <small className="text-body-secondary">Lokasi Asal</small>
                  <div>{detail.from_location}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Lokasi Tujuan</small>
                  <div>{detail.to_location}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Departemen Asal</small>
                  <div>{detail.from_department || "Tanpa Departemen"}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">
                    Departemen Tujuan
                  </small>
                  <div>{detail.to_department || "Tanpa Departemen"}</div>
                </Col>

                <Col xs={6}>
                  <small className="text-body-secondary">Tanggal Mutasi</small>
                  <div>{formatDate(detail.transfer_date)}</div>
                </Col>
              </Row>

              <div>
                <small className="text-body-secondary">Alasan Mutasi</small>
                <p className="mb-0">{detail.reason}</p>
              </div>

              <div>
                <small className="text-body-secondary">Catatan</small>
                <p className="mb-0">{detail.notes || "—"}</p>
              </div>

              <div>
                <small className="text-body-secondary">Dibuat Oleh</small>
                <div>{detail.created_by_name || "Tidak tercatat"}</div>
              </div>

              <div>
                <small className="text-body-secondary">Waktu Pencatatan</small>
                <div>{formatDate(detail.created_at)}</div>
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          {detail && !detail.cancelled_at && (
            <Button
              variant="outline-danger"
              disabled={saving}
              onClick={(event) => {
                event.currentTarget.blur();
                queueCancel(detail);
              }}
            >
              {saving ? "Membatalkan..." : "Batalkan Mutasi"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
