
import Link from "next/link";
import { ArrowRight, Boxes, ShieldCheck, Wrench, ChartColumn } from "lucide-react";

const features = [
  {
    name: "Asset Management",
    description: "Pencatatan dan pengelolaan seluruh aset organisasi.",
    icon: Boxes
  },
  {
    name: "Maintenance",
    description: "Perencanaan dan pengawasan pekerjaan pemeliharaan.",
    icon: Wrench
  },
  {
    name: "Reporting",
    description: "Penyediaan laporan dan informasi operasional.",
    icon: ChartColumn
  },
  {
    name: "Access Control",
    description: "Pengaturan akses pengguna berdasarkan peran.",
    icon: ShieldCheck
  }
];

export default function HomePage() {
  return (
    <main className="af-landing">
      <header className="af-navbar py-4">
        <div className="container d-flex justify-content-between align-items-center">
          <Link href="/" className="af-brand fs-4 text-decoration-none">
            AssetFlow EAM
          </Link>

          <Link href="/login" className="btn btn-primary">
            Masuk Aplikasi
          </Link>
        </div>
      </header>

      <section className="af-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <span className="badge bg-primary-subtle text-primary px-3 py-2 mb-4">
                ENTERPRISE ASSET MANAGEMENT
              </span>

              <h1>
                Kelola aset perusahaan
                <span> dalam satu platform.</span>
              </h1>

              <p className="mt-4 mb-4">
                AssetFlow EAM membantu organisasi mengelola data aset,
                pemeliharaan, penugasan, dan proses operasional secara
                terstruktur melalui sistem terintegrasi.
              </p>

              <Link href="/login" className="btn btn-primary btn-lg">
                Buka Dashboard
                <ArrowRight size={18} className="ms-2" />
              </Link>
            </div>

            <div className="col-lg-5">
              <div className="af-preview">
                <div className="fw-bold mb-4">
                  AssetFlow Workspace
                </div>

                <div className="af-preview-main">
                  <Boxes size={70} strokeWidth={1.5} />
                  <h3 className="fs-5 fw-bold mt-4">
                    Centralized Asset Operations
                  </h3>
                  <small>
                    Assets · Maintenance · Reporting
                  </small>
                </div>

                <div className="text-body-secondary small mt-4">
                  Secure Enterprise Platform
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container pb-5">
        <div className="text-center mb-5">
          <h2 className="fw-bold">Fitur Utama</h2>
          <p className="text-body-secondary">
            Fondasi pengelolaan aset perusahaan yang modern.
          </p>
        </div>

        <div className="row g-4">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div className="col-md-6 col-xl-3" key={feature.name}>
                <div className="af-feature">
                  <Icon size={28} className="text-primary mb-4" />
                  <h3>{feature.name}</h3>
                  <p>{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="py-4 text-center text-body-secondary small">
        AssetFlow EAM · Enterprise Asset Management
      </footer>
    </main>
  );
}
