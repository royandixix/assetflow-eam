import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path?: string[] }>;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function forward(request: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const method = request.method;

    const validGet =
      method === "GET" &&
      (path.length === 0 || (path.length === 1 && uuid.test(path[0])));

    const validPost = method === "POST" && path.length === 0;

    const validPut =
      method === "PUT" && path.length === 1 && uuid.test(path[0]);

    if (!validGet && !validPost && !validPut) {
      return NextResponse.json(
        { message: "Endpoint Vendor tidak ditemukan" },
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

    const base = process.env.ASSETFLOW_API_URL;

    if (!base) {
      return NextResponse.json(
        { message: "ASSETFLOW_API_URL belum dikonfigurasi" },
        { status: 500 },
      );
    }

    const target = new URL(
      "/api/v1/vendors" +
        (path.length ? "/" + path.map(encodeURIComponent).join("/") : ""),
      base,
    );

    if (method === "GET") {
      target.search = request.nextUrl.search;
    }

    const response = await fetch(target.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method !== "GET" ? { body: await request.text() } : {}),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          message: `Backend mengembalikan HTTP ${response.status} tanpa JSON`,
        },
        { status: response.ok ? 502 : response.status },
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
    console.error("[Vendor API]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend Vendor" },
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

export async function PUT(request: NextRequest, context: Context) {
  return forward(request, context);
}
