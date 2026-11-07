import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  const { path = [] } = await context.params;

  if (path.length > 0) {
    return NextResponse.json(
      { message: "Endpoint Audit Trail tidak ditemukan" },
      { status: 404 },
    );
  }

  const baseURL = process.env.ASSETFLOW_API_URL?.trim();

  if (!baseURL) {
    return NextResponse.json(
      { message: "ASSETFLOW_API_URL belum dikonfigurasi" },
      { status: 500 },
    );
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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
        { message: "Sesi pengguna tidak tersedia" },
        { status: 401 },
      );
    }

    const endpoint = new URL(
      "/api/v1/audit-trail",
      baseURL,
    );

    endpoint.search = request.nextUrl.search;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: request.signal,
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { message: "Respons backend bukan JSON" },
        { status: 502 },
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
    console.error("[AssetFlow Audit Trail]", error);

    return NextResponse.json(
      { message: "Backend Audit Trail tidak dapat dihubungi" },
      { status: 502 },
    );
  }
}
