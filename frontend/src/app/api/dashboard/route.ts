import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const days = request.nextUrl.searchParams.get("days") || "30";

    if (!["7", "30", "90"].includes(days)) {
      return NextResponse.json(
        { message: "Periode tidak valid" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { message: "Silakan login terlebih dahulu" },
        { status: 401 },
      );
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return NextResponse.json(
        { message: "Sesi login tidak tersedia" },
        { status: 401 },
      );
    }

    const base = process.env.ASSETFLOW_API_URL;

    if (!base) {
      return NextResponse.json(
        { message: "ASSETFLOW_API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const target = new URL("/api/v1/dashboard/overview", base);

    target.searchParams.set("days", days);

    const response = await fetch(target.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

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
    console.error("[Dashboard API]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend Dashboard" },
      { status: 502 },
    );
  }
}
