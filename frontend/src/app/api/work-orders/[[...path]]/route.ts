import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path?: string[] }>;
};

const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

async function forward(request: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const method = request.method;

    const validGet =
      method === "GET" &&
      (path.length === 0 || (path.length === 1 && path[0] === "options"));

    const validPost =
      method === "POST" &&
      (path.length === 0 ||
        (path.length === 2 &&
          uuid.test(path[0]) &&
          ["start", "complete", "close"].includes(path[1])));

    if (!validGet && !validPost) {
      return NextResponse.json(
        { message: "Endpoint Work Orders tidak ditemukan" },
        { status: 404 },
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

    const baseURL = process.env.ASSETFLOW_API_URL;

    if (!baseURL) {
      return NextResponse.json(
        { message: "ASSETFLOW_API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const endpoint = new URL(
      "/api/v1/work-orders" +
        (path.length ? "/" + path.map(encodeURIComponent).join("/") : ""),
      baseURL,
    );

    endpoint.search = request.nextUrl.search;

    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: await request.text() } : {}),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          message: `Backend mengembalikan HTTP ${response.status} tanpa JSON`,
        },
        { status: 502 },
      );
    }

    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Work Orders API]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend Work Orders" },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: Context) {
  return forward(request, context);
}

export async function POST(request: NextRequest, context: Context) {
  return forward(request, context);
}
