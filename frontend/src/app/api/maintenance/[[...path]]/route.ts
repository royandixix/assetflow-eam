import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path?: string[] }>;
};

const uuid =
  /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

async function proxy(request: NextRequest, context: Context) {
  try {
    const { path = [] } = await context.params;
    const method = request.method;

    const validGet =
      method === "GET" &&
      (path.length === 0 ||
        (path.length === 1 && path[0] === "options"));

    const validPost =
      method === "POST" &&
      (path.length === 0 ||
        (path.length === 2 &&
          uuid.test(path[0]) &&
          path[1] === "review"));

    if (!validGet && !validPost) {
      return NextResponse.json(
        { message: "Endpoint Maintenance tidak ditemukan" },
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
        { message: "Konfigurasi backend belum tersedia" },
        { status: 500 },
      );
    }

    const url = new URL(
      "/api/v1/maintenance-requests" +
        (path.length ? "/" + path.join("/") : ""),
      base,
    );

    url.search = request.nextUrl.search;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
        ...(method === "POST"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      ...(method === "POST"
        ? { body: await request.text() }
        : {}),
      cache: "no-store",
    });

    const body = await response.text();

    if (
      !(response.headers.get("content-type") || "").includes(
        "application/json",
      )
    ) {
      return NextResponse.json(
        { message: "Backend tidak mengembalikan JSON" },
        { status: 502 },
      );
    }

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Maintenance]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend Maintenance" },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  return proxy(request, context);
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  return proxy(request, context);
}
