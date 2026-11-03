
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function logout() {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("Logout gagal");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Gagal terhubung ke Supabase");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-outline-danger"
        onClick={logout}
        disabled={loading}
      >
        {loading ? "Memproses..." : "Keluar"}
      </button>

      {errorMessage && (
        <div className="small text-danger mt-2">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
