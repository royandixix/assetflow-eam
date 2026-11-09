import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json(
        { message: "Asal permintaan tidak diizinkan" },
        { status: 403 },
      );
    }

    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { message: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const contentLength = Number(request.headers.get("content-length") || 0);

    if (contentLength > 4096) {
      return NextResponse.json(
        { message: "Ukuran permintaan terlalu besar" },
        { status: 413 },
      );
    }

    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { message: "Format permintaan tidak valid" },
        { status: 400 },
      );
    }

    const values = body as Record<string, unknown>;

    const currentPassword = values.current_password;
    const newPassword = values.new_password;
    const confirmPassword = values.confirm_password;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return NextResponse.json(
        { message: "Semua kolom password wajib diisi" },
        { status: 400 },
      );
    }

    if (
      currentPassword.length === 0 ||
      currentPassword.length > 512 ||
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      return NextResponse.json(
        {
          message: "Password baru minimal 12 dan maksimal 128 karakter",
        },
        { status: 400 },
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: "Konfirmasi password tidak cocok" },
        { status: 400 },
      );
    }

    if (newPassword === currentPassword) {
      return NextResponse.json(
        {
          message: "Password baru harus berbeda dari password saat ini",
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { message: "Sesi login tidak valid" },
        { status: 401 },
      );
    }

    const attributes = {
      password: newPassword,
      current_password: currentPassword,
    };

    const { error } = await supabase.auth.updateUser(attributes);

    if (error) {
      return NextResponse.json(
        {
          message:
            "Perubahan password ditolak. Periksa password saat ini atau persyaratan keamanan Supabase Auth.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { message: "Password akun berhasil diperbarui" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { message: "Gagal memproses perubahan password" },
      { status: 500 },
    );
  }
}
