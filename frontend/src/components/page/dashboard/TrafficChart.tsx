"use client";

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

export type DashboardSummary = {
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

export type ChartMode = "assets" | "maintenance" | "work_orders";

type Props = {
  summary: DashboardSummary;
  mode: ChartMode;
};

export function getChartValues(summary: DashboardSummary, mode: ChartMode) {
  if (mode === "assets") {
    const remaining = Math.max(
      0,
      summary.assets_total -
        summary.assets_available -
        summary.assets_assigned -
        summary.assets_maintenance,
    );

    return {
      title: "Distribusi Status Aset",
      labels: ["Tersedia", "Ditugaskan", "Maintenance", "Lainnya"],
      values: [
        summary.assets_available,
        summary.assets_assigned,
        summary.assets_maintenance,
        remaining,
      ],
    };
  }

  if (mode === "maintenance") {
    const remaining = Math.max(
      0,
      summary.maintenance_total -
        summary.maintenance_pending -
        summary.maintenance_active,
    );

    return {
      title: "Distribusi Permintaan Maintenance",
      labels: ["Menunggu", "Aktif", "Lainnya"],
      values: [
        summary.maintenance_pending,
        summary.maintenance_active,
        remaining,
      ],
    };
  }

  const remaining = Math.max(
    0,
    summary.work_orders_total -
      summary.work_orders_assigned -
      summary.work_orders_in_progress -
      summary.work_orders_completed -
      summary.work_orders_closed,
  );

  return {
    title: "Distribusi Work Orders",
    labels: ["Ditugaskan", "Dikerjakan", "Selesai", "Ditutup", "Lainnya"],
    values: [
      summary.work_orders_assigned,
      summary.work_orders_in_progress,
      summary.work_orders_completed,
      summary.work_orders_closed,
      remaining,
    ],
  };
}

export default function TrafficChart({ summary, mode }: Props) {
  const chart = getChartValues(summary, mode);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
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
        grid: {
          display: false,
        },
        ticks: {
          color: "#64748b",
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#64748b",
          precision: 0,
        },
        grid: {
          color: "rgba(100,116,139,0.16)",
        },
      },
    },
    elements: {
      line: {
        tension: 0.35,
      },
      point: {
        radius: 4,
        hoverRadius: 7,
      },
    },
  };

  return (
    <Line
      data={{
        labels: chart.labels,
        datasets: [
          {
            label: chart.title,
            data: chart.values,
            borderColor: "#0dcaf0",
            backgroundColor: "rgba(13,202,240,0.18)",
            pointBackgroundColor: "#0dcaf0",
            borderWidth: 2,
            fill: true,
          },
        ],
      }}
      options={options}
    />
  );
}
