"use client";

import { useEffect } from "react";

export default function SettingsRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.setAttribute("data-coreui-theme", "light");
    root.setAttribute("data-bs-theme", "light");

    body.setAttribute("data-coreui-theme", "light");
    body.setAttribute("data-bs-theme", "light");

    root.style.colorScheme = "light";

    try {
      window.localStorage.setItem("assetflow-theme", "light");
    } catch {
      // Tampilan tetap menggunakan tema terang.
    }
  }, []);

  return null;
}
