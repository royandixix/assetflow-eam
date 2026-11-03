"use client";

import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faLocationDot,
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

type Location = {
  id: string;
  code: string;
  name: string;
  description: string;
  created_at: string;
};

type LocationInput = {
  code: string;
  name: string;
  description: string;
};

type ListResponse = {
  data: Location[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const emptyForm: LocationInput = {
  code: "",
  name: "",
  description: "",
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/locations${path}`, {
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

      <p className="text-break small mt-2 mb-0">{value}</p>
    </details>
  );
}

export default function LocationManager() {
  const [items, setItems] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [revision, setRevision] = useState(0);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationInput>({
    ...emptyForm,
  });

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
        setTotal(result.pagination.total);
        setLimit(result.pagination.limit);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        setItems([]);
        setTotal(0);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat daftar lokasi aset.",
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
  }, [page, search, revision]);

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: Location) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description,
    });
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    if (!saving) {
      setShowForm(false);
      setFormError("");
    }
  }

  async function save() {
    if (saving) return;

    const input: LocationInput = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
    };

    if (!/^[A-Z0-9_-]{2,40}$/.test(input.code)) {
      setFormError(
        "Kode lokasi harus terdiri dari 2–40 karakter, menggunakan huruf, angka, tanda minus atau underscore.",
      );
      return;
    }

    if (input.name.length < 2 || input.name.length > 150) {
      setFormError("Nama lokasi harus terdiri dari 2–150 karakter.");
      return;
    }

    if (input.description.length > 2000) {
      setFormError("Deskripsi lokasi maksimal 2000 karakter.");
      return;
    }

    const confirmation = await Swal.fire({
      icon: "question",
      title: editing ? "Simpan Perubahan Lokasi?" : "Tambah Lokasi Baru?",
      text: editing
        ? `Data lokasi "${input.name}" akan diperbarui dan disimpan ke dalam sistem AssetFlow EAM.`
        : `Lokasi "${input.name}" akan ditambahkan sebagai master data lokasi aset perusahaan.`,
      showCancelButton: true,
      confirmButtonText: editing ? "Ya, Simpan Perubahan" : "Ya, Tambahkan",
      cancelButtonText: "Batal",
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false,
    });

    if (!confirmation.isConfirmed) return;

    setSaving(true);
    setFormError("");

    try {
      await api(editing ? `/${editing.id}` : "", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(input),
      });

      setShowForm(false);
      refresh();

      await Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: editing
          ? "Data lokasi aset berhasil diperbarui dan disimpan ke dalam sistem. Perubahan terbaru kini dapat dilihat pada daftar lokasi aset."
          : "Data lokasi aset berhasil ditambahkan dan disimpan ke dalam sistem. Lokasi ini sekarang tersedia sebagai master data untuk mendukung pengelolaan serta penempatan aset perusahaan.",
        confirmButtonText: "OK",
        heightAuto: false,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan data lokasi.";

      setFormError(message);

      await Swal.fire({
        icon: "error",
        title: "Gagal Menyimpan",
        text: message,
        confirmButtonText: "OK",
        heightAuto: false,
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Location) {
    if (saving) return;

    const confirmation = await Swal.fire({
      icon: "warning",
      title: "Yakin Ingin Menghapus?",
      text: `Lokasi "${item.name}" akan dihapus secara permanen dari master data lokasi. Tindakan ini tidak dapat dibatalkan.`,
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Tidak, Batalkan",
      confirmButtonColor: "#d33",
      reverseButtons: true,
      focusCancel: true,
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
        text: `Data lokasi "${item.name}" berhasil dihapus dari sistem. Daftar lokasi aset sekarang telah diperbarui.`,
        confirmButtonText: "OK",
        heightAuto: false,
      });
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "Gagal Menghapus",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menghapus lokasi aset.",
        confirmButtonText: "OK",
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
          <h1 className="h3 mb-1">Lokasi Aset</h1>
          <p className="text-body-secondary mb-0">
            Pengelolaan lokasi penyimpanan dan penempatan aset
          </p>
        </div>

        <Button onClick={openCreate}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Tambah Lokasi
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
            <FontAwesomeIcon icon={faLocationDot} className="me-2" />
            Daftar Lokasi Aset
          </strong>

          <Badge bg="primary">{total} lokasi</Badge>
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
              placeholder="Cari kode atau nama lokasi..."
              aria-label="Cari lokasi"
              className="flex-grow-1"
              style={{ minWidth: 180 }}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />

            <Button type="submit" variant="outline-primary">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="me-2" />
              Cari
            </Button>

            <Button
              type="button"
              variant="outline-secondary"
              onClick={refresh}
              disabled={loading}
              title="Muat ulang"
              aria-label="Muat ulang lokasi"
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </Button>
          </Form>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" className="me-2" />
              Memuat data lokasi...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center text-body-secondary py-5">
              Belum ada lokasi aset yang ditemukan.
            </div>
          ) : (
            <>
              <div className="d-none d-lg-block">
                <Table responsive hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>No.</th>
                      <th>Kode</th>
                      <th>Nama Lokasi</th>
                      <th>Deskripsi</th>
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

                        <td className="fw-semibold">{item.code}</td>

                        <td>{item.name}</td>

                        <td style={{ maxWidth: 350 }}>
                          <Description value={item.description} />
                        </td>

                        <td className="text-nowrap">
                          {formatDate(item.created_at)}
                        </td>

                        <td className="text-end text-nowrap">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            className="me-2"
                            title="Edit lokasi"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => openEdit(item)}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-danger"
                            title="Hapus lokasi"
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
                  {items.map((item) => (
                    <Col key={item.id}>
                      <Card className="h-100">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                            <div className="min-w-0">
                              <Badge bg="secondary" className="mb-2">
                                {item.code}
                              </Badge>

                              <h2 className="h6 text-break mb-0">
                                {item.name}
                              </h2>
                            </div>

                            <FontAwesomeIcon
                              icon={faLocationDot}
                              className="text-body-secondary"
                            />
                          </div>

                          <hr />

                          <div className="small text-body-secondary mb-1">
                            Deskripsi
                          </div>

                          <div className="small mb-3">
                            <Description value={item.description} />
                          </div>

                          <div className="small text-body-secondary mb-3">
                            Dibuat: {formatDate(item.created_at)}
                          </div>

                          <div className="d-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              className="flex-fill"
                              onClick={() => openEdit(item)}
                            >
                              <FontAwesomeIcon icon={faPen} className="me-2" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="flex-fill"
                              onClick={() => void remove(item)}
                            >
                              <FontAwesomeIcon
                                icon={faTrash}
                                className="me-2"
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
        centered
        backdrop={saving ? "static" : true}
        enforceFocus={false}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {editing ? "Edit Lokasi Aset" : "Tambah Lokasi Aset"}
          </Modal.Title>
        </Modal.Header>

        <Form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Kode Lokasi
                <span className="text-danger ms-1">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={40}
                pattern={String.raw`[A-Za-z0-9_\-]{2,40}`}
                placeholder="Contoh: LOK-001"
                value={form.code}
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    code: event.target.value.toUpperCase(),
                  }))
                }
              />

              <Form.Text muted>
                Kode harus unik, 2–40 karakter, menggunakan huruf, angka, - atau
                _.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Nama Lokasi
                <span className="text-danger ms-1">*</span>
              </Form.Label>

              <Form.Control
                required
                minLength={2}
                maxLength={150}
                placeholder="Contoh: Ruang Teknologi Informasi (IT)"
                value={form.name}
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Deskripsi</Form.Label>

              <Form.Control
                as="textarea"
                rows={4}
                maxLength={2000}
                placeholder="Jelaskan fungsi, kegunaan, atau penempatan aset pada lokasi ini..."
                value={form.description}
                disabled={saving}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />

              <div className="d-flex justify-content-between mt-1">
                <Form.Text muted>Opsional, maksimal 2000 karakter.</Form.Text>

                <small className="text-body-secondary">
                  {form.description.length}/2000
                </small>
              </div>
            </Form.Group>

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

            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Menyimpan...
                </>
              ) : editing ? (
                "Simpan Perubahan"
              ) : (
                "Simpan Lokasi"
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
