
import Link from "next/link";
import LogoutButton from "@/components/logout-button";

export default function UnauthorizedPage() {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4">
      <div className="card border-0 shadow-sm p-4 text-center" style={{ maxWidth: 480 }}>
        <div className="card-body">
          <h1 className="h3 fw-bold">Akses Tidak Diizinkan</h1>

          <p className="text-body-secondary my-4">
            Akun belum mempunyai profil aktif atau izin akses
            yang diperlukan. Hubungi administrator AssetFlow.
          </p>

          <div className="d-flex flex-wrap justify-content-center gap-3">
            <Link href="/" className="btn btn-outline-secondary">
              Beranda
            </Link>

            <LogoutButton />
          </div>
        </div>
      </div>
    </main>
  );
}
