import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");

  const type = request.nextUrl.searchParams.get("type");

  const destination = new URL("/login", request.url);

  if (!tokenHash || type !== "invite") {
    destination.searchParams.set("message", "Tautan undangan tidak valid");

    return NextResponse.redirect(destination);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "invite",
  });

  if (error) {
    destination.searchParams.set(
      "message",
      "Undangan tidak berlaku atau sudah kedaluwarsa",
    );

    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL("/set-password", request.url));
}
