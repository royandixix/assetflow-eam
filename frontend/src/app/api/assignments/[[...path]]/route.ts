import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path?: string[] }>;
};

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function forward(
  request: NextRequest,
  context: Context,
) {
  try {
    const { path = [] } = await context.params;
    const method = request.method;

    const validGet =
      method === "GET" &&
      (
        path.length === 0 ||
        (path.length === 1 &&
          (path[0] === "options" || uuid.test(path[0])))
      );

    const validPost =
      method === "POST" &&
      (
        path.length === 0 ||
        (
          path.length === 2 &&
          uuid.test(path[0]) &&
          path[1] === "return"
        )
      );

    if (!validGet && !validPost) {
      return NextResponse.json(
        { message: "Endpoint penugasan tidak ditemukan" },
        { status: 404 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
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
      "/api/v1/asset-assignments" +
        (path.length
          ? "/" + path.map(encodeURIComponent).join("/")
          : ""),
      baseURL,
    );

    endpoint.search = request.nextUrl.search;

    const response = await fetch(endpoint.toString(), {
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

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          message:
            `Backend mengembalikan respons HTTP ${response.status} yang bukan JSON`,
        },
        {
          status: response.ok ? 502 : response.status,
        },
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
    console.error("[Asset Assignments API]", error);

    return NextResponse.json(
      { message: "Gagal menghubungi backend penugasan aset" },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  return forward(request, context);
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  return forward(request, context);
}
