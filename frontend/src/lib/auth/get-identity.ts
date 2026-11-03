import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserIdentity = {
  id: string;
  email: string;
  full_name: string;
  role_code: string;
  is_active: boolean;
};

type IdentityResponse = {
  status: string;
  user: UserIdentity;
};

export const requireIdentity = cache(async (): Promise<UserIdentity> => {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    redirect("/login");
  }

  const baseURL = process.env.ASSETFLOW_API_URL?.trim();

  if (!baseURL) {
    throw new Error("ASSETFLOW_API_URL belum dikonfigurasi pada frontend.");
  }

  let endpoint: URL;

  try {
    endpoint = new URL("/api/v1/auth/me", baseURL);
  } catch {
    throw new Error("Format ASSETFLOW_API_URL tidak valid.");
  }

  let response: Response;

  try {
    response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("[AssetFlow Identity] Koneksi backend gagal:", error);

    throw new Error(
      "Backend AssetFlow tidak dapat dihubungi. Periksa server Go dan konfigurasi API.",
    );
  }

  if (response.status === 401) {
    redirect("/login");
  }

  if (response.status === 403) {
    redirect("/unauthorized");
  }

  if (!response.ok) {
    console.error("[AssetFlow Identity] API gagal:", {
      status: response.status,
      statusText: response.statusText,
    });

    throw new Error(
      `Gagal menghubungi API identitas AssetFlow (HTTP ${response.status}).`,
    );
  }

  let result: IdentityResponse;

  try {
    result = (await response.json()) as IdentityResponse;
  } catch {
    throw new Error("Respons API identitas AssetFlow bukan JSON yang valid.");
  }

  if (!result.user || !result.user.id || !result.user.is_active) {
    redirect("/unauthorized");
  }

  return result.user;
});
