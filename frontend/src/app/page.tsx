import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRight,
  faArrowUpRightFromSquare,
  faBars,
  faBox,
  faChartLine,
  faCheckCircle,
  faChevronRight,
  faClipboardCheck,
  faDatabase,
  faLayerGroup,
  faLock,
  faRightLeft,
  faShieldHalved,
  faScrewdriverWrench,
  faTruck,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";

import styles from "./home.module.css";

type Feature = {
  number: string;
  title: string;
  description: string;
  icon: IconDefinition;
};

const features: Feature[] = [
  {
    number: "01",
    title: "Manajemen Aset",
    description:
      "Kelola data aset, kategori, lokasi, departemen, dan informasi inventaris secara terpusat.",
    icon: faBox,
  },
  {
    number: "02",
    title: "Penugasan & Mutasi",
    description:
      "Catat penempatan aset, perpindahan antar lokasi, serta perubahan penanggung jawab.",
    icon: faRightLeft,
  },
  {
    number: "03",
    title: "Maintenance",
    description:
      "Kelola permintaan pemeliharaan, pantau status penanganan, dan tindak lanjut kerusakan.",
    icon: faScrewdriverWrench,
  },
  {
    number: "04",
    title: "Work Orders",
    description:
      "Atur pekerjaan teknisi, status pengerjaan, dan penyelesaian tugas pemeliharaan aset.",
    icon: faClipboardCheck,
  },
  {
    number: "05",
    title: "Manajemen Vendor",
    description:
      "Simpan informasi vendor untuk membantu koordinasi pengadaan dan layanan operasional.",
    icon: faTruck,
  },
  {
    number: "06",
    title: "Laporan & Audit Trail",
    description:
      "Pantau ringkasan operasional serta aktivitas perubahan yang tercatat di dalam sistem.",
    icon: faChartLine,
  },
];

const steps = [
  {
    number: "01",
    title: "Pusatkan data aset",
    description:
      "Daftarkan aset beserta kategori, lokasi, dan unit yang bertanggung jawab.",
  },
  {
    number: "02",
    title: "Kelola proses operasional",
    description:
      "Proses penugasan, mutasi, maintenance, dan pekerjaan teknisi melalui modul terintegrasi.",
  },
  {
    number: "03",
    title: "Pantau dan evaluasi",
    description:
      "Gunakan dashboard, laporan, dan Audit Trail untuk meninjau kondisi operasional.",
  },
];

const roles = [
  {
    name: "Super Admin",
    code: "SUPER_ADMIN",
    description: "Administrasi dan konfigurasi sistem",
  },
  {
    name: "Asset Admin",
    code: "ASSET_ADMIN",
    description: "Pengelolaan data dan pergerakan aset",
  },
  {
    name: "Manager",
    code: "MANAGER",
    description: "Pemantauan laporan dan operasional",
  },
  {
    name: "Technician",
    code: "TECHNICIAN",
    description: "Penanganan pekerjaan pemeliharaan",
  },
  {
    name: "Staff",
    code: "STAFF",
    description: "Aktivitas operasional sesuai izin",
  },
];

function Brand() {
  return (
    <Link
      href="/"
      className={styles.brand}
      aria-label="AssetFlow EAM - Beranda"
    >
      <span className={styles.brandMark}>
        <FontAwesomeIcon icon={faLayerGroup} />
      </span>

      <span className={styles.brandText}>
        <strong>AssetFlow</strong>
        <span>EAM PLATFORM</span>
      </span>
    </Link>
  );
}

function Arrow() {
  return <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />;
}

export default function HomePage() {
  return (
    <div className={styles.page} id="beranda">
      <a href="#konten" className={styles.skipLink}>
        Langsung ke konten
      </a>

      <div className={styles.utilityBar}>
        <div className={styles.container}>
          <div className={styles.utilityInner}>
            <span>
              <FontAwesomeIcon icon={faShieldHalved} />
              Enterprise Asset Management Platform
            </span>

            <div className={styles.utilityRight}>
              <span>Sistem Informasi Perusahaan</span>

              <Link href="/login">
                Akses Pengguna
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <Brand />

            <nav className={styles.desktopNav} aria-label="Navigasi utama">
              <a href="#beranda">Beranda</a>
              <a href="#fitur">Fitur</a>
              <a href="#solusi">Solusi</a>
              <a href="#alur-kerja">Alur Kerja</a>
              <a href="#hak-akses">Hak Akses</a>
            </nav>

            <div className={styles.headerActions}>
              <Link href="/login" className={styles.signInLink}>
                Masuk
              </Link>

              <Link href="/dashboard" className={styles.headerButton}>
                Buka Sistem
                <Arrow />
              </Link>
            </div>

            <details className={styles.mobileMenu}>
              <summary aria-label="Buka menu navigasi">
                <FontAwesomeIcon icon={faBars} />
              </summary>

              <nav aria-label="Navigasi mobile">
                <a href="#beranda">Beranda</a>
                <a href="#fitur">Fitur</a>
                <a href="#solusi">Solusi</a>
                <a href="#alur-kerja">Alur Kerja</a>
                <a href="#hak-akses">Hak Akses</a>
                <Link href="/login">Masuk</Link>
                <Link href="/dashboard">Buka Sistem</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="konten">
        <section className={styles.hero}>
          <div
            className={styles.heroBackdrop}
            role="img"
            aria-label="Ilustrasi gudang industri dan pengelolaan inventaris"
          />

          <div className={styles.container}>
            <div className={styles.heroContent}>
              <div className={styles.eyebrow}>
                <span className={styles.liveDot} />
                ASSETFLOW EAM
                <span className={styles.eyebrowDivider} />
                ENTERPRISE PLATFORM
              </div>

              <h1>
                Kendalikan aset.
                <br />
                <span>Optimalkan operasional.</span>
              </h1>

              <p>
                Satu sistem informasi terintegrasi untuk mengelola aset
                perusahaan, penugasan, mutasi, pemeliharaan, dan pekerjaan
                operasional secara lebih terstruktur.
              </p>

              <div className={styles.heroActions}>
                <Link href="/login" className={styles.primaryButton}>
                  Masuk ke AssetFlow
                  <Arrow />
                </Link>

                <a href="#fitur" className={styles.outlineButton}>
                  Jelajahi Fitur
                  <FontAwesomeIcon icon={faChevronRight} />
                </a>
              </div>

              <div className={styles.heroNote}>
                <FontAwesomeIcon icon={faLock} />
                Akses sistem dikelola berdasarkan peran pengguna
              </div>
            </div>
          </div>

          <div className={styles.heroBottom}>
            <div className={styles.container}>
              <div className={styles.heroHighlights}>
                <span>
                  <FontAwesomeIcon icon={faDatabase} />
                  Centralized Asset Data
                </span>

                <span>
                  <FontAwesomeIcon icon={faUsers} />
                  Role-Based Access
                </span>

                <span>
                  <FontAwesomeIcon icon={faChartLine} />
                  Operational Monitoring
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.introSection}>
          <div className={styles.container}>
            <div className={styles.introGrid}>
              <div>
                <span className={styles.sectionEyebrow}>TENTANG PLATFORM</span>

                <h2 className={styles.introHeading}>
                  Sistem informasi untuk
                  <span> pengelolaan aset perusahaan.</span>
                </h2>
              </div>

              <div className={styles.introRight}>
                <p>
                  AssetFlow EAM membantu organisasi mengelola informasi aset dan
                  proses operasional dalam satu lingkungan kerja yang terpusat.
                </p>

                <a href="#solusi" className={styles.textLink}>
                  Pelajari solusi AssetFlow
                  <Arrow />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.featuresSection} id="fitur">
          <div className={styles.container}>
            <div className={styles.sectionTop}>
              <div>
                <span className={styles.sectionEyebrow}>
                  KAPABILITAS PLATFORM
                </span>

                <h2>
                  Semua kebutuhan operasional aset,
                  <br />
                  dalam satu sistem.
                </h2>

                <p>
                  Modul terintegrasi untuk membantu pencatatan, pelaksanaan, dan
                  pemantauan pengelolaan aset.
                </p>
              </div>

              <Link href="/login" className={styles.darkButton}>
                Akses Platform
                <Arrow />
              </Link>
            </div>

            <div className={styles.featuresGrid}>
              {features.map((feature) => (
                <article key={feature.number} className={styles.featureCard}>
                  <div className={styles.featureHeader}>
                    <div className={styles.featureIcon}>
                      <FontAwesomeIcon icon={feature.icon} />
                    </div>

                    <span className={styles.featureNumber}>
                      {feature.number}
                    </span>
                  </div>

                  <h3>{feature.title}</h3>

                  <p>{feature.description}</p>

                  <div className={styles.featureFooter}>
                    <span>Modul AssetFlow EAM</span>
                    <FontAwesomeIcon icon={faArrowRight} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.solutionSection} id="solusi">
          <div className={styles.container}>
            <div className={styles.solutionGrid}>
              <div className={styles.solutionPhoto}>
                <div
                  className={styles.solutionPhotoImage}
                  role="img"
                  aria-label="Ilustrasi teknisi sedang mengoperasikan peralatan industri"
                />

                <div className={styles.photoCaption}>
                  <span className={styles.photoCaptionIcon}>
                    <FontAwesomeIcon icon={faScrewdriverWrench} />
                  </span>

                  <div>
                    <strong>Operational Excellence</strong>
                    <span>Asset Lifecycle Management</span>
                  </div>
                </div>
              </div>

              <div className={styles.solutionContent}>
                <span className={styles.sectionEyebrow}>
                  SOLUSI TERINTEGRASI
                </span>

                <h2>
                  Dari inventaris hingga maintenance, semuanya saling terhubung.
                </h2>

                <p>
                  Informasi aset, perpindahan, penanggung jawab, hingga
                  aktivitas pemeliharaan dapat dikelola melalui modul yang
                  saling mendukung.
                </p>

                <div className={styles.solutionList}>
                  <div>
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Data aset dan inventaris terpusat</span>
                  </div>

                  <div>
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Pencatatan penugasan dan mutasi</span>
                  </div>

                  <div>
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Pengelolaan maintenance dan work orders</span>
                  </div>

                  <div>
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Laporan serta riwayat aktivitas sistem</span>
                  </div>
                </div>

                <Link href="/login" className={styles.darkButton}>
                  Masuk ke Workspace
                  <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.workflowSection} id="alur-kerja">
          <div className={styles.container}>
            <div className={styles.centerHeading}>
              <span className={styles.sectionEyebrow}>
                CARA KERJA ASSETFLOW
              </span>

              <h2>Satu alur kerja. Kendali lebih baik.</h2>

              <p>
                Pengelolaan aset dirancang dalam proses yang terstruktur, mulai
                dari pencatatan hingga pemantauan operasional.
              </p>
            </div>

            <div className={styles.workflowGrid}>
              {steps.map((step) => (
                <article key={step.number} className={styles.workflowCard}>
                  <span>{step.number}</span>
                  <div className={styles.workflowLine} />
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.rolesSection} id="hak-akses">
          <div className={styles.container}>
            <div className={styles.rolesHeader}>
              <div>
                <span className={styles.darkEyebrow}>
                  ROLE-BASED ACCESS CONTROL
                </span>

                <h2>Akses sesuai tanggung jawab.</h2>

                <p>
                  AssetFlow EAM menggunakan lima peran pengguna untuk mendukung
                  pembagian tugas dan pembatasan akses sistem.
                </p>
              </div>

              <div className={styles.rolesSymbol}>
                <FontAwesomeIcon icon={faShieldHalved} />
              </div>
            </div>

            <div className={styles.rolesGrid}>
              {roles.map((role) => (
                <div key={role.code} className={styles.roleCard}>
                  <span className={styles.roleIcon}>
                    <FontAwesomeIcon icon={faUsers} />
                  </span>

                  <h3>{role.name}</h3>
                  <code>{role.code}</code>
                  <p>{role.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={styles.container}>
            <div className={styles.ctaGrid}>
              <div>
                <span className={styles.sectionEyebrow}>
                  ASSETFLOW WORKSPACE
                </span>

                <h2>Siap mengelola aset dengan lebih terstruktur?</h2>

                <p>
                  Masuk menggunakan akun perusahaan yang sudah diberikan oleh
                  administrator sistem.
                </p>
              </div>

              <Link href="/login" className={styles.primaryButton}>
                Masuk ke Sistem
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerMain}>
            <div className={styles.footerBrand}>
              <Brand />

              <p>
                Platform sistem informasi manajemen aset untuk mendukung
                operasional perusahaan secara terintegrasi.
              </p>
            </div>

            <div className={styles.footerLinks}>
              <h3>Platform</h3>
              <a href="#fitur">Kapabilitas</a>
              <a href="#solusi">Solusi</a>
              <a href="#alur-kerja">Alur Kerja</a>
              <a href="#hak-akses">Hak Akses</a>
            </div>

            <div className={styles.footerLinks}>
              <h3>Workspace</h3>
              <Link href="/login">Login</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>
              © {new Date().getFullYear()} AssetFlow EAM. All rights reserved.
            </span>

            <span>Enterprise Asset Management System</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
