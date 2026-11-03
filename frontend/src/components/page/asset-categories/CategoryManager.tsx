"use client";

import Image from "next/image";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faPen,
  faTrash,
  faMagnifyingGlass,
  faArrowsRotate
} from "@fortawesome/free-solid-svg-icons";
import { Button, Form, Modal, Spinner } from "react-bootstrap";

type Category = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  has_image: boolean;
};

type FormData = {
  code: string;
  name: string;
  description: string;
  is_active: boolean;
};

type ListResponse = {
  data: Category[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

const emptyForm: FormData = {
  code: "",
  name: "",
  description: "",
  is_active: true
};

async function api<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(
    `/api/asset-categories${path}`,
    {
      ...options,
      cache: "no-store",
      headers: {
        ...(options?.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options?.headers
      }
    }
  );

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message || `Permintaan gagal (${response.status})`
    );
  }

  return result as T;
}

export default function CategoryManager() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      page: String(page),
      q: search
    });

    void api<ListResponse>(`?${params.toString()}`)
      .then((result) => {
        if (cancelled) return;

        setItems(result.data ?? []);
        setTotal(result.pagination.total);
        setLimit(result.pagination.limit);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setItems([]);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat kategori"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, revision]);


  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseImage(file: File | null) {
    if (!file) {
      setImageFile(null);
      setPreviewUrl(null);
      return;
    }

    const validExtension = /\.(jpe?g|png|webp)$/i.test(file.name);
    const validType = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ].includes(file.type);

    if (!validExtension || !validType) {
      setFormError("Gambar harus JPG, JPEG, PNG, atau WebP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFormError("Ukuran gambar maksimal 10 MB.");
      return;
    }

    if (file.size === 0) {
      setFormError("File gambar tidak boleh kosong.");
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveImage(false);
    setFormError("");
  }

  function openCreate() {
    setEditing(null);
    setImageFile(null);
    setPreviewUrl(null);
    setRemoveImage(false);
    setForm({ ...emptyForm });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: Category) {
    setEditing(item);
    setImageFile(null);
    setPreviewUrl(null);
    setRemoveImage(false);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description,
      is_active: item.is_active
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    if (saving) return;

    const confirmSave = await Swal.fire({
      title: editing
        ? "Simpan perubahan kategori?"
        : "Tambah kategori baru?",
      text: editing
        ? `Perubahan kategori "${form.name}" akan disimpan.`
        : `Kategori "${form.name}" akan ditambahkan.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: editing
        ? "Ya, Simpan Perubahan"
        : "Ya, Tambahkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#0d6efd",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false
    });

    if (!confirmSave.isConfirmed) return;

    setSaving(true);
    setFormError("");

    try {
      const result = await api<{ data: Category }>(
        editing ? `/${editing.id}` : "",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(form)
        }
      );

      try {
        if (imageFile) {
          const upload = new FormData();
          upload.append("image", imageFile);

          await api(`/${result.data.id}/image`, {
            method: "POST",
            body: upload
          });
        } else if (editing && removeImage) {
          await api(`/${result.data.id}/image`, {
            method: "DELETE"
          });
        }
      } catch (uploadError) {
        const message = uploadError instanceof Error
          ? uploadError.message
          : "Gagal mengunggah gambar.";

        setEditing(result.data);
        setNotice(
          "Data kategori tersimpan, tetapi gambar belum berhasil diproses."
        );
        refresh();

        await Swal.fire({
          title: "Gambar belum tersimpan",
          text: `Data kategori sudah tersimpan. ${message}`,
          icon: "warning",
          confirmButtonText: "Periksa Kembali",
          confirmButtonColor: "#d97706",
          heightAuto: false
        });

        return;
      }

      const message = editing
        ? "Data kategori aset berhasil diperbarui dan disimpan ke dalam sistem. Perubahan terbaru kini dapat dilihat pada tabel daftar kategori aset."
        : "Kategori berhasil ditambahkan.";

      setShowForm(false);
      setImageFile(null);
      setPreviewUrl(null);
      setRemoveImage(false);
      setNotice("");
      refresh();

      void Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: message,
        confirmButtonText: "OK",
        heightAuto: false
      });

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Gagal menyimpan kategori.";

      setFormError(message);

      await Swal.fire({
        title: "Gagal Menyimpan",
        text: message,
        icon: "error",
        confirmButtonText: "Coba Lagi",
        confirmButtonColor: "#dc3545",
        heightAuto: false
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Category) {
    if (saving) return;

    const confirmation = await Swal.fire({
      title: "Yakin ingin menghapus?",
      text: `Kategori "${item.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, Hapus",
      cancelButtonText: "Tidak, Batalkan",
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false
    });

    if (!confirmation.isConfirmed) return;

    setSaving(true);
    setError("");

    try {
      await api(`/${item.id}`, {
        method: "DELETE"
      });

      setNotice("");

      if (items.length === 1 && page > 1) {
        setLoading(true);
        setPage((value) => value - 1);
      } else {
        refresh();
      }

      void Swal.fire({
        icon: "success",
        title: "Berhasil Dihapus!",
        text: `Kategori "${item.name}" berhasil dihapus.`,
        confirmButtonText: "OK",
        heightAuto: false
      });

    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Gagal menghapus kategori.";

      setError(message);

      await Swal.fire({
        title: "Gagal Menghapus",
        text: message,
        icon: "error",
        confirmButtonText: "Mengerti",
        confirmButtonColor: "#dc3545",
        heightAuto: false
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
          <h1 className="h3 mb-1">Kategori Aset</h1>
          <p className="text-body-secondary mb-0">
            Manajemen klasifikasi aset perusahaan
          </p>
        </div>

        <Button onClick={openCreate}>
          <FontAwesomeIcon icon={faPlus} className="me-2" />
          Tambah Kategori
        </Button>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
          <button
            className="btn-close float-end"
            type="button"
            aria-label="Tutup"
            onClick={() => setNotice("")}
          />
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <strong>Daftar Kategori Aset</strong>
          <span className="badge bg-primary">
            {total} kategori
          </span>
        </div>

        <div className="card-body">
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
              className="flex-grow-1"
              style={{ minWidth: 220 }}
              placeholder="Cari kode atau nama kategori"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
            />

            <Button variant="outline-primary" type="submit">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </Button>

            <Button
              variant="outline-secondary"
              type="button"
              disabled={loading}
              onClick={refresh}
            >
              <FontAwesomeIcon icon={faArrowsRotate} />
            </Button>
          </Form>

          <div className="table-responsive af-category-table-responsive">
            <table className="table table-hover align-middle af-category-table">
              <thead className="table-light">
                <tr>
                  <th>Gambar</th>
                  <th>Kode</th>
                  <th>Nama Kategori</th>
                  <th>Deskripsi</th>
                  <th>Status</th>
                  <th className="text-end">Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-5">
                      <Spinner size="sm" className="me-2" />
                      Memuat data...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-body-secondary py-5"
                    >
                      Belum ada kategori aset.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.has_image ? (
                          <Image
                            unoptimized
                            src={`/api/asset-categories/${item.id}/image`}
                            alt={`Gambar kategori ${item.name}`}
                            width={48}
                            height={48}
                            className="rounded border"
                            style={{ objectFit: "cover" }}
                          />
                        ) : (
                          <span className="text-body-secondary small">
                            —
                          </span>
                        )}
                      </td>
                      <td className="fw-semibold">{item.code}</td>
                      <td>{item.name}</td>
                      <td className="af-category-description-cell">
                        <span
                          className="af-category-description-preview"
                          title={item.description || ""}
                        >
                          {item.description || "—"}
                        </span>

                        {item.description &&
                          item.description.length > 55 && (
                            <details className="af-category-description-more">
                              <summary>Baca lengkap</summary>
                              <p className="mb-0 mt-2 text-break">
                                {item.description}
                              </p>
                            </details>
                          )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.is_active
                              ? "bg-success"
                              : "bg-secondary"
                          }`}
                        >
                          {item.is_active ? "Aktif" : "Tidak Aktif"}
                        </span>
                      </td>
                      <td className="text-end text-nowrap">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          title="Edit"
                          aria-label={`Edit ${item.name}`}
                          onClick={() => openEdit(item)}
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          title="Hapus"
                          aria-label={`Hapus ${item.name}`}
                          onClick={() => void remove(item)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mt-3">
            <small className="text-body-secondary">
              Halaman {page} dari {totalPages}
            </small>

            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={page <= 1 || loading}
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
                disabled={page >= totalPages || loading}
                onClick={() => {
                  setLoading(true);
                  setPage((value) => value + 1);
                }}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        show={showForm}
        centered
        backdrop={saving ? "static" : true}
        onHide={() => {
          if (!saving) setShowForm(false);
        }}
      >
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            {editing ? "Edit Kategori Aset" : "Tambah Kategori Aset"}
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
              <Form.Label>Upload Gambar Kategori</Form.Label>

              <Form.Control
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  chooseImage((event.currentTarget as HTMLInputElement).files?.[0] ?? null)
                }
              />

              <Form.Text muted>
                JPG, JPEG, PNG atau WebP. Maksimal 10 MB.
              </Form.Text>

              {(previewUrl ||
                (editing?.has_image && !removeImage)) && (
                <div className="d-flex align-items-center gap-3 mt-3">
                  <Image
                    unoptimized
                    src={
                      previewUrl ||
                      `/api/asset-categories/${editing?.id}/image`
                    }
                    alt="Preview gambar kategori"
                    width={100}
                    height={100}
                    className="rounded border"
                    style={{ objectFit: "cover" }}
                  />

                  <Button
                    type="button"
                    variant="outline-danger"
                    size="sm"
                    onClick={() => {
                      setImageFile(null);
                      setPreviewUrl(null);
                      setRemoveImage(true);
                    }}
                  >
                    Hapus Gambar
                  </Button>
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Kode Kategori</Form.Label>
              <Form.Control
                required
                maxLength={40}
                placeholder="Contoh: ELEKTRONIK"
                value={form.code}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    code: event.target.value.toUpperCase()
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nama Kategori</Form.Label>
              <Form.Control
                required
                maxLength={120}
                placeholder="Contoh: Perangkat Elektronik"
                value={form.name}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    name: event.target.value
                  }))
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Deskripsi</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    description: event.target.value
                  }))
                }
              />
            </Form.Group>

            <Form.Check
              type="switch"
              label="Kategori Aktif"
              checked={form.is_active}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  is_active: event.target.checked
                }))
              }
            />

            {formError && (
              <div className="alert alert-danger mt-3 mb-0">
                {formError}
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setShowForm(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
}
