export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 fw-bold mb-1">
          Notifikasi Management
        </h1>

        <p className="text-body-secondary mb-0">
          Pusat pemberitahuan aktivitas aset, Maintenance,
          dan Work Orders.
        </p>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          <strong>Daftar Notifikasi</strong>
        </div>

        <div className="card-body text-center py-5">
          <h5>Sistem Notifikasi Belum Diaktifkan</h5>

          <p className="text-body-secondary mb-0">
            Integrasi notifikasi pengguna, status dibaca,
            dan aktivitas pekerjaan akan ditambahkan
            pada tahap implementasi backend.
          </p>
        </div>
      </div>
    </div>
  );
}
