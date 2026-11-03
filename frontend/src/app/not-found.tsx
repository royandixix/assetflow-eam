
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-vh-100 d-flex flex-column align-items-center justify-content-center text-center p-4">
      <h1 className="display-2 fw-bold text-primary">404</h1>
      <h2 className="h4 fw-bold">Halaman tidak ditemukan</h2>

      <p className="text-body-secondary">
        Halaman yang kamu cari belum tersedia di AssetFlow EAM.
      </p>

      <Link href="/" className="btn btn-primary mt-3">
        Kembali ke Beranda
      </Link>
    </main>
  );
}
