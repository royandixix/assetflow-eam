"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

type Period = 7 | 30 | 90;

type Metric = {
  key: string;
  label: string;
  path: string;
  value: number | null;
  available: boolean;
};

type DailyActivity = {
  date: string;
  count: number;
};

type RecentActivity = {
  id: number;
  actor_name: string;
  action: string;
  resource: string;
  resource_id: string;
  created_at: string;
};

type DashboardData = {
  period_days: number;
  timezone: string;
  metrics: Metric[];
  series: DailyActivity[];
  recent: RecentActivity[];
  audit_enabled: boolean;
  last_updated_at: string;
};

type Props = {
  roleCode: string;
};

const numberFormatter = new Intl.NumberFormat("id-ID");

const resourceLabels: Record<string, string> = {
  assets: "Aset",
  "asset-categories": "Kategori Aset",
  "asset-assignments": "Penugasan Aset",
  "asset-transfers": "Mutasi Aset",
  "maintenance-requests": "Maintenance",
  "work-orders": "Work Orders",
  vendors: "Vendor",
  locations: "Lokasi",
  departments: "Departemen",
};

const actionLabels: Record<string, string> = {
  CREATE: "Tambah",
  UPDATE: "Ubah",
  DELETE: "Hapus",
  INVITE: "Undang",
  START: "Mulai",
  COMPLETE: "Selesai",
  CLOSE: "Tutup",
  APPROVE: "Setujui",
  REJECT: "Tolak",
  CANCEL: "Batalkan",
  RETURN: "Kembalikan",
  REVIEW: "Tinjau",
  IMAGE_CHANGE: "Ubah Gambar",
};

function readableDate(value: string, timezone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return "-";
  }
}

function metricLinkAllowed(key: string, roleCode: string) {
  if (key === "maintenance" || key === "work_orders") {
    return true;
  }

  return roleCode === "SUPER_ADMIN" || roleCode === "ASSET_ADMIN";
}

async function fetchDashboard(
  period: Period,
  signal: AbortSignal,
): Promise<DashboardData> {
  const response = await fetch(`/api/dashboard?days=${period}`, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const result: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      result &&
      typeof result === "object" &&
      "message" in result &&
      typeof result.message === "string"
        ? result.message
        : `Gagal memuat Dashboard (HTTP ${response.status})`;

    throw new Error(message);
  }

  return result as DashboardData;
}

function ActivityChart({ series }: { series: DailyActivity[] }) {
  if (series.length === 0) {
    return (
      <div className="py-5 text-center text-body-secondary">
        Riwayat aktivitas belum tersedia.
      </div>
    );
  }

  const maximum = Math.max(1, ...series.map((item) => item.count));

  const chartWidth = 900;
  const chartHeight = 180;
  const chartLeft = 38;
  const chartRight = 15;
  const chartTop = 20;

  const usableWidth = chartWidth - chartLeft - chartRight;

  const step = usableWidth / series.length;
  const barWidth = Math.max(2, Math.min(25, step * 0.65));

  const labelInterval = Math.max(1, Math.ceil(series.length / 7));

  const total = series.reduce((sum, item) => sum + item.count, 0);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-body-secondary small">
          Jumlah aktivitas operasional tercatat
        </span>

        <Badge bg="primary">{numberFormatter.format(total)} aktivitas</Badge>
      </div>

      <svg
        viewBox="0 0 900 245"
        width="100%"
        role="img"
        aria-label={`Grafik aktivitas harian, total ${total} aktivitas`}
        style={{
          display: "block",
          maxHeight: 310,
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = chartTop + chartHeight * (1 - fraction);

          return (
            <g key={fraction}>
              <line
                x1={chartLeft}
                x2={chartWidth - chartRight}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.12}
              />

              <text
                x={chartLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
                opacity={0.6}
              >
                {Math.round(maximum * fraction)}
              </text>
            </g>
          );
        })}

        {series.map((item, index) => {
          const x = chartLeft + index * step + (step - barWidth) / 2;

          const height = (item.count / maximum) * chartHeight;

          const y = chartTop + chartHeight - height;

          return (
            <g key={item.date}>
              {item.count > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, height)}
                  rx={2}
                  fill="#0d6efd"
                >
                  <title>
                    {item.date}: {item.count} aktivitas
                  </title>
                </rect>
              )}

              {(index % labelInterval === 0 || index === series.length - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={chartTop + chartHeight + 22}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                  opacity={0.7}
                >
                  {item.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="text-body-secondary small mb-0 mt-2">
        Sumber: Audit Trail AssetFlow EAM. Grafik hanya mencakup aktivitas yang
        dicatat sejak Audit Trail diaktifkan.
      </p>
    </div>
  );
}

export default function AssetFlowDashboard({ roleCode }: Props) {
  const [period, setPeriod] = useState<Period>(30);

  const [revision, setRevision] = useState(0);

  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void fetchDashboard(period, controller.signal)
      .then((result) => {
        if (!active) return;

        setData(result);
        setError("");
      })
      .catch((err: unknown) => {
        if (!active) return;

        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err.message : "Gagal memuat Dashboard");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, revision]);

  function changePeriod(value: Period) {
    if (value === period) return;

    setLoading(true);
    setPeriod(value);
  }

  function reload() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function exportCSV() {
    if (!data || !data.audit_enabled) return;

    const rows = [
      ["Tanggal", "Jumlah Aktivitas"],
      ...data.series.map((item) => [item.date, String(item.count)]),
    ];

    const content = rows.map((row) => row.join(",")).join("\r\n");

    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `assetflow-aktivitas-${period}-hari.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  const recent = data?.recent ?? [];
  const metrics = data?.metrics ?? [];
  const series = data?.series ?? [];

  const unavailableMetrics = metrics.filter((item) => !item.available);

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1">Dashboard AssetFlow EAM</h3>

          <p className="text-body-secondary mb-0">
            Monitoring aset dan aktivitas operasional berdasarkan data
            PostgreSQL.
          </p>
        </div>

        <Button variant="outline-primary" disabled={loading} onClick={reload}>
          {loading ? "Memuat..." : "Muat Ulang"}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading && !data ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />

          <p className="text-body-secondary mt-3">
            Mengambil data Dashboard...
          </p>
        </div>
      ) : (
        <>
          <Row className="g-3 mb-4">
            {metrics.map((metric) => {
              const available = metric.available;
              const canOpen = metricLinkAllowed(metric.key, roleCode);

              return (
                <Col xs={12} sm={6} xl={4} key={metric.key}>
                  <Card className="h-100 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div className="text-body-secondary small mb-2">
                            {metric.label}
                          </div>

                          <h2 className="fw-bold mb-2">
                            {available && metric.value !== null
                              ? numberFormatter.format(metric.value)
                              : "—"}
                          </h2>
                        </div>

                        <Badge bg={available ? "success" : "secondary"}>
                          {available ? "Data asli" : "Belum tersedia"}
                        </Badge>
                      </div>

                      {canOpen ? (
                        <Link
                          href={metric.path}
                          className="text-decoration-none small fw-semibold"
                        >
                          Buka Modul
                        </Link>
                      ) : (
                        <span className="text-body-secondary small">
                          Akses sesuai role
                        </span>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>

          {unavailableMetrics.length > 0 && (
            <Alert variant="warning" className="mb-4">
              Sebagian statistik belum tersedia karena nama tabel belum cocok
              atau tabel belum ditemukan. Tidak ada angka pengganti yang dibuat.
            </Alert>
          )}

          <Card className="shadow-sm mb-4">
            <Card.Header className="bg-body py-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <h5 className="fw-semibold mb-1">
                    Grafik Aktivitas Operasional
                  </h5>

                  <div className="text-body-secondary small">
                    Perubahan yang tercatat pada modul operasional.
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  {([7, 30, 90] as const).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={
                        period === value ? "primary" : "outline-secondary"
                      }
                      disabled={loading}
                      onClick={() => changePeriod(value)}
                    >
                      {value} Hari
                    </Button>
                  ))}

                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={!data?.audit_enabled || loading}
                    onClick={exportCSV}
                  >
                    Ekspor CSV
                  </Button>
                </div>
              </div>
            </Card.Header>

            <Card.Body className="p-4">
              {loading && (
                <div className="d-flex align-items-center gap-2 mb-3 text-body-secondary small">
                  <Spinner animation="border" size="sm" />
                  Memperbarui grafik...
                </div>
              )}

              {data?.audit_enabled ? (
                <ActivityChart series={series} />
              ) : (
                <Alert variant="secondary" className="mb-0">
                  Audit Trail belum tersedia sebagai sumber grafik aktivitas.
                </Alert>
              )}
            </Card.Body>
          </Card>

          {roleCode === "SUPER_ADMIN" && (
            <Card className="shadow-sm mb-4">
              <Card.Header className="bg-body py-3 d-flex justify-content-between align-items-center">
                <h5 className="fw-semibold mb-0">Aktivitas Terbaru</h5>

                <Link
                  href="/dashboard/audit-trail"
                  className="text-decoration-none small"
                >
                  Lihat Audit Trail
                </Link>
              </Card.Header>

              <Card.Body className="p-0">
                {recent.length === 0 ? (
                  <p className="text-body-secondary p-4 mb-0">
                    Belum ada aktivitas operasional yang tercatat.
                  </p>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th className="px-3">Waktu</th>
                          <th>Pengguna</th>
                          <th>Tindakan</th>
                          <th>Modul</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recent.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 small">
                              {readableDate(
                                item.created_at,
                                data?.timezone || "Asia/Makassar",
                              )}
                            </td>

                            <td>{item.actor_name || "-"}</td>

                            <td>
                              <Badge bg="info">
                                {actionLabels[item.action] || item.action}
                              </Badge>
                            </td>

                            <td>
                              {resourceLabels[item.resource] || item.resource}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          )}

          <div className="text-body-secondary small">
            {data
              ? `Terakhir dimuat: ${readableDate(
                  data.last_updated_at,
                  data.timezone,
                )}`
              : "Data belum berhasil dimuat"}
          </div>
        </>
      )}
    </div>
  );
}
