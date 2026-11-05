"use client";

import { useEffect, useState } from "react";
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

type Summary = {
  assets_total: number;
  assets_available: number;
  assets_assigned: number;
  assets_maintenance: number;
  maintenance_total: number;
  maintenance_pending: number;
  maintenance_active: number;
  work_orders_total: number;
  work_orders_assigned: number;
  work_orders_in_progress: number;
  work_orders_completed: number;
  work_orders_closed: number;
  vendors_total: number;
  vendors_active: number;
};

type WorkOrder = {
  number: string;
  asset_code: string;
  asset_name: string;
  title: string;
  status: string;
  technician_name: string;
  created_at: string;
};

type ReportsResponse = {
  summary: Summary;
  work_orders: WorkOrder[];
  generated_at: string;
};

const statusLabels: Record<string, string> = {
  ASSIGNED: "Ditugaskan",
  IN_PROGRESS: "Dikerjakan",
  COMPLETED: "Menunggu Verifikasi",
  CLOSED: "Ditutup",
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Gagal memuat laporan";
}

export default function ReportsManager() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/reports/summary", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.message ||
              `Gagal mengambil laporan (HTTP ${response.status})`,
          );
        }

        return result as ReportsResponse;
      })
      .then((result) => {
        if (controller.signal.aborted) return;

        setData(result);
        setError("");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        setData(null);
        setError(getMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshKey]);

  function reload() {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  }

  const summary = data?.summary;

  const statistics = summary
    ? [
        {
          label: "Total Aset",
          value: summary.assets_total,
          detail: `${summary.assets_available} aset tersedia`,
        },
        {
          label: "Aset Ditugaskan",
          value: summary.assets_assigned,
          detail: "Aset yang sedang digunakan",
        },
        {
          label: "Aset Maintenance",
          value: summary.assets_maintenance,
          detail: "Dalam pemeliharaan",
        },
        {
          label: "Laporan Maintenance",
          value: summary.maintenance_total,
          detail: `${summary.maintenance_pending} menunggu pemeriksaan`,
        },
        {
          label: "Total Work Orders",
          value: summary.work_orders_total,
          detail: `${summary.work_orders_in_progress} sedang dikerjakan`,
        },
        {
          label: "Total Vendor",
          value: summary.vendors_total,
          detail: `${summary.vendors_active} vendor aktif`,
        },
      ]
    : [];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Laporan Management</h1>

          <p className="text-body-secondary mb-0">
            Laporan aset, pemeliharaan, pekerjaan teknisi, dan vendor
            berdasarkan data AssetFlow EAM.
          </p>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            disabled={loading}
            onClick={reload}
          >
            Muat Ulang
          </Button>

          <Button
            as="a"
            href="/api/reports/work-orders.csv"
            variant="primary"
            disabled={loading || !data}
          >
            Ekspor Work Orders CSV
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-3 text-body-secondary">Memuat laporan...</p>
        </div>
      ) : !data || !summary ? (
        <Alert variant="warning">Data laporan belum berhasil dimuat.</Alert>
      ) : (
        <>
          <Row className="g-3 mb-4">
            {statistics.map((item) => (
              <Col xs={12} sm={6} lg={4} key={item.label}>
                <Card className="h-100 shadow-sm">
                  <Card.Body>
                    <div className="small text-body-secondary mb-2">
                      {item.label}
                    </div>

                    <div className="display-6 fw-bold">
                      {item.value.toLocaleString("id-ID")}
                    </div>

                    <div className="small text-body-secondary">
                      {item.detail}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          <Row className="g-3 mb-4">
            <Col xs={12} lg={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header>
                  <strong>Status Work Orders</strong>
                </Card.Header>

                <Card.Body>
                  <Table className="mb-0">
                    <tbody>
                      <tr>
                        <td>Ditugaskan</td>
                        <td className="text-end">
                          {summary.work_orders_assigned}
                        </td>
                      </tr>

                      <tr>
                        <td>Dikerjakan</td>
                        <td className="text-end">
                          {summary.work_orders_in_progress}
                        </td>
                      </tr>

                      <tr>
                        <td>Menunggu Verifikasi</td>
                        <td className="text-end">
                          {summary.work_orders_completed}
                        </td>
                      </tr>

                      <tr>
                        <td>Ditutup</td>
                        <td className="text-end">
                          {summary.work_orders_closed}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} lg={6}>
              <Card className="h-100 shadow-sm">
                <Card.Header>
                  <strong>Ringkasan Maintenance</strong>
                </Card.Header>

                <Card.Body>
                  <Table className="mb-0">
                    <tbody>
                      <tr>
                        <td>Total Laporan</td>
                        <td className="text-end">
                          {summary.maintenance_total}
                        </td>
                      </tr>

                      <tr>
                        <td>Menunggu Pemeriksaan</td>
                        <td className="text-end">
                          {summary.maintenance_pending}
                        </td>
                      </tr>

                      <tr>
                        <td>Disetujui / Dalam Proses</td>
                        <td className="text-end">
                          {summary.maintenance_active}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="shadow-sm">
            <Card.Header>
              <strong>15 Work Orders Terbaru</strong>
            </Card.Header>

            <Card.Body>
              {data.work_orders.length === 0 ? (
                <p className="text-body-secondary text-center py-4">
                  Belum ada Work Order.
                </p>
              ) : (
                <Table responsive hover className="align-middle">
                  <thead>
                    <tr>
                      <th>Nomor WO</th>
                      <th>Aset</th>
                      <th>Judul</th>
                      <th>Teknisi</th>
                      <th>Status</th>
                      <th>Dibuat</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.work_orders.map((item) => (
                      <tr key={item.number}>
                        <td className="fw-semibold">{item.number}</td>

                        <td>
                          <div>{item.asset_code}</div>
                          <small className="text-body-secondary">
                            {item.asset_name}
                          </small>
                        </td>

                        <td>{item.title}</td>

                        <td>{item.technician_name || "-"}</td>

                        <td>
                          <Badge
                            bg={
                              item.status === "CLOSED"
                                ? "success"
                                : item.status === "COMPLETED"
                                  ? "warning"
                                  : "info"
                            }
                          >
                            {statusLabels[item.status] || item.status}
                          </Badge>
                        </td>

                        <td className="text-nowrap">
                          {formatDate(item.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          <p className="small text-body-secondary mt-3">
            Terakhir diperbarui: {formatDate(data.generated_at)}
          </p>
        </>
      )}
    </div>
  );
}
