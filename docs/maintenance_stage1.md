# AssetFlow EAM — Maintenance Tahap 1

Alur: laporan kerusakan aset, prioritas, riwayat, dan verifikasi laporan.

SUPER_ADMIN, ASSET_ADMIN, dan MANAGER dapat membuat serta memverifikasi laporan.

STAFF dan TECHNICIAN dapat melaporkan aset yang sedang ditugaskan kepadanya dan melihat laporannya sendiri.

Status aset tidak berubah otomatis.

Work Orders dan perubahan status MAINTENANCE dibuat pada tahap berikutnya.

Migrasi Supabase dibuat sebagai file dan tidak dijalankan otomatis.

Periksa struktur database Production sebelum menjalankan migrasi melalui SQL Editor.

Setelah migrasi dan pengujian build, restart backend dan buka /dashboard/maintenance.
