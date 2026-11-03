
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPowerOff } from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@/lib/supabase/client";

export default function HeaderLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage("Gagal keluar dari akun");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Layanan autentikasi tidak dapat dihubungi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dropdown.Item
        onClick={handleLogout}
        disabled={loading}
      >
        <FontAwesomeIcon
          icon={faPowerOff}
          fixedWidth
          className="me-2"
        />
        {loading ? "Memproses..." : "Keluar"}
      </Dropdown.Item>

      {errorMessage && (
        <Dropdown.ItemText className="text-danger small">
          {errorMessage}
        </Dropdown.ItemText>
      )}
    </>
  );
}
