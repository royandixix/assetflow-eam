# AssetFlow EAM

### Sistem Manajemen Aset Perusahaan Berbasis Web

**AssetFlow EAM (Enterprise Asset Management)** merupakan aplikasi manajemen aset perusahaan berbasis web yang dirancang untuk mendukung pencatatan, pengelolaan, pemantauan, dan pemeliharaan aset secara terpusat.

Sistem dikembangkan menggunakan arsitektur **Full-Stack Web Application** dengan teknologi **Next.js, React, TypeScript, Go, Gin, PostgreSQL, dan Supabase**.

Aplikasi ini mengintegrasikan pengelolaan data aset, kategori, lokasi, departemen, penugasan aset, perpindahan aset, laporan kerusakan, serta pengelolaan pekerjaan teknisi melalui mekanisme akses berbasis peran pengguna.

> **Status Proyek:** Dalam tahap pengembangan aktif (*Active Development*). Sejumlah modul telah diimplementasikan, sedangkan integrasi lanjutan, pengujian hak akses, dan penyempurnaan sistem masih berlangsung.

---

## 1. Gambaran Umum

AssetFlow EAM dikembangkan sebagai sistem informasi untuk membantu organisasi mengelola aset operasional dalam satu platform.

Pengembangan sistem berfokus pada keterhubungan data aset dengan struktur organisasi, pencatatan penggunaan aset, pelaporan kerusakan, dan proses penanganan pemeliharaan.

Dengan pendekatan aplikasi web, pengelolaan aset dapat dilakukan melalui antarmuka terpusat yang terhubung dengan backend REST API serta database PostgreSQL.

## 2. Teknologi yang Digunakan

| Komponen | Teknologi |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| UI Framework | React Bootstrap |
| Backend | Go (Golang), Gin Framework |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Database Driver | pgx / pgxpool |
| API | REST API |
| Pengembangan | macOS, Visual Studio Code |
| Version Control | Git & GitHub |

### Arsitektur Sistem

Sistem menerapkan pemisahan antara frontend, backend, layanan autentikasi, dan database.

```text
                  PENGGUNA
                      |
                      v
           FRONTEND APPLICATION
        Next.js + React + TypeScript
                      |
                      v
                 REST API
                Go + Gin
                      |
          +-----------+-----------+
          |                       |
          v                       v
    SUPABASE AUTH           POSTGRESQL
    Autentikasi             Penyimpanan
    dan Identitas           Data Sistem
```

Frontend bertanggung jawab menyediakan antarmuka pengguna, sedangkan backend menangani proses bisnis, validasi, otorisasi, dan komunikasi database.

## 3. Modul Aplikasi

### A. Manajemen Aset

Modul manajemen aset mencakup:

- Pengelolaan data aset.
- Pengelolaan kategori aset.
- Pengelolaan lokasi aset.
- Pengelolaan departemen.
- Pencatatan penugasan aset.
- Pengembalian aset.
- Pengelolaan perpindahan aset.

### B. Maintenance Management

Modul pemeliharaan aset mendukung proses pelaporan kerusakan dan verifikasi laporan.

Fitur yang telah diimplementasikan mencakup:

- Pengajuan laporan kerusakan aset.
- Pencatatan informasi kerusakan.
- Pemeriksaan laporan Maintenance.
- Persetujuan atau penolakan laporan.
- Pemantauan status laporan.

### C. Work Order Management

Modul Work Order digunakan untuk mengelola pekerjaan pemeliharaan berdasarkan laporan yang telah disetujui.

Fungsi yang dikembangkan mencakup:

- Pembuatan Work Order dari laporan Maintenance.
- Pemilihan teknisi yang bertanggung jawab.
- Pencatatan pekerjaan pemeliharaan.
- Perubahan status pekerjaan.
- Penyelesaian dan penutupan Work Order.

Pengujian integrasi penugasan teknisi dan pembatasan akses berdasarkan peran masih berlangsung.

### D. User & Role Management

Sistem menggunakan Supabase Authentication dan data profil pengguna untuk mengelola identitas serta hak akses.

Terdapat lima peran pengguna:

| Role | Tanggung Jawab |
|---|---|
| SUPER_ADMIN | Pengelolaan dan administrasi sistem |
| ASSET_ADMIN | Pengelolaan operasional aset |
| MANAGER | Pengawasan dan proses manajerial |
| TECHNICIAN | Pelaksanaan tugas pemeliharaan |
| STAFF | Penggunaan fitur operasional sesuai kewenangan |

Sistem menerapkan pendekatan **Role-Based Access Control (RBAC)** untuk membatasi akses sesuai peran pengguna.

Sebagian pengujian otorisasi dan proses undangan pengguna masih dalam tahap penyempurnaan.

## 4. Struktur Proyek

AssetFlow EAM menggunakan struktur repository Full-Stack dengan pemisahan frontend, backend, dan migrasi database.

```text
assetflow-eam/
├── backend/
│   ├── cmd/
│   ├── internal/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── modules/
│   │   └── router/
│   └── go.mod
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── supabase/
│   └── migrations/
├── .gitignore
└── README.md
```

## 5. Cara Menjalankan Aplikasi

### Persyaratan

Sebelum menjalankan proyek, pastikan lingkungan pengembangan telah menyediakan:

- Node.js dan npm.
- Go (Golang).
- Proyek Supabase.
- Koneksi PostgreSQL.
- Visual Studio Code atau editor kode lainnya.

### Menjalankan Backend

Masuk ke direktori backend:

```bash
cd backend
```

Jalankan aplikasi:

```bash
go run ./cmd/api
```

Alamat backend pada lingkungan pengembangan:

```text
http://127.0.0.1:8083
```

### Menjalankan Frontend

Buka Terminal baru dan masuk ke direktori frontend:

```bash
cd frontend
```

Instal dependensi:

```bash
npm install
```

Jalankan server pengembangan:

```bash
npm run dev
```

Akses aplikasi melalui browser:

```text
http://localhost:3001
```

### Konfigurasi Environment

Aplikasi membutuhkan konfigurasi environment untuk menghubungkan frontend, backend, database, dan layanan autentikasi.

Contoh konfigurasi frontend:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
ASSETFLOW_API_URL=http://127.0.0.1:8083
```

Konfigurasi backend memerlukan pengaturan database dan Supabase sesuai kebutuhan sistem.

**Catatan keamanan:** File `.env`, connection string yang memuat password, dan API key rahasia tidak boleh dipublikasikan ke repository.

## 6. Keamanan Sistem

Pengembangan AssetFlow EAM memperhatikan beberapa aspek keamanan aplikasi, antara lain:

- Autentikasi pengguna menggunakan Supabase Auth.
- Pengelolaan hak akses berbasis role.
- Validasi akses melalui backend API.
- Pemisahan kredensial dari source code.
- Penggunaan koneksi database yang aman.
- Pembatasan fitur administratif berdasarkan kewenangan.

Evaluasi keamanan dan pengujian lanjutan tetap diperlukan sebelum sistem digunakan secara publik.

## 7. Rencana Pengembangan

Pengembangan berikutnya meliputi:

- Penyempurnaan integrasi Work Order dan penugasan teknisi.
- Pengembangan Preventive Maintenance.
- Pengembangan Inventory & Vendor Management.
- Implementasi laporan operasional.
- Sistem notifikasi.
- Audit Trail aktivitas pengguna.
- Integrasi dashboard dengan data operasional sebenarnya.
- Pengujian sistem dan penyempurnaan keamanan.
- Persiapan deployment.

## 8. Status Implementasi

| Modul | Status |
|---|---|
| Manajemen Kategori Aset | Diimplementasikan |
| Manajemen Lokasi | Diimplementasikan |
| Manajemen Departemen | Diimplementasikan |
| Manajemen Data Aset | Diimplementasikan |
| Penugasan dan Pengembalian Aset | Diimplementasikan |
| Perpindahan Aset | Diimplementasikan |
| Maintenance Management | Diimplementasikan |
| Work Order Management | Pengujian integrasi |
| User & Role Management | Pengujian integrasi |
| Preventive Maintenance | Direncanakan |
| Inventory & Vendor | Direncanakan |
| Reports & Notifications | Direncanakan |
| Audit Trail | Direncanakan |

Status tersebut menunjukkan perkembangan implementasi modul, bukan hasil pengujian akhir atau pernyataan bahwa sistem sudah siap digunakan pada lingkungan produksi.

## 9. Tentang Pengembang

**Royandi Randi**

Software Engineer | Full-Stack Web Developer

Pengembangan proyek ini berfokus pada implementasi aplikasi web dengan arsitektur frontend dan backend terpisah, integrasi database, autentikasi pengguna, pengelolaan proses bisnis, serta pengembangan REST API.

**GitHub:** [github.com/royandixix](https://github.com/royandixix)

---

**AssetFlow EAM** — Pengembangan Sistem Manajemen Aset Perusahaan yang Terintegrasi, Terstruktur, dan Berbasis Web.