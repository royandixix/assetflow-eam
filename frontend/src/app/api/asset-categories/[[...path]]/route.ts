import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ path?: string[] }>;
};

const uuid =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function forward(request: Request, context: Context) {
  const { path = [] } = await context.params;

  const list = path.length === 0;
  const item = path.length === 1 && uuid.test(path[0]);
  const image = path.length === 2 &&
    uuid.test(path[0]) &&
    path[1] === "image";

  if (!list && !item && !image) {
    return NextResponse.json(
      { message: "Endpoint tidak ditemukan" },
      { status: 404 }
    );
  }

  const allowed =
    (request.method === "GET") ||
    (request.method === "POST" && (list || image)) ||
    (request.method === "PUT" && item) ||
    (request.method === "DELETE" && (item || image));

  if (!allowed) {
    return NextResponse.json(
      { message: "Metode tidak diizinkan" },
      { status: 405 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { message: "Konfigurasi Supabase tidak lengkap" },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(items) {
        for (const item of items) {
          cookieStore.set(item.name, item.value, item.options);
        }
      }
    }
  });

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { message: "Silakan login terlebih dahulu" },
      { status: 401 }
    );
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json(
      { message: "Sesi tidak tersedia" },
      { status: 401 }
    );
  }

  const endpoint = new URL(
    `/api/v1/asset-categories${path.length ? "/" + path.join("/") : ""}`,
    process.env.ASSETFLOW_API_URL || "http://127.0.0.1:8083"
  );

  if (list) {
    endpoint.search = new URL(request.url).search;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
    Accept: "application/json"
  };

  let body: BodyInit | undefined;

  if (request.method === "POST" || request.method === "PUT") {
    const contentType = request.headers.get("content-type") || "";

    if (image) {
      const maxRequestSize = 11 * 1024 * 1024;
      const bytes = await request.arrayBuffer();

      if (bytes.byteLength > maxRequestSize) {
        return NextResponse.json(
          { message: "Gambar maksimal 10 MB" },
          { status: 413 }
        );
      }

      if (!contentType.startsWith("multipart/form-data;")) {
        return NextResponse.json(
          { message: "Format upload tidak valid" },
          { status: 400 }
        );
      }

      headers["Content-Type"] = contentType;
      body = bytes;
    } else {
      headers["Content-Type"] = "application/json";
      body = await request.text();
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") || "application/json",
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json(
      { message: "Backend AssetFlow tidak dapat dihubungi" },
      { status: 502 }
    );
  }
}

export async function GET(request: Request, context: Context) {
  return forward(request, context);
}

export async function POST(request: Request, context: Context) {
  return forward(request, context);
}

export async function PUT(request: Request, context: Context) {
  return forward(request, context);
}

export async function DELETE(request: Request, context: Context) {
  return forward(request, context);
}
