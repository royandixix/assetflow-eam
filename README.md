
# AssetFlow EAM

### Enterprise Asset Management System

AssetFlow EAM adalah sistem informasi manajemen aset perusahaan berbasis web yang dirancang untuk mendukung pengelolaan inventaris, penugasan aset, mutasi, pemeliharaan, work orders, vendor, dan pemantauan operasional melalui satu platform terintegrasi.

Sistem dikembangkan menggunakan Next.js dan TypeScript pada frontend, Go dengan framework Gin pada backend, serta PostgreSQL melalui Supabase sebagai penyimpanan data.

---

## Overview

AssetFlow EAM membantu organisasi mengelola siklus operasional aset secara terstruktur, mulai dari pencatatan hingga pemantauan dan pemeliharaan.

Arsitektur aplikasi memisahkan antarmuka pengguna, layanan API, autentikasi, dan database agar setiap komponen dapat dikembangkan serta dipelihara secara independen.

### Core Capabilities

- Centralized Asset Management
- Asset Assignment & Transfer Management
- Maintenance Request Management
- Work Order Management
- Vendor Management
- Operational Reporting
- Audit Trail
- Role-Based Access Control

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript |
| UI Framework | CoreUI, React Bootstrap |
| Styling | CSS Modules, Bootstrap |
| Data Visualization | Chart.js |
| Backend | Go, Gin Framework |
| Database | PostgreSQL |
| Database Platform | Supabase |
| Authentication | Supabase Auth |
| API Architecture | REST API |
| Database Driver | pgx / pgxpool |
| Development Environment | macOS, VS Code |

## System Features

### 1. Asset Management

Pengelolaan data aset dalam sistem terpusat.

Fitur meliputi:

- Pencatatan dan pengelolaan aset.
- Pengelompokan kategori aset.
- Pengelolaan lokasi aset.
- Pengelolaan departemen.
- Pemantauan status aset.

### 2. Asset Assignment

Pengelolaan penugasan aset kepada pengguna atau unit yang bertanggung jawab.

### 3. Asset Transfer

Pencatatan perpindahan aset antar lokasi atau penanggung jawab, termasuk informasi dan status mutasi.

### 4. Maintenance Management

Pengelolaan permintaan pemeliharaan aset dan pemantauan tindak lanjut pekerjaan.

### 5. Work Order Management

Pengelolaan pekerjaan teknisi, penugasan, perkembangan status, dan penyelesaian pekerjaan pemeliharaan.

### 6. Vendor Management

Pengelolaan informasi vendor yang mendukung kebutuhan operasional perusahaan.

### 7. Operational Dashboard

Dashboard menggunakan komponen CoreUI dan visualisasi Chart.js untuk menampilkan ringkasan operasional.

Data ringkasan bersumber dari API Reports, bukan angka contoh template.

### 8. Reports

Penyajian informasi operasional untuk mendukung monitoring dan evaluasi pengelolaan aset.

Termasuk ringkasan aset, maintenance, work orders, dan vendor serta fitur ekspor laporan sesuai endpoint yang tersedia.

### 9. Audit Trail

Pencatatan aktivitas perubahan melalui middleware backend untuk mendukung penelusuran aktivitas operasional.

Audit Trail mencatat operasi yang didukung sistem, termasuk aktivitas perubahan data pada modul terkait.

### 10. Application Settings

Pengaturan aplikasi meliputi identitas organisasi, informasi kontak, zona waktu, dan format tanggal.

Pengaturan tampilan dan keamanan akun dikelola melalui modul pengaturan pengguna.

### 11. Public Landing Page

Halaman beranda publik dilengkapi dengan:

- Tampilan enterprise responsif.
- Informasi produk dan modul sistem.
- Fotografi industri.
- Animasi scroll dan micro-interactions.
- Eksplorasi alur operasional interaktif.
- Navigasi menuju halaman autentikasi.

## User Roles

AssetFlow EAM menggunakan lima peran pengguna.

| Role | Responsibilities |
|---|---|
| SUPER_ADMIN | Administrasi sistem dan pengelolaan pengguna |
| ASSET_ADMIN | Pengelolaan aset dan operasional aset |
| MANAGER | Pemantauan laporan dan operasional |
| TECHNICIAN | Pelaksanaan pekerjaan pemeliharaan |
| STAFF | Aktivitas operasional berdasarkan izin |

Hak akses setiap endpoint ditentukan melalui middleware dan aturan otorisasi backend.

Role pada database tidak dengan sendirinya memberikan akses ke semua fitur.

## System Architecture

```text
User / Web Browser
        |
        v
Next.js Frontend
        |
        +---- Public Landing Page
        |
        +---- Authentication
        |
        +---- Dashboard & Operational Modules
        |
        v
Next.js API Routes
        |
        | Authenticated API Requests
        v
Go REST API (Gin)
        |
        +---- Authentication Middleware
        |
        +---- Authorization / Role Validation
        |
        +---- Business Logic
        |
        +---- Audit Logging
        |
        v
PostgreSQL Database
        |
        +---- Asset Data
        +---- Assignment & Transfer Data
        +---- Maintenance Data
        +---- Work Orders
        +---- Vendors
        +---- User Profiles
        +---- Application Settings

Supabase Auth
        |
        +---- Authentication Sessions
        +---- User Identity
```

## Project Structure

```text
assetflow-eam/
|
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── page.tsx
│   │   │   └── home.module.css
│   │   |
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   ├── auth/
│   │   │   ├── home/
│   │   │   └── page/
│   │   |
│   │   ├── lib/
│   │   └── locales/
│   |
│   └── package.json
|
├── backend/
│   ├── cmd/
│   │   └── api/
│   |
│   ├── internal/
│   │   ├── middleware/
│   │   ├── modules/
│   │   └── router/
│   |
│   ├── go.mod
│   └── go.sum
|
├── supabase/
│   └── migrations/
|
└── README.md
```

## Getting Started

### Prerequisites

Siapkan perangkat pengembangan dengan:

- Node.js dan npm yang kompatibel dengan versi Next.js proyek.
- Go sesuai versi yang ditentukan dalam `backend/go.mod`.
- PostgreSQL / proyek Supabase.
- Git.
- VS Code atau editor kode lainnya.

### Clone Repository

```bash
git clone <REPOSITORY_URL>
cd assetflow-eam
```

Ganti `<REPOSITORY_URL>` dengan URL repository GitHub.

### Frontend Installation

```bash
cd frontend
npm ci
```

Gunakan `npm install` apabila proyek belum mempunyai `package-lock.json`.

### Backend Installation

Buka Terminal terpisah:

```bash
cd backend
go mod download
```

### Environment Configuration

Aplikasi memerlukan variabel lingkungan untuk konfigurasi Supabase, API backend, dan koneksi database.

Frontend menggunakan konfigurasi Supabase Auth serta URL backend yang ditentukan pada konfigurasi proyek.

Contoh variabel frontend:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-public-key
ASSETFLOW_API_URL=http://127.0.0.1:8083
```

Nama variabel harus disesuaikan dengan implementasi konfigurasi yang digunakan oleh source code.

Konfigurasi backend mengikuti environment yang dibaca oleh layanan Go dan pengaturan koneksi database.

Jangan menyimpan database password, service-role key, access token, atau informasi rahasia lainnya di repository.

### Database Setup

Database menggunakan PostgreSQL.

File migrasi yang tersedia berada dalam:

```text
supabase/migrations/
```

Terapkan migrasi yang sesuai pada database pengembangan menggunakan proses migrasi proyek.

Hindari menjalankan migrasi langsung pada database production tanpa backup dan pemeriksaan dampak.

### Run Backend

```bash
cd backend
go run ./cmd/api
```

Alamat backend mengikuti konfigurasi server Go.

### Run Frontend

```bash
cd frontend
npm run dev
```

Pada lingkungan pengembangan AssetFlow EAM, frontend digunakan melalui:

```text
http://localhost:3001
```

Port aktual dapat berbeda mengikuti konfigurasi dan output Terminal.

## Application Routes

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/login` | User authentication |
| `/register` | Registration interface |
| `/dashboard` | Operational dashboard |
| `/dashboard/assets` | Asset management |
| `/dashboard/assignments` | Asset assignments |
| `/dashboard/transfers` | Asset transfers |
| `/dashboard/maintenance` | Maintenance management |
| `/dashboard/work-orders` | Work order management |
| `/dashboard/vendors` | Vendor management |
| `/dashboard/reports` | Operational reports |
| `/dashboard/notifications` | Notification interface |
| `/dashboard/users` | User administration |
| `/dashboard/settings` | Application settings |

Sebagian halaman memerlukan autentikasi serta role tertentu.

## Testing and Validation

### Frontend

```bash
cd frontend

npx next typegen
npx tsc --noEmit
npx eslint .
npm run build
```

### Backend

```bash
cd backend

go test ./...
go vet ./...
```

Pemeriksaan ini digunakan untuk validasi tipe, kualitas kode, kompilasi, dan pengujian backend yang tersedia.

Keberhasilan build tidak menggantikan pengujian fungsional, integrasi, dan keamanan.

## Security Considerations

Aplikasi menggunakan autentikasi dan sistem role untuk mengatur akses pengguna.

Praktik keamanan yang perlu dipertahankan:

- Tidak menyimpan credential di source code.
- Menjaga Supabase service-role key tetap di sisi server.
- Menggunakan middleware autentikasi pada endpoint privat.
- Memvalidasi izin pengguna melalui backend.
- Menghindari registrasi publik tanpa proses persetujuan.
- Melakukan pengujian keamanan sebelum deployment production.
- Menggunakan Audit Trail untuk mendukung pelacakan aktivitas.

## Development Notes

Landing page dan Dashboard merupakan dua bagian berbeda.

Landing page digunakan sebagai halaman informasi publik, sedangkan Dashboard dan modul operasional digunakan oleh pengguna yang telah melalui proses autentikasi.

Pengembangan tampilan tidak mengubah mekanisme penyimpanan data dan otorisasi backend.

## Further Improvements

Beberapa peningkatan yang dapat dikembangkan:

- Automated integration testing.
- End-to-end role permission testing.
- CI/CD pipeline.
- Monitoring dan observability.
- Penyempurnaan pengaturan tema.
- Penyempurnaan notifikasi.
- Peningkatan perlindungan dan integritas Audit Trail.

## Author

**Royandi**

Software Engineer / Web Developer

GitHub: https://github.com/royandixix

## License

Lisensi penggunaan dan distribusi proyek belum ditetapkan.

Seluruh kode tetap tunduk pada hak cipta masing-masing pemiliknya. Penggunaan ulang atau distribusi oleh pihak lain memerlukan izin yang sesuai.
