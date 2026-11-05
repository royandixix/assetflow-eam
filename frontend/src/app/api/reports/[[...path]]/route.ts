import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;

    const allowedPaths = ["summary", "work-orders.csv"];

    if (path.length !== 1 || !allowedPaths.includes(path[0])) {
      return NextResponse.json(
        {
          message: "Endpoint laporan tidak ditemukan",
        },
        { status: 404 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          message: "Silakan login terlebih dahulu",
        },
        { status: 401 },
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        {
          message: "Sesi login tidak tersedia",
        },
        { status: 401 },
      );
    }

    const baseURL = process.env.ASSETFLOW_API_URL;

    if (!baseURL) {
      return NextResponse.json(
        {
          message: "Konfigurasi backend belum tersedia",
        },
        { status: 500 },
      );
    }

    const target = new URL(`/api/v1/reports/${path[0]}`, baseURL);

    const response = await fetch(target, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: path[0] === "summary" ? "application/json" : "text/csv",
      },
      cache: "no-store",
    });

    if (path[0] === "work-orders.csv" && response.ok) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="assetflow-work-orders.csv"',
          "Cache-Control": "no-store",
        },
      });
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          message: `Backend mengembalikan HTTP ${response.status} tanpa JSON`,
        },
        {
          status: response.ok ? 502 : response.status,
        },
      );
    }

    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Reports API]", error);

    return NextResponse.json(
      {
        message: "Gagal menghubungi backend laporan",
      },
      { status: 502 },
    );
  }
}
