"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Line } from "react-chartjs-2";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  type ChartOptions,
} from "chart.js";

import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  ProgressBar,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

import TrafficChart, {
  getChartValues,
  type ChartMode,
  type DashboardSummary,
} from "./TrafficChart";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

type WorkOrder = {
  Number: string;
  AssetCode: string;
  AssetName: string;
  Title: string;
  Status: string;
  TechnicianName: string;
  CreatedAt: string;
};

type ReportResponse = {
  summary: DashboardSummary;
  work_orders: WorkOrder[];
  generated_at: string;
};

type LoadState = {
  data: ReportResponse | null;
  loading: boolean;
  error: string;
};

type Props = {
  roleCode: string;
};

type MiniChartProps = {
  values: number[];
};

type ProgressItemProps = {
  label: string;
  count: number;
  total: number;
  variant: string;
};

const formatNumber = new Intl.NumberFormat("id-ID");

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      return value;
    }
  }

  return "";
}

function normalizeWorkOrder(value: unknown): WorkOrder {
  const row = isRecord(value) ? value : {};

  return {
    Number: readString(row, "Number", "number"),

    AssetCode: readString(row, "AssetCode", "asset_code", "assetCode"),

    AssetName: readString(row, "AssetName", "asset_name", "assetName"),

    Title: readString(row, "Title", "title"),

    Status: readString(row, "Status", "status").trim().toUpperCase(),

    TechnicianName: readString(
      row,
      "TechnicianName",
      "technician_name",
      "technicianName",
    ),

    CreatedAt: readString(row, "CreatedAt", "created_at", "createdAt"),
  };
}

function normalizeSummary(value: unknown): DashboardSummary {
  if (!isRecord(value)) {
    throw new Error("Data ringkasan laporan tidak valid");
  }

  const keys: (keyof DashboardSummary)[] = [
    "assets_total",
    "assets_available",
    "assets_assigned",
    "assets_maintenance",
    "maintenance_total",
    "maintenance_pending",
    "maintenance_active",
    "work_orders_total",
    "work_orders_assigned",
    "work_orders_in_progress",
    "work_orders_completed",
    "work_orders_closed",
    "vendors_total",
    "vendors_active",
  ];

  const result = {} as DashboardSummary;

  for (const key of keys) {
    const raw = value[key];

    if ((typeof raw !== "number" && typeof raw !== "string") || raw === "") {
      throw new Error(`Data statistik ${key} tidak tersedia`);
    }

    const number = Number(raw);

    if (!Number.isFinite(number) || number < 0) {
      throw new Error(`Nilai statistik ${key} tidak valid`);
    }

    result[key] = number;
  }

  return result;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;

  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function statusLabel(status: unknown): string {
  if (typeof status !== "string" || !status.trim()) {
    return "Status tidak tersedia";
  }

  const labels: Record<string, string> = {
    PENDING: "Menunggu",
    APPROVED: "Disetujui",
    ASSIGNED: "Ditugaskan",
    IN_PROGRESS: "Dikerjakan",
    COMPLETED: "Selesai",
    CLOSED: "Ditutup",
    CANCELLED: "Dibatalkan",
    REJECTED: "Ditolak",
    OPEN: "Terbuka",
    DRAFT: "Draft",
  };

  const normalized = status.trim().toUpperCase();

  return labels[normalized] ?? normalized.replaceAll("_", " ");
}

function statusVariant(status: unknown): string {
  if (typeof status !== "string") {
    return "secondary";
  }

  switch (status.trim().toUpperCase()) {
    case "COMPLETED":
    case "CLOSED":
      return "success";

    case "IN_PROGRESS":
      return "info";

    case "PENDING":
      return "warning";

    case "CANCELLED":
    case "REJECTED":
      return "danger";

    case "ASSIGNED":
    case "APPROVED":
      return "primary";

    default:
      return "secondary";
  }
}

function displayDate(value: string): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readReport(signal: AbortSignal): Promise<ReportResponse> {
  const response = await fetch("/api/reports/summary", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = `Gagal memuat laporan (HTTP ${response.status})`;

    if (isRecord(body) && typeof body.message === "string") {
      message = body.message;
    }

    throw new Error(message);
  }

  if (!isRecord(body)) {
    throw new Error("Respons API Reports bukan JSON yang valid");
  }

  const summary = normalizeSummary(body.summary);

  if (!Array.isArray(body.work_orders)) {
    throw new Error("Format daftar Work Orders dari API tidak sesuai");
  }

  const workOrders = body.work_orders.map(normalizeWorkOrder);

  return {
    summary,
    work_orders: workOrders,
    generated_at:
      typeof body.generated_at === "string" ? body.generated_at : "",
  };
}

function MiniChart({ values }: MiniChartProps) {
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        enabled: true,
      },
    },

    scales: {
      x: {
        display: false,
      },

      y: {
        display: false,
        beginAtZero: true,
      },
    },

    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
      },

      point: {
        radius: 3,
        hoverRadius: 5,
      },
    },
  };

  return (
    <Line
      options={options}
      data={{
        labels: values.map((_, index) => String(index + 1)),

        datasets: [
          {
            label: "Distribusi status",
            data: values,
            borderColor: "rgba(255,255,255,0.85)",
            backgroundColor: "rgba(255,255,255,0.12)",
            pointBackgroundColor: "#ffffff",
            fill: true,
          },
        ],
      }}
    />
  );
}

function ProgressItem({ label, count, total, variant }: ProgressItemProps) {
  const value = percentage(count, total);

  return (
    <Col xs={12} sm={6} lg>
      <div className="text-center mb-2">
        <div className="text-body-secondary small">{label}</div>

        <div className="fw-semibold small">
          {formatNumber.format(count)} ({value}%)
        </div>
      </div>

      <ProgressBar className="progress-thin" variant={variant} now={value} />
    </Col>
  );
}

function exportSummaryCSV(summary: DashboardSummary) {
  const records: [string, number][] = [
    ["Total Aset", summary.assets_total],
    ["Aset Tersedia", summary.assets_available],
    ["Aset Ditugaskan", summary.assets_assigned],
    ["Aset Maintenance", summary.assets_maintenance],
    ["Total Maintenance", summary.maintenance_total],
    ["Maintenance Menunggu", summary.maintenance_pending],
    ["Maintenance Aktif", summary.maintenance_active],
    ["Total Work Orders", summary.work_orders_total],
    ["WO Ditugaskan", summary.work_orders_assigned],
    ["WO Dikerjakan", summary.work_orders_in_progress],
    ["WO Selesai", summary.work_orders_completed],
    ["WO Ditutup", summary.work_orders_closed],
    ["Total Vendor", summary.vendors_total],
    ["Vendor Aktif", summary.vendors_active],
  ];

  const csv = [
    "Indikator,Jumlah",
    ...records.map(([label, count]) => `"${label}",${count}`),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "assetflow-ringkasan-dashboard.csv";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export default function KitloongDashboard({ roleCode }: Props) {
  const [mode, setMode] = useState<ChartMode>("assets");

  const [refreshKey, setRefreshKey] = useState(0);

  const [state, setState] = useState<LoadState>({
    data: null,
    loading: true,
    error: "",
  });

  const canViewReport = ["SUPER_ADMIN", "ASSET_ADMIN", "MANAGER"].includes(
    roleCode,
  );

  const canOpenAssets = ["SUPER_ADMIN", "ASSET_ADMIN"].includes(roleCode);

  useEffect(() => {
    if (!canViewReport) return;

    const controller = new AbortController();

    void readReport(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          data,
          loading: false,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState((previous) => ({
          ...previous,
          loading: false,
          error:
            error instanceof Error ? error.message : "Gagal memuat Dashboard",
        }));
      });

    return () => {
      controller.abort();
    };
  }, [canViewReport, refreshKey]);

  function reloadDashboard() {
    setState((previous) => ({
      ...previous,
      loading: true,
      error: "",
    }));

    setRefreshKey((previous) => previous + 1);
  }

  if (!canViewReport) {
    return (
      <div className="py-3">
        <h3 className="fw-bold">Dashboard AssetFlow EAM</h3>

        <Alert variant="info" className="mt-3">
          Ringkasan laporan operasional tersedia sesuai hak akses pengguna.
        </Alert>

        <Link href="/dashboard/maintenance">Buka Maintenance</Link>
      </div>
    );
  }

  const data = state.data;
  const summary = data?.summary;

  if (!summary && state.loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />

        <p className="text-body-secondary mt-3">
          Memuat Dashboard AssetFlow EAM...
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <Alert variant="danger">
        {state.error || "Data Dashboard belum tersedia"}

        <div className="mt-3">
          <Button variant="outline-danger" onClick={reloadDashboard}>
            Coba Lagi
          </Button>
        </div>
      </Alert>
    );
  }

  const assetsChart = getChartValues(summary, "assets");

  const maintenanceChart = getChartValues(summary, "maintenance");

  const workOrdersChart = getChartValues(summary, "work_orders");

  const activeWorkOrders =
    summary.work_orders_assigned + summary.work_orders_in_progress;

  const cards = [
    {
      title: "Total Aset",
      value: summary.assets_total,
      detail: `${formatNumber.format(summary.assets_available)} tersedia`,
      bg: "bg-primary",
      href: "/dashboard/assets",
      canOpen: canOpenAssets,
      values: assetsChart.values,
    },
    {
      title: "Aset Tersedia",
      value: summary.assets_available,
      detail: `${percentage(
        summary.assets_available,
        summary.assets_total,
      )}% dari total aset`,
      bg: "bg-info",
      href: "/dashboard/assets",
      canOpen: canOpenAssets,
      values: [
        summary.assets_available,
        summary.assets_assigned,
        summary.assets_maintenance,
      ],
    },
    {
      title: "Permintaan Maintenance",
      value: summary.maintenance_total,
      detail: `${formatNumber.format(summary.maintenance_pending)} menunggu`,
      bg: "bg-warning",
      href: "/dashboard/maintenance",
      canOpen: true,
      values: maintenanceChart.values,
    },
    {
      title: "Work Orders",
      value: summary.work_orders_total,
      detail: `${formatNumber.format(activeWorkOrders)} sedang ditangani`,
      bg: "bg-danger",
      href: "/dashboard/work-orders",
      canOpen: true,
      values: workOrdersChart.values,
    },
  ];

  const chartTitles: Record<ChartMode, string> = {
    assets: "Grafik Status Aset",
    maintenance: "Grafik Status Maintenance",
    work_orders: "Grafik Status Work Orders",
  };

  const recentWorkOrders = data?.work_orders ?? [];

  return (
    <div className="py-1">
      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <Row className="g-3 mb-4">
        {cards.map((card) => {
          const content = (
            <Card className={["h-100 border-0 text-white", card.bg].join(" ")}>
              <Card.Body className="pb-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h3 className="fw-bold mb-1">
                      {formatNumber.format(card.value)}
                    </h3>

                    <div className="fw-semibold small">{card.title}</div>

                    <div className="small mt-1 text-white-50">
                      {card.detail}
                    </div>
                  </div>

                  <span className="fs-5" aria-hidden="true">
                    ⋮
                  </span>
                </div>
              </Card.Body>

              <div className="px-3 pb-3" style={{ height: 82 }}>
                <MiniChart values={card.values} />
              </div>
            </Card>
          );

          return (
            <Col key={card.title} xs={12} sm={6} xl={3}>
              {card.canOpen ? (
                <Link
                  href={card.href}
                  className="text-decoration-none d-block h-100"
                  aria-label={`Buka modul ${card.title}`}
                >
                  {content}
                </Link>
              ) : (
                content
              )}
            </Col>
          );
        })}
      </Row>

      <Card className="mb-4 shadow-sm">
        <Card.Body className="pb-0">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3">
            <div>
              <h4 className="fw-semibold mb-1">{chartTitles[mode]}</h4>

              <div className="text-body-secondary small">
                Data operasional aktual dari PostgreSQL
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div
                className="btn-group"
                role="group"
                aria-label="Filter grafik"
              >
                {(
                  [
                    ["assets", "Aset"],
                    ["maintenance", "Maintenance"],
                    ["work_orders", "Work Orders"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={mode === key ? "secondary" : "outline-secondary"}
                    onClick={() => setMode(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <Button
                size="sm"
                variant="primary"
                disabled={state.loading}
                onClick={reloadDashboard}
              >
                {state.loading ? "Memuat..." : "Muat Ulang"}
              </Button>

              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => exportSummaryCSV(summary)}
              >
                Unduh CSV
              </Button>
            </div>
          </div>

          <div style={{ height: 320 }}>
            <TrafficChart summary={summary} mode={mode} />
          </div>
        </Card.Body>

        <Card.Footer className="bg-body py-4">
          <Row className="g-4">
            <ProgressItem
              label="Aset Tersedia"
              count={summary.assets_available}
              total={summary.assets_total}
              variant="success"
            />

            <ProgressItem
              label="Aset Ditugaskan"
              count={summary.assets_assigned}
              total={summary.assets_total}
              variant="info"
            />

            <ProgressItem
              label="Maintenance Menunggu"
              count={summary.maintenance_pending}
              total={summary.maintenance_total}
              variant="warning"
            />

            <ProgressItem
              label="Work Orders Selesai"
              count={summary.work_orders_completed}
              total={summary.work_orders_total}
              variant="primary"
            />

            <ProgressItem
              label="Vendor Aktif"
              count={summary.vendors_active}
              total={summary.vendors_total}
              variant="danger"
            />
          </Row>
        </Card.Footer>
      </Card>

      <Row className="g-3 mb-4">
        <Col xs={12} md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center py-4">
              <div className="text-body-secondary small mb-2">Total Vendor</div>

              <h2 className="fw-bold">
                {formatNumber.format(summary.vendors_total)}
              </h2>

              {canOpenAssets && (
                <Link href="/dashboard/vendors">Manajemen Vendor</Link>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center py-4">
              <div className="text-body-secondary small mb-2">
                Aset dalam Maintenance
              </div>

              <h2 className="fw-bold">
                {formatNumber.format(summary.assets_maintenance)}
              </h2>

              {canOpenAssets && (
                <Link href="/dashboard/assets">Lihat Aset</Link>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={4}>
          <Card className="h-100 shadow-sm">
            <Card.Body className="text-center py-4">
              <div className="text-body-secondary small mb-2">
                Work Orders Ditutup
              </div>

              <h2 className="fw-bold">
                {formatNumber.format(summary.work_orders_closed)}
              </h2>

              <Link href="/dashboard/work-orders">Lihat Work Orders</Link>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Header className="bg-body py-3">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div>
              <h5 className="fw-semibold mb-1">Work Orders Terbaru</h5>

              <div className="text-body-secondary small">
                Data pekerjaan terbaru dalam sistem
              </div>
            </div>

            <Link
              href="/dashboard/work-orders"
              className="small text-decoration-none"
            >
              Lihat Semua
            </Link>
          </div>
        </Card.Header>

        <Card.Body className="p-0">
          {recentWorkOrders.length === 0 ? (
            <p className="p-4 mb-0 text-body-secondary">
              Belum ada data Work Orders.
            </p>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th className="px-3">Nomor</th>
                    <th>Aset</th>
                    <th>Pekerjaan</th>
                    <th>Status</th>
                    <th>Teknisi</th>
                    <th>Dibuat</th>
                  </tr>
                </thead>

                <tbody>
                  {recentWorkOrders.map((item, index) => (
                    <tr key={`${item.Number}-${index}`}>
                      <td className="px-3 fw-semibold">{item.Number || "-"}</td>

                      <td>
                        <div className="fw-semibold">
                          {item.AssetName || "-"}
                        </div>

                        <div className="text-body-secondary small">
                          {item.AssetCode || "-"}
                        </div>
                      </td>

                      <td>{item.Title || "-"}</td>

                      <td>
                        <Badge bg={statusVariant(item.Status)}>
                          {statusLabel(item.Status)}
                        </Badge>
                      </td>

                      <td>{item.TechnicianName || "Belum ditugaskan"}</td>

                      <td className="small">{displayDate(item.CreatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <div className="text-body-secondary small mt-3">
        Sumber: Reports API AssetFlow EAM.
        {data?.generated_at
          ? ` Diperbarui: ${displayDate(data.generated_at)}`
          : ""}
      </div>
    </div>
  );
}
