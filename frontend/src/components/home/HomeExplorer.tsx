"use client";

import { useId, useState } from "react";
import Link from "next/link";
import styles from "./HomeExplorer.module.css";

type FlowKey = "inventory" | "transfer" | "maintenance";

type FlowStep = {
  label: string;
  description: string;
};

type Flow = {
  key: FlowKey;
  label: string;
  number: string;
  category: string;
  title: string;
  description: string;
  steps: FlowStep[];
  modules: string;
};

const flows: Flow[] = [
  {
    key: "inventory",
    label: "Inventaris",
    number: "01",
    category: "ASSET MANAGEMENT",
    title: "Setiap aset punya identitas dan lokasi yang jelas.",
    description:
      "Mulai dari pencatatan aset hingga pengelompokan berdasarkan kategori, departemen, dan lokasi. Informasi tersimpan dalam satu sistem yang bisa digunakan oleh unit terkait.",
    modules: "Aset • Kategori • Lokasi • Departemen",
    steps: [
      {
        label: "Daftarkan aset",
        description: "Catat identitas, kode, dan informasi aset.",
      },
      {
        label: "Tetapkan lokasi",
        description: "Hubungkan aset dengan lokasi dan departemen.",
      },
      {
        label: "Pantau status",
        description: "Tinjau kondisi dan informasi aset dari sistem.",
      },
    ],
  },
  {
    key: "transfer",
    label: "Mutasi Aset",
    number: "02",
    category: "ASSET MOVEMENT",
    title: "Perpindahan aset tercatat dari awal hingga akhir.",
    description:
      "Penugasan dan mutasi aset memiliki alur yang lebih terstruktur, sehingga perubahan lokasi atau penanggung jawab tidak hanya diketahui melalui komunikasi terpisah.",
    modules: "Penugasan • Mutasi • Riwayat",
    steps: [
      {
        label: "Pilih aset",
        description: "Tentukan aset yang akan ditugaskan atau dipindahkan.",
      },
      {
        label: "Catat perpindahan",
        description: "Isi tujuan dan informasi perpindahan aset.",
      },
      {
        label: "Tinjau riwayat",
        description: "Periksa catatan perubahan yang tersimpan.",
      },
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    number: "03",
    category: "MAINTENANCE OPERATIONS",
    title: "Pekerjaan pemeliharaan lebih mudah ditelusuri.",
    description:
      "Permintaan maintenance dan work order ditangani dalam alur yang saling terhubung. Tim dapat meninjau pekerjaan dan status penyelesaiannya melalui modul yang tersedia.",
    modules: "Maintenance • Work Orders • Vendor",
    steps: [
      {
        label: "Laporkan kebutuhan",
        description: "Buat permintaan pemeliharaan untuk aset.",
      },
      {
        label: "Tindak lanjuti",
        description: "Kelola pekerjaan melalui work order.",
      },
      {
        label: "Perbarui status",
        description: "Catat perkembangan dan penyelesaian pekerjaan.",
      },
    ],
  },
];

export default function HomeExplorer() {
  const [active, setActive] = useState<FlowKey>("inventory");

  const panelId = useId();

  const currentFlow = flows.find((flow) => flow.key === active) ?? flows[0];

  return (
    <section className={styles.section} id="jelajahi">
      <div className={styles.container}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>JELAJAHI CARA KERJA</span>

            <h2>
              Dirancang untuk proses kerja
              <span> yang nyata.</span>
            </h2>
          </div>

          <p>
            Pilih salah satu aktivitas untuk melihat bagaimana modul AssetFlow
            saling mendukung.
          </p>
        </div>

        <div className={styles.explorer}>
          <div
            className={styles.navigation}
            aria-label="Pilih alur operasional"
          >
            <div className={styles.navigationHeading}>ALUR OPERASIONAL</div>

            {flows.map((flow) => (
              <button
                type="button"
                key={flow.key}
                className={styles.tab}
                aria-pressed={active === flow.key}
                aria-controls={panelId}
                onClick={() => setActive(flow.key)}
              >
                <span className={styles.tabNumber}>{flow.number}</span>

                <span>{flow.label}</span>

                <span className={styles.tabArrow} aria-hidden="true">
                  ↗
                </span>
              </button>
            ))}

            <div className={styles.navigationFooter}>
              Tiga contoh proses yang tersedia dalam ekosistem AssetFlow EAM.
            </div>
          </div>

          <div
            className={styles.content}
            id={panelId}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={styles.contentInner} key={currentFlow.key}>
              <div className={styles.contentHeading}>
                <span className={styles.category}>{currentFlow.category}</span>

                <span className={styles.number}>/ {currentFlow.number}</span>
              </div>

              <h3>{currentFlow.title}</h3>

              <p className={styles.description}>{currentFlow.description}</p>

              <div className={styles.steps}>
                {currentFlow.steps.map((step, index) => (
                  <div className={styles.step} key={step.label}>
                    <span className={styles.stepNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div>
                      <strong>{step.label}</strong>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.contentFooter}>
                <div>
                  <span>MODUL TERKAIT</span>
                  <p>{currentFlow.modules}</p>
                </div>

                <Link href="/login" className={styles.action}>
                  Masuk ke Sistem
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
