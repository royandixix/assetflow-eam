"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBox,
  faEye,
  faMagnifyingGlass,
  faPen,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

type Asset = {
  id: string;
  asset_code: string;
  name: string;
  category_id: string;
  category_name: string;
  location_id: string;
  location_name: string;
  department_id: string;
  department_name: string;
  status: string;
  condition: string;
  purchase_date: string;
  purchase_price: string;
  created_at: string;
  updated_at: string;
};

type AssetInput = {
  asset_code: string;
  name: string;
  category_id: string;
  location_id: string;
  department_id: string;
  condition: string;
  purchase_date: string;
  purchase_price: string;
};

type Option = {
  id: string;
  code: string;
  name: string;
};

type OptionsResponse = {
  categories: Option[];
  locations: Option[];
  departments: Option[];
};

type ListResponse = {
  data: Asset[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

type PendingSave = {
  input: AssetInput;
  id: string | null;
};

const emptyForm: AssetInput = {
  asset_code: "",
  name: "",
  category_id: "",
  location_id: "",
  department_id: "",
  condition: "GOOD",
  purchase_date: "",
  purchase_price: "",
};

const emptyOptions: OptionsResponse = {
  categories: [],
  locations: [],
  departments: [],
};

const statusLabels: Record<string, string> = {
  AVAILABLE: "Tersedia",
  ASSIGNED: "Ditugaskan",
  MAINTENANCE: "Pemeliharaan",
  RETIRED: "Dipensiunkan",
};

const conditionLabels: Record<string, string> = {
  GOOD: "Baik",
  FAIR: "Cukup Baik",
  DAMAGED: "Rusak",
};

function statusColor(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "ASSIGNED":
      return "primary";
    case "MAINTENANCE":
      return "warning";
    case "RETIRED":
      return "secondary";
    default:
      return "secondary";
  }
}

function conditionColor(condition: string) {
  switch (condition) {
    case "GOOD":
      return "success";
    case "FAIR":
      return "warning";
    case "DAMAGED":
      return "danger";
    default:
      return "secondary";
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: string) {
  if (!value) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatRupiahInput(value: string) {
  if (!value) return "";

  const [integer, decimal] = value.split(".");

  const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return decimal === undefined ? formatted : `${formatted},${decimal}`;
}

function parseRupiahInput(value: string): string | null {
  const cleaned = value.replace(/^Rp\s*/i, "").replace(/\s/g, "");

  if (!/^[0-9.,]*$/.test(cleaned)) {
    return null;
  }

  let normalized = cleaned.replace(/\./g, "").replace(",", ".");

  if (normalized.startsWith(".")) {
    normalized = `0${normalized}`;
  }

  if (normalized !== "" && !/^\d{1,12}(?:\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  if (normalized) {
    const [integer, decimal] = normalized.split(".");
    const cleanInteger = integer.replace(/^0+(?=\d)/, "") || "0";

    normalized =
      decimal === undefined ? cleanInteger : `${cleanInteger}.${decimal}`;
  }

  return normalized;
}

function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/assets${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || `Permintaan gagal (${response.status})`);
  }

  return result as T;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge bg={statusColor(status)}>{statusLabels[status] || status}</Badge>
  );
}

function ConditionBadge({ condition }: { condition: string }) {
  return (
    <Badge bg={conditionColor(condition)}>
      {conditionLabels[condition] || condition}
    </Badge>
  );
}

export default function AssetManager() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [options, setOptions] = useState<OptionsResponse>(emptyOptions);

  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [formError, setFormError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [detail, setDetail] = useState<Asset | null>(null);

  const [form, setForm] = useState<AssetInput>({
    ...emptyForm,
  });

  const pendingSaveRef = useRef<PendingSave | null>(null);

  useEffect(() => {
    let active = true;

    void api<OptionsResponse>("/options")
      .then((result) => {
        if (!active) return;

        setOptions({
          categories: result.categories ?? [],
          locations: result.locations ?? [],
          departments: result.departments ?? [],
        });

        setOptionsError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setOptionsError(
          err instanceof Error ? err.message : "Gagal memuat master data aset.",
        );
      })
      .finally(() => {
        if (active) {
          setOptionsLoading(false);
        }
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
      status: statusFilter,
    });

    void api<ListResponse>(`?${params.toString()}`)
      .then((result) => {
        if (!active) return;

        setItems(result.data ?? []);
        setLimit(result.pagination.limit);
        setTotal(result.pagination.total);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setItems([]);
        setTotal(0);

        setError(
          err instanceof Error ? err.message : "Gagal memuat daftar aset.",
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
  }, [page, search, statusFilter, revision]);

  function refresh() {
    setLoading(true);
    setOptionsLoading(true);
    setRevision((value) => value + 1);
  }

  function openCreate() {
    if (saving) return;

    blurActiveElement();

    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: Asset) {
    if (saving) return;

    blurActiveElement();

    setEditing(item);

    setForm({
      asset_code: item.asset_code,
      name: item.name,
      category_id: item.category_id,
      location_id: item.location_id,
      department_id: item.department_id || "",
      condition: item.condition,
      purchase_date: item.purchase_date || "",
      purchase_price: item.purchase_price || "",
    });

    setFormError("");
    setShowForm(true);
  }

  function openDetail(item: Asset) {
    if (saving) return;

    blurActiveElement();
    setDetail(item);
  }

  function closeForm() {
    if (saving) return;

    blurActiveElement();
    setShowForm(false);
    setFormError("");
  }

  function updateField<K extends keyof AssetInput>(
    field: K,
    value: AssetInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFormError("");
  }

  function save() {
    if (saving) return;

    const price = form.purchase_price.trim();

    const input: AssetInput = {
      asset_code: form.asset_code.trim().toUpperCase(),
      name: form.name.trim(),
      category_id: form.category_id,
      location_id: editing ? editing.location_id : form.location_id,
      department_id: editing ? editing.department_id || "" : form.department_id,
      condition: form.condition,
      purchase_date: form.purchase_date,
      purchase_price: price.endsWith(".") ? price.slice(0, -1) : price,
    };

    if (!/^[A-Z0-9_-]{2,40}$/.test(input.asset_code)) {
      setFormError(
        "Kode aset harus 2–40 karakter, menggunakan huruf, angka, - atau _.",
      );
      return;
    }

    if (input.name.length < 2 || input.name.length > 160) {
      setFormError("Nama aset harus terdiri dari 2–160 karakter.");
      return;
    }

    if (!input.category_id) {
      setFormError("Kategori aset wajib dipilih.");
      return;
    }

    if (!input.location_id) {
      setFormError("Lokasi aset wajib dipilih.");
      return;
    }

    if (
      input.purchase_price &&
      !/^\d{1,12}(?:\.\d{1,2})?$/.test(input.purchase_price)
    ) {
      setFormError(
        "Harga pembelian tidak valid. Gunakan angka dengan maksimal dua angka desimal.",
      );
      return;
    }

    pendingSaveRef.current = {
      input,
      id: editing?.id ?? null,
    };

    blurActiveElement();
    setShowForm(false);
  }

  function onFormExited() {
    const pending = pendingSaveRef.current;

    pendingSaveRef.current = null;

    if (pending) {
      void confirmAndSave(pending);
    }
  }

  async function confirmAndSave(pending: PendingSave) {
    blurActiveElement();

    const isEditing = pending.id !== null;

    const confirmation = await Swal.fire({
      icon: "question",
      title: isEditing ? "Simpan Perubahan Aset?" : "Tambahkan Aset Baru?",
      text: isEditing
        ? `Perubahan aset "${pending.input.name}" akan disimpan.`
        : `Aset "${pending.input.name}" akan didaftarkan ke dalam AssetFlow EAM.`,
      showCancelButton: true,
      confirmButtonText: isEditing ? "Ya, Simpan Perubahan" : "Ya, Tambahkan",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      returnFocus: false,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) {
      setShowForm(true);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await api(pending.id ? `/${pending.id}` : "", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(pending.input),
      });

      refresh();

      await Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: isEditing
          ? "Data aset berhasil diperbarui."
          : "Aset baru berhasil didaftarkan ke dalam sistem.",
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan data aset.";

      setFormError(message);

      await Swal.fire({
        icon: "error",
        title: "Gagal Menyimpan",
        text: message,
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });

      setShowForm(true);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Asset) {
    if (saving) return;

    blurActiveElement();

    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Hapus Aset?",
      text: `Aset "${item.name}" dengan kode ${item.asset_code} akan dihapus secara permanen.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#d33",
      reverseButtons: true,
      focusCancel: true,
      returnFocus: false,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) return;

    setSaving(true);

    try {
      await api(`/${item.id}`, {
        method: "DELETE",
      });

      if (items.length === 1 && page > 1) {
        setLoading(true);
        setPage((value) => value - 1);
      } else {
        refresh();
      }

      await Swal.fire({
        icon: "success",
        title: "Berhasil Dihapus!",
        text: `Aset "${item.name}" berhasil dihapus dari sistem.`,
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menghapus aset.",
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const canSubmit =
    !saving &&
    !optionsLoading &&
    !optionsError &&
    (options.categories.length > 0 || editing !== null) &&
    options.locations.length > 0;

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Daftar Aset</h1>

          <p className="text-body-secondary mb-0">
            Pengelolaan inventaris dan data aset perusahaan
          </p>
        </div>

        <Button onClick={openCreate} disabled={saving}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Tambah Aset
        </Button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {optionsError && (
        <div className="alert alert-warning" role="alert">
          Gagal memuat pilihan master data: {optionsError}
        </div>
      )}

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center gap-2">
          <strong>
            <FontAwesomeIcon icon={faBox} className="me-2" />
            Data Aset
          </strong>

          <Badge bg="primary">{total} aset</Badge>
        </Card.Header>

        <Card.Body>
          <Form
            className="d-flex flex-wrap gap-2 mb-4"
            onSubmit={(event) => {
              event.preventDefault();
              setLoading(true);
              setPage(1);
              setSearch(searchInput.trim());
              setRevision((value) => value + 1);
            }}
          >
            <Form.Control
              type="search"
              placeholder="Cari kode, nama, kategori, lokasi..."
              aria-label="Cari aset"
              className="flex-grow-1"
              style={{ minWidth: 180 }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <Form.Select
              aria-label="Filter status aset"
              style={{
                width: "auto",
                minWidth: 150,
              }}
              value={statusFilter}
              onChange={(event) => {
                setLoading(true);
                setPage(1);
                setStatusFilter(event.target.value);
                setRevision((value) => value + 1);
              }}
            >
              <option value="">Semua Status</option>

              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Select>

            <Button type="submit" variant="outline-primary" disabled={loading}>
              <FontAwesomeIcon icon={faMagnifyingGlass} className="me-2" />
              Cari
            </Button>

            <Button
              type="button"
              variant="outline-secondary"
              onClick={refresh}
              disabled={loading}
              title="Muat ulang"
              aria-label="Muat ulang data aset"
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </Button>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" className="me-2" />
              Memuat data aset...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              Belum ada aset yang ditemukan.
            </div>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table responsive hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>No.</th>
                      <th>Kode Aset</th>
                      <th>Nama Aset</th>
                      <th>Kategori</th>
                      <th>Lokasi</th>
                      <th>Status</th>
                      <th>Kondisi</th>
                      <th className="text-end">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="fw-semibold">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="fw-semibold text-nowrap">
                          {item.asset_code}
                        </td>

                        <td>{item.name}</td>

                        <td>{item.category_name}</td>

                        <td>{item.location_name}</td>

                        <td>
                          <StatusBadge status={item.status} />
                        </td>

                        <td>
                          <ConditionBadge condition={item.condition} />
                        </td>

                        <td className="text-end text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1"
                            title="Detail aset"
                            aria-label={`Detail ${item.name}`}
                            disabled={saving}
                            onClick={() => openDetail(item)}
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            title="Edit aset"
                            aria-label={`Edit ${item.name}`}
                            disabled={saving}
                            onClick={() => openEdit(item)}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-danger"
                            title="Hapus aset"
                            aria-label={`Hapus ${item.name}`}
                            disabled={saving}
                            onClick={() => void remove(item)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
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
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div className="min-w-0">
                              <Badge bg="secondary" className="mb-2">
                                No. {(page - 1) * limit + index + 1}
                              </Badge>

                              <div className="small text-body-secondary">
                                {item.asset_code}
                              </div>

                              <h2 className="h6 text-break mt-1">
                                {item.name}
                              </h2>
                            </div>

                            <FontAwesomeIcon
                              icon={faBox}
                              className="text-body-secondary"
                            />
                          </div>

                          <hr />

                          <div className="small mb-2">
                            <span className="text-body-secondary">
                              Kategori:
                            </span>{" "}
                            {item.category_name}
                          </div>

                          <div className="small mb-3">
                            <span className="text-body-secondary">Lokasi:</span>{" "}
                            {item.location_name}
                          </div>

                          <div className="d-flex flex-wrap gap-2 mb-3">
                            <StatusBadge status={item.status} />

                            <ConditionBadge condition={item.condition} />
                          </div>

                          <div className="d-flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              disabled={saving}
                              onClick={() => openDetail(item)}
                            >
                              <FontAwesomeIcon icon={faEye} className="me-1" />
                              Detail
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              disabled={saving}
                              onClick={() => openEdit(item)}
                            >
                              <FontAwesomeIcon icon={faPen} className="me-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-danger"
                              disabled={saving}
                              onClick={() => void remove(item)}
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
                                className="me-1"
                              />
                              Hapus
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </>
          )}

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4">
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
        show={showForm}
        onHide={closeForm}
        onExited={onFormExited}
        centered
        backdrop={saving ? "static" : true}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>{editing ? "Edit Aset" : "Tambah Aset"}</Modal.Title>
        </Modal.Header>

        <Form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Kode Aset <span className="text-danger">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={40}
                pattern={String.raw`[A-Za-z0-9_\-]{2,40}`}
                placeholder="Contoh: AST-0001"
                value={form.asset_code}
                disabled={saving}
                onChange={(event) =>
                  updateField("asset_code", event.target.value.toUpperCase())
                }
              />

              <Form.Text muted>Kode unik, maksimal 40 karakter.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Nama Aset <span className="text-danger">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={160}
                placeholder="Contoh: Laptop Operasional IT"
                value={form.name}
                disabled={saving}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Kategori Aset <span className="text-danger">*</span>
              </Form.Label>

              <Form.Select
                required
                value={form.category_id}
                disabled={saving || optionsLoading}
                onChange={(event) =>
                  updateField("category_id", event.target.value)
                }
              >
                <option value="">Pilih Kategori Aset</option>

                {options.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}

                {editing &&
                  !options.categories.some(
                    (item) => item.id === editing.category_id,
                  ) && (
                    <option value={editing.category_id}>
                      {editing.category_name} — Tidak aktif
                    </option>
                  )}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Lokasi Aset <span className="text-danger">*</span>
              </Form.Label>

              <Form.Select
                required
                value={form.location_id}
                disabled={saving || optionsLoading || editing !== null}
                onChange={(event) =>
                  updateField("location_id", event.target.value)
                }
              >
                <option value="">Pilih Lokasi Aset</option>

                {options.locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
                {editing &&
                  !options.locations.some(
                    (item) => item.id === editing.location_id,
                  ) && (
                    <option value={editing.location_id}>
                      {editing.location_name}
                    </option>
                  )}
              </Form.Select>
              {editing && (
                <Form.Text muted>
                  Lokasi hanya dapat diubah melalui menu Mutasi Aset.
                </Form.Text>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Departemen</Form.Label>

              <Form.Select
                value={form.department_id}
                disabled={saving || optionsLoading || editing !== null}
                onChange={(event) =>
                  updateField("department_id", event.target.value)
                }
              >
                <option value="">Tanpa Departemen</option>

                {options.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
                {editing &&
                  editing.department_id &&
                  !options.departments.some(
                    (item) => item.id === editing.department_id,
                  ) && (
                    <option value={editing.department_id}>
                      {editing.department_name || "Departemen saat ini"}
                    </option>
                  )}
              </Form.Select>

              <Form.Text muted>
                {editing
                  ? "Untuk mengubah departemen, gunakan menu Mutasi Aset."
                  : "Pilihan departemen berasal dari database."}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Kondisi Aset <span className="text-danger">*</span>
              </Form.Label>

              <Form.Select
                required
                value={form.condition}
                disabled={saving}
                onChange={(event) =>
                  updateField("condition", event.target.value)
                }
              >
                {Object.entries(conditionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Tanggal Pembelian</Form.Label>

                  <Form.Control
                    type="date"
                    value={form.purchase_date}
                    disabled={saving}
                    onChange={(event) =>
                      updateField("purchase_date", event.target.value)
                    }
                  />
                </Form.Group>
              </Col>

              <Col xs={12} sm={6}>
                <Form.Group>
                  <Form.Label>Harga Pembelian (Rp)</Form.Label>

                  <InputGroup>
                    <InputGroup.Text>Rp</InputGroup.Text>

                    <Form.Control
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={formatRupiahInput(form.purchase_price)}
                      disabled={saving}
                      onChange={(event) => {
                        const raw = parseRupiahInput(event.target.value);

                        if (raw !== null) {
                          updateField("purchase_price", raw);
                        }
                      }}
                    />
                  </InputGroup>

                  <Form.Text muted>
                    Titik pemisah ribuan otomatis. Gunakan koma untuk desimal.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <div className="alert alert-light border small mb-0">
              <strong>Status Aset</strong>

              <div className="mt-1">
                {editing ? (
                  <StatusBadge status={editing.status} />
                ) : (
                  <StatusBadge status="AVAILABLE" />
                )}
              </div>

              <div className="text-body-secondary mt-2">
                Status awal aset adalah Tersedia. Perubahan status penugasan
                dikelola melalui modul terkait.
              </div>
            </div>

            {formError && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                {formError}
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closeForm}
            >
              Batal
            </Button>

            <Button type="submit" disabled={!canSubmit}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Menyimpan...
                </>
              ) : editing ? (
                "Simpan Perubahan"
              ) : (
                "Simpan Aset"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={detail !== null} onHide={() => setDetail(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Detail Aset</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detail && (
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="text-body-secondary small">Kode Aset</div>
                <strong>{detail.asset_code}</strong>
              </div>

              <div>
                <div className="text-body-secondary small">Nama Aset</div>
                <strong>{detail.name}</strong>
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <div className="text-body-secondary small">Status</div>
                  <StatusBadge status={detail.status} />
                </Col>

                <Col xs={6}>
                  <div className="text-body-secondary small">Kondisi</div>
                  <ConditionBadge condition={detail.condition} />
                </Col>
              </Row>

              <hr className="my-0" />

              <div>
                <div className="text-body-secondary small">Kategori</div>
                {detail.category_name}
              </div>

              <div>
                <div className="text-body-secondary small">Lokasi</div>
                {detail.location_name}
              </div>

              <div>
                <div className="text-body-secondary small">Departemen</div>
                {detail.department_name || "—"}
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <div className="text-body-secondary small">
                    Tanggal Pembelian
                  </div>
                  {formatDate(detail.purchase_date)}
                </Col>

                <Col xs={6}>
                  <div className="text-body-secondary small">
                    Harga Pembelian
                  </div>
                  {formatMoney(detail.purchase_price)}
                </Col>
              </Row>

              <hr className="my-0" />

              <Row className="g-3">
                <Col xs={6}>
                  <div className="text-body-secondary small">Dibuat</div>
                  {formatDate(detail.created_at)}
                </Col>

                <Col xs={6}>
                  <div className="text-body-secondary small">Diperbarui</div>
                  {formatDate(detail.updated_at)}
                </Col>
              </Row>
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
