import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  try {
    const { path = [] } = await context.params;

    if (path.length > 1) {
      return NextResponse.json(
        { message: "Endpoint lokasi tidak ditemukan" },
        { status: 404 },
      );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      },
    );

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
        { message: "Sesi login tidak tersedia" },
        { status: 401 },
      );
    }

    const apiBase =
      process.env.ASSETFLOW_API_URL?.trim() || "http://127.0.0.1:8083";

    const locationId = path[0];

    const endpointPath = locationId
      ? `/api/v1/locations/${encodeURIComponent(locationId)}`
      : "/api/v1/locations";

    const endpoint = new URL(endpointPath, apiBase);

    endpoint.search = new URL(request.url).search;

    const headers = new Headers();

    headers.set("Authorization", `Bearer ${session.access_token}`);

    headers.set("Accept", "application/json");

    const contentType = request.headers.get("content-type");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    const hasBody =
      request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH";

    const upstream = await fetch(endpoint, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });

    console.info(
      `[locations-proxy] ${request.method} ${endpoint.pathname} -> ${upstream.status}`,
    );

    const responseText = await upstream.text();

    const responseHeaders = new Headers();

    responseHeaders.set("Cache-Control", "no-store");

    const upstreamContentType = upstream.headers.get("content-type");

    if (upstreamContentType) {
      responseHeaders.set("Content-Type", upstreamContentType);
    }

    return new NextResponse(upstream.status === 204 ? null : responseText, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[locations-proxy] Request failed:", error);

    return NextResponse.json(
      {
        message: "Gagal menghubungi layanan lokasi aset",
      },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
