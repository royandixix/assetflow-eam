"use client";

import { useEffect, useState, type FormEvent } from "react";
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

type Vendor = {
  id: string;
  code: string;
  name: string;
  category: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type VendorForm = {
  name: string;
  category: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
};

type VendorList = {
  data: Vendor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  summary: {
    total: number;
    active: number;
    inactive: number;
  };
  can_manage: boolean;
};

type ApiMessage = {
  message?: string;
};

const initialForm: VendorForm = {
  name: "",
  category: "SERVICE",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

const categoryNames: Record<string, string> = {
  SUPPLIER: "Pemasok",
  SERVICE: "Penyedia Jasa",
  BOTH: "Pemasok & Jasa",
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan pada aplikasi";
}

async function vendorApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/vendors${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = `Permintaan gagal (${response.status})`;

    if (result !== null && typeof result === "object" && "message" in result) {
      const apiMessage = result as ApiMessage;

      if (typeof apiMessage.message === "string") {
        message = apiMessage.message;
      }
    }

    throw new Error(message);
  }

  return result as T;
}

function formatDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function releaseFocus() {
  if (
    typeof document !== "undefined" &&
    document.activeElement instanceof HTMLElement
  ) {
    document.activeElement.blur();
  }
}

export default function VendorManager() {
  const [items, setItems] = useState<Vendor[]>([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const [canManage, setCanManage] = useState(false);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogError, setDialogError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [detail, setDetail] = useState<Vendor | null>(null);

  const [form, setForm] = useState<VendorForm>({
    ...initialForm,
  });

  const totalPages = Math.max(1, Math.ceil(total / 10));

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      page: String(page),
      q: query,
      status: statusFilter,
    });

    vendorApi<VendorList>(`?${params.toString()}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        setItems(result.data ?? []);
        setTotal(result.pagination?.total ?? 0);

        setSummary(
          result.summary ?? {
            total: 0,
            active: 0,
            inactive: 0,
          },
        );

        setCanManage(result.can_manage ?? false);
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setError(getErrorMessage(err));
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [page, query, statusFilter, refreshKey]);

  function reload() {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  }

  function updateField<K extends keyof VendorForm>(
    field: K,
    value: VendorForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openCreate() {
    releaseFocus();

    setEditing(null);
    setForm({ ...initialForm });
    setDialogError("");
    setNotice("");
    setShowForm(true);
  }

  function openEdit(vendor: Vendor) {
    releaseFocus();

    setEditing(vendor);

    setForm({
      name: vendor.name,
      category: vendor.category,
      contact_person: vendor.contact_person,
      phone: vendor.phone,
      email: vendor.email,
      address: vendor.address,
      notes: vendor.notes,
      is_active: vendor.is_active,
    });

    setDialogError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    releaseFocus();
    setShowForm(false);
    setEditing(null);
    setDialogError("");
  }

  async function saveVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (form.name.trim().length < 3) {
      setDialogError("Nama Vendor minimal 3 karakter");
      return;
    }

    setSaving(true);
    setDialogError("");

    try {
      const payload: VendorForm = {
        ...form,
        name: form.name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      };

      await vendorApi(editing ? `/${editing.id}` : "", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      releaseFocus();

      setShowForm(false);
      setEditing(null);

      setNotice(
        editing
          ? "Data Vendor berhasil diperbarui."
          : "Vendor baru berhasil ditambahkan.",
      );

      setPage(1);
      reload();
    } catch (err) {
      setDialogError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function vendorStatus(vendor: Vendor) {
    return (
      <Badge bg={vendor.is_active ? "success" : "secondary"}>
        {vendor.is_active ? "Aktif" : "Nonaktif"}
      </Badge>
    );
  }

  function vendorActions(vendor: Vendor) {
    return (
      <div className="d-flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => {
            releaseFocus();
            setDetail(vendor);
          }}
        >
          Detail
        </Button>

        {canManage && (
          <Button
            size="sm"
            variant="outline-primary"
            onClick={() => openEdit(vendor)}
          >
            Edit
          </Button>
        )}
      </div>
    );
  }

  function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || loading) {
      return;
    }

    setLoading(true);
    setPage(nextPage);
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Vendor Management</h1>

          <p className="text-body-secondary mb-0">
            Pengelolaan mitra pemasok, penyedia jasa, dan layanan pemeliharaan
            aset.
          </p>
        </div>

        {canManage && (
          <Button variant="primary" onClick={openCreate}>
            + Tambah Vendor
          </Button>
        )}
      </div>

      <Row className="g-3 mb-4">
        <Col xs={12} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-body-secondary mb-2">Total Vendor</div>

              <div className="h3 fw-bold mb-0">{summary.total}</div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-body-secondary mb-2">Vendor Aktif</div>

              <div className="h3 fw-bold text-success mb-0">
                {summary.active}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={6} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <div className="small text-body-secondary mb-2">
                Vendor Nonaktif
              </div>

              <div className="h3 fw-bold mb-0">{summary.inactive}</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {notice && (
        <Alert variant="success" dismissible onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <Card className="shadow-sm">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <strong>Daftar Vendor</strong>

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
              reload();
            }}
          >
            <Form.Control
              aria-label="Cari Vendor"
              placeholder="Cari kode, nama, email, atau kontak..."
              value={search}
              maxLength={100}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: "1 1 220px" }}
            />

            <Form.Select
              aria-label="Filter Status Vendor"
              value={statusFilter}
              style={{ width: "auto" }}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setStatusFilter(event.target.value);
              }}
            >
              <option value="">Semua Status</option>

              <option value="ACTIVE">Aktif</option>

              <option value="INACTIVE">Nonaktif</option>
            </Form.Select>

            <Button type="submit" variant="outline-primary">
              Cari
            </Button>

            <Button type="button" variant="outline-secondary" onClick={reload}>
              Muat Ulang
            </Button>
          </Form>

          {loading ? (
            <div className="py-5 text-center">
              <Spinner animation="border" size="sm" className="me-2" />
              Memuat data Vendor...
            </div>
          ) : items.length === 0 ? (
            <div className="py-5 text-center text-body-secondary">
              Belum ada Vendor sesuai filter.
            </div>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table responsive hover className="align-middle">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Vendor</th>
                      <th>Jenis</th>
                      <th>Kontak</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((vendor) => (
                      <tr key={vendor.id}>
                        <td className="fw-semibold">{vendor.code}</td>

                        <td>
                          <div className="fw-semibold">{vendor.name}</div>

                          <div className="small text-body-secondary">
                            {vendor.email || "-"}
                          </div>
                        </td>

                        <td>
                          {categoryNames[vendor.category] || vendor.category}
                        </td>

                        <td>
                          <div>{vendor.contact_person || "-"}</div>

                          <div className="small text-body-secondary">
                            {vendor.phone || "-"}
                          </div>
                        </td>

                        <td>{vendorStatus(vendor)}</td>

                        <td>{vendorActions(vendor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-lg-none">
                <Row xs={1} md={2} className="g-3">
                  {items.map((vendor) => (
                    <Col key={vendor.id}>
                      <Card className="h-100">
                        <Card.Body>
                          <div className="small text-body-secondary mb-1">
                            {vendor.code}
                          </div>

                          <h2 className="h6 fw-bold mb-2">{vendor.name}</h2>

                          <div className="small mb-2">
                            {categoryNames[vendor.category] || vendor.category}
                          </div>

                          <div className="small mb-2">
                            {vendor.contact_person || "Kontak belum diisi"}
                          </div>

                          <div className="small mb-3">
                            {vendor.phone || "-"}
                          </div>

                          <div className="mb-3">{vendorStatus(vendor)}</div>

                          {vendorActions(vendor)}
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
                onClick={() => changePage(page - 1)}
              >
                Sebelumnya
              </Button>

              <Button
                size="sm"
                variant="outline-secondary"
                disabled={loading || page >= totalPages}
                onClick={() => changePage(page + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Modal
        show={showForm}
        onHide={closeForm}
        centered
        size="lg"
        backdrop={saving ? "static" : true}
        keyboard={!saving}
      >
        <Form onSubmit={(event) => void saveVendor(event)}>
          <Modal.Header closeButton={!saving}>
            <Modal.Title>
              {editing ? "Edit Vendor" : "Tambah Vendor"}
            </Modal.Title>
          </Modal.Header>

          <Modal.Body>
            {dialogError && <Alert variant="danger">{dialogError}</Alert>}

            {editing ? (
              <Alert variant="secondary">
                Kode Vendor: <strong>{editing.code}</strong>
              </Alert>
            ) : (
              <p className="small text-body-secondary">
                Kode Vendor dibuat otomatis oleh sistem.
              </p>
            )}

            <Row className="g-3">
              <Col xs={12} md={7}>
                <Form.Group>
                  <Form.Label>Nama Vendor *</Form.Label>

                  <Form.Control
                    required
                    minLength={3}
                    maxLength={160}
                    disabled={saving}
                    value={form.name}
                    placeholder="Contoh: PT Mitra Teknologi"
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={5}>
                <Form.Group>
                  <Form.Label>Jenis Vendor *</Form.Label>

                  <Form.Select
                    required
                    disabled={saving}
                    value={form.category}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                  >
                    <option value="SERVICE">Penyedia Jasa</option>

                    <option value="SUPPLIER">Pemasok Barang</option>

                    <option value="BOTH">Pemasok & Jasa</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label>Nama Penanggung Jawab</Form.Label>

                  <Form.Control
                    maxLength={120}
                    disabled={saving}
                    value={form.contact_person}
                    placeholder="Nama kontak Vendor"
                    onChange={(event) =>
                      updateField("contact_person", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label>Nomor Telepon</Form.Label>

                  <Form.Control
                    type="tel"
                    maxLength={30}
                    disabled={saving}
                    value={form.phone}
                    placeholder="+62..."
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Email Vendor</Form.Label>

                  <Form.Control
                    type="email"
                    maxLength={254}
                    disabled={saving}
                    value={form.email}
                    placeholder="vendor@example.com"
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Alamat</Form.Label>

                  <Form.Control
                    as="textarea"
                    rows={2}
                    maxLength={500}
                    disabled={saving}
                    value={form.address}
                    onChange={(event) =>
                      updateField("address", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12}>
                <Form.Group>
                  <Form.Label>Catatan</Form.Label>

                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={1000}
                    disabled={saving}
                    value={form.notes}
                    placeholder="Informasi layanan atau kerja sama"
                    onChange={(event) =>
                      updateField("notes", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              {editing && (
                <Col xs={12}>
                  <Form.Group>
                    <Form.Label>Status Vendor</Form.Label>

                    <Form.Select
                      disabled={saving}
                      value={form.is_active ? "ACTIVE" : "INACTIVE"}
                      onChange={(event) =>
                        updateField(
                          "is_active",
                          event.target.value === "ACTIVE",
                        )
                      }
                    >
                      <option value="ACTIVE">Aktif</option>

                      <option value="INACTIVE">Nonaktif</option>
                    </Form.Select>

                    <Form.Text muted>
                      Vendor nonaktif tetap tersimpan dalam database.
                    </Form.Text>
                  </Form.Group>
                </Col>
              )}
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="outline-secondary"
              disabled={saving}
              onClick={closeForm}
            >
              Batal
            </Button>

            <Button
              type="submit"
              disabled={saving || form.name.trim().length < 3}
            >
              {saving
                ? "Menyimpan..."
                : editing
                  ? "Simpan Perubahan"
                  : "Simpan Vendor"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={detail !== null}
        onHide={() => {
          releaseFocus();
          setDetail(null);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Detail Vendor</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detail && (
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="small text-body-secondary">{detail.code}</div>

                <h2 className="h5 fw-bold mb-2">{detail.name}</h2>

                {vendorStatus(detail)}
              </div>

              <div>
                <strong>Jenis Vendor</strong>

                <div>{categoryNames[detail.category] || detail.category}</div>
              </div>

              <div>
                <strong>Penanggung Jawab</strong>

                <div>{detail.contact_person || "-"}</div>
              </div>

              <div>
                <strong>Nomor Telepon</strong>

                <div>{detail.phone || "-"}</div>
              </div>

              <div>
                <strong>Email</strong>

                <div>{detail.email || "-"}</div>
              </div>

              <div>
                <strong>Alamat</strong>

                <div style={{ whiteSpace: "pre-wrap" }}>
                  {detail.address || "-"}
                </div>
              </div>

              <div>
                <strong>Catatan</strong>

                <div style={{ whiteSpace: "pre-wrap" }}>
                  {detail.notes || "-"}
                </div>
              </div>

              <div className="small text-body-secondary">
                Dibuat: {formatDate(detail.created_at)}
              </div>

              <div className="small text-body-secondary">
                Terakhir diperbarui: {formatDate(detail.updated_at)}
              </div>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={() => {
              releaseFocus();
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
