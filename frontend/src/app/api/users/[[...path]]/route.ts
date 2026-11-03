import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

async function forward(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const method = request.method;

  const valid =
    (method === "GET" && path.length === 0) ||
    (method === "POST" && path.length === 1 && path[0] === "invite") ||
    (method === "PUT" && path.length === 1 && uuid.test(path[0]));

  if (!valid) {
    return NextResponse.json(
      { message: "Endpoint pengguna tidak ditemukan" },
      { status: 404 },
    );
  }

  try {
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

    const baseURL = process.env.ASSETFLOW_API_URL;

    if (!baseURL) {
      return NextResponse.json(
        { message: "ASSETFLOW_API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const endpoint = new URL(
      `/api/v1/users${path.length ? `/${path.join("/")}` : ""}`,
      baseURL,
    );

    endpoint.search = request.nextUrl.search;

    const upstream = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "GET" ? { body: await request.text() } : {}),
      cache: "no-store",
      signal: request.signal,
    });

    const contentType = upstream.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          message: `Backend mengembalikan HTTP ${upstream.status} tanpa JSON`,
        },
        { status: 502 },
      );
    }

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[AssetFlow Users API]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend pengguna" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return forward(request, context);
}
