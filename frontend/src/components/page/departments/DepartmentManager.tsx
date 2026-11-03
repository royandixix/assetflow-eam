"use client";

import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBuilding,
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
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

type Department = {
  id: string;
  code: string;
  name: string;
  description: string;
  created_at: string;
  asset_count: number;
};

type DepartmentInput = {
  code: string;
  name: string;
  description: string;
};

type ListResponse = {
  data: Department[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  supports_description: boolean;
};

type PendingSave = {
  input: DepartmentInput;
  id: string | null;
};

const emptyForm: DepartmentInput = {
  code: "",
  name: "",
  description: "",
};

function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/departments${path}`, {
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

function Description({ value }: { value: string }) {
  if (!value) {
    return <span className="text-body-secondary">—</span>;
  }

  if (value.length <= 100) {
    return <span className="text-break">{value}</span>;
  }

  return (
    <details>
      <summary className="small text-primary">
        {value.slice(0, 100)}... Baca lengkap
      </summary>
      <p className="small text-body-secondary mt-2 mb-0 text-break">{value}</p>
    </details>
  );
}

export default function DepartmentManager() {
  const [items, setItems] = useState<Department[]>([]);
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

  const [supportsDescription, setSupportsDescription] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [detail, setDetail] = useState<Department | null>(null);

  const [form, setForm] = useState<DepartmentInput>({
    ...emptyForm,
  });

  const pendingSaveRef = useRef<PendingSave | null>(null);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams({
      page: String(page),
      q: search,
    });

    void api<ListResponse>(`?${params.toString()}`)
      .then((result) => {
        if (!active) return;

        setItems(result.data ?? []);
        setLimit(result.pagination.limit);
        setTotal(result.pagination.total);
        setSupportsDescription(result.supports_description ?? false);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setItems([]);
        setTotal(0);

        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat daftar departemen.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, search, revision]);

  function refresh() {
    setLoading(true);
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

  function openEdit(item: Department) {
    if (saving) return;

    blurActiveElement();
    setEditing(item);

    setForm({
      code: item.code,
      name: item.name,
      description: item.description || "",
    });

    setFormError("");
    setShowForm(true);
  }

  function openDetail(item: Department) {
    blurActiveElement();
    setDetail(item);
  }

  function closeForm() {
    if (saving) return;

    blurActiveElement();
    setShowForm(false);
    setFormError("");
  }

  function updateField<K extends keyof DepartmentInput>(
    field: K,
    value: DepartmentInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFormError("");
  }

  function save() {
    if (saving) return;

    const input: DepartmentInput = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: supportsDescription ? form.description.trim() : "",
    };

    if (!/^[A-Z0-9_-]{2,40}$/.test(input.code)) {
      setFormError(
        "Kode departemen harus 2–40 karakter, menggunakan huruf, angka, - atau _.",
      );
      return;
    }

    if (input.name.length < 2 || input.name.length > 150) {
      setFormError("Nama departemen harus terdiri dari 2–150 karakter.");
      return;
    }

    if (input.description.length > 1000) {
      setFormError("Deskripsi maksimal 1000 karakter.");
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
      title: isEditing
        ? "Simpan Perubahan Departemen?"
        : "Tambahkan Departemen?",
      text: isEditing
        ? `Perubahan "${pending.input.name}" akan disimpan.`
        : `Departemen "${pending.input.name}" akan ditambahkan.`,
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
          ? "Departemen berhasil diperbarui."
          : "Departemen berhasil ditambahkan.",
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Gagal menyimpan departemen.";

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

  async function remove(item: Department) {
    if (saving) return;

    blurActiveElement();

    if (item.asset_count > 0) {
      await Swal.fire({
        icon: "warning",
        title: "Departemen Masih Digunakan",
        text: `Departemen ini masih digunakan oleh ${item.asset_count} aset. Pindahkan aset terlebih dahulu sebelum menghapusnya.`,
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
      return;
    }

    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Hapus Departemen?",
      text: `Departemen "${item.name}" akan dihapus secara permanen.`,
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
        text: `Departemen "${item.name}" berhasil dihapus.`,
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text:
          err instanceof Error ? err.message : "Gagal menghapus departemen.",
        confirmButtonText: "OK",
        returnFocus: false,
        heightAuto: false,
      });
    } finally {
      setSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1">Master Departemen</h1>
          <p className="text-body-secondary mb-0">
            Pengelolaan unit kerja dan penanggung jawab aset
          </p>
        </div>

        <Button onClick={openCreate} disabled={saving}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Tambah Departemen
        </Button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center gap-2">
          <strong>
            <FontAwesomeIcon icon={faBuilding} className="me-2" />
            Data Departemen
          </strong>

          <Badge bg="primary">{total} departemen</Badge>
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
              placeholder="Cari kode atau nama departemen..."
              aria-label="Cari departemen"
              className="flex-grow-1"
              style={{ minWidth: 180 }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <Button type="submit" variant="outline-primary" disabled={loading}>
              <FontAwesomeIcon icon={faMagnifyingGlass} className="me-2" />
              Cari
            </Button>

            <Button
              type="button"
              variant="outline-secondary"
              disabled={loading}
              onClick={refresh}
              title="Muat ulang"
              aria-label="Muat ulang departemen"
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </Button>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" className="me-2" />
              Memuat data departemen...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              Belum ada departemen yang ditemukan.
            </div>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table responsive hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>No.</th>
                      <th>Kode</th>
                      <th>Nama Departemen</th>
                      {supportsDescription && <th>Deskripsi</th>}
                      <th>Jumlah Aset</th>
                      <th>Tanggal Dibuat</th>
                      <th className="text-end">Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="fw-semibold">
                          {(page - 1) * limit + index + 1}
                        </td>

                        <td className="fw-semibold text-nowrap">{item.code}</td>

                        <td>{item.name}</td>

                        {supportsDescription && (
                          <td style={{ maxWidth: 280 }}>
                            <Description value={item.description} />
                          </td>
                        )}

                        <td>
                          <Badge
                            bg={item.asset_count > 0 ? "primary" : "secondary"}
                          >
                            {item.asset_count} aset
                          </Badge>
                        </td>

                        <td className="text-nowrap">
                          {formatDate(item.created_at)}
                        </td>

                        <td className="text-end text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1"
                            title="Detail"
                            aria-label={`Detail ${item.name}`}
                            onClick={() => openDetail(item)}
                          >
                            <FontAwesomeIcon icon={faEye} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-1"
                            title="Edit"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => openEdit(item)}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-danger"
                            title="Hapus"
                            aria-label={`Hapus ${item.name}`}
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
                            <div>
                              <Badge bg="secondary" className="mb-2">
                                No. {(page - 1) * limit + index + 1}
                              </Badge>

                              <div className="small text-body-secondary">
                                {item.code}
                              </div>

                              <h2 className="h6 text-break mt-1">
                                {item.name}
                              </h2>
                            </div>

                            <FontAwesomeIcon
                              icon={faBuilding}
                              className="text-body-secondary"
                            />
                          </div>

                          <hr />

                          {supportsDescription && (
                            <div className="small mb-3">
                              <Description value={item.description} />
                            </div>
                          )}

                          <div className="mb-3">
                            <Badge
                              bg={
                                item.asset_count > 0 ? "primary" : "secondary"
                              }
                            >
                              {item.asset_count} aset
                            </Badge>
                          </div>

                          <div className="d-flex gap-2 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => openDetail(item)}
                            >
                              <FontAwesomeIcon icon={faEye} className="me-1" />
                              Detail
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEdit(item)}
                            >
                              <FontAwesomeIcon icon={faPen} className="me-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-danger"
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
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {editing ? "Edit Departemen" : "Tambah Departemen"}
          </Modal.Title>
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
                Kode Departemen <span className="text-danger">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={40}
                pattern={String.raw`[A-Za-z0-9_\-]{2,40}`}
                placeholder="Contoh: DEP-001"
                value={form.code}
                disabled={saving}
                onChange={(event) =>
                  updateField("code", event.target.value.toUpperCase())
                }
              />

              <Form.Text muted>Kode unik maksimal 40 karakter.</Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Nama Departemen <span className="text-danger">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={150}
                placeholder="Contoh: Information Technology"
                value={form.name}
                disabled={saving}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </Form.Group>

            {supportsDescription && (
              <Form.Group className="mb-3">
                <Form.Label>Deskripsi</Form.Label>

                <Form.Control
                  as="textarea"
                  rows={4}
                  maxLength={1000}
                  placeholder="Jelaskan fungsi departemen..."
                  value={form.description}
                  disabled={saving}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </Form.Group>
            )}

            {formError && (
              <div className="alert alert-danger mb-0" role="alert">
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

            <Button type="submit" disabled={saving || loading}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Menyimpan...
                </>
              ) : editing ? (
                "Simpan Perubahan"
              ) : (
                "Simpan Departemen"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal
        show={detail !== null}
        onHide={() => {
          blurActiveElement();
          setDetail(null);
        }}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Detail Departemen</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {detail && (
            <div className="d-flex flex-column gap-3">
              <div>
                <div className="text-body-secondary small">Kode Departemen</div>
                <strong>{detail.code}</strong>
              </div>

              <div>
                <div className="text-body-secondary small">Nama Departemen</div>
                <strong>{detail.name}</strong>
              </div>

              {supportsDescription && (
                <div>
                  <div className="text-body-secondary small">Deskripsi</div>
                  <p className="mb-0 text-break">{detail.description || "—"}</p>
                </div>
              )}

              <hr className="my-0" />

              <Row className="g-3">
                <Col xs={6}>
                  <div className="text-body-secondary small">Jumlah Aset</div>
                  <Badge bg="primary">{detail.asset_count} aset</Badge>
                </Col>

                <Col xs={6}>
                  <div className="text-body-secondary small">
                    Tanggal Dibuat
                  </div>
                  {formatDate(detail.created_at)}
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              blurActiveElement();
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
