"use client";

import React from "react";
import classNames from "classnames";
import { useSidebar } from "@/components/Layout/Dashboard/SidebarProvider";

export default function SidebarOverlay() {
  const {
    showSidebarState: [isShowSidebar, setIsShowSidebar],
  } = useSidebar();

  const hideSidebar = () => {
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.classList.contains("sidebar-overlay")
    ) {
      document.activeElement.blur();
    }

    setIsShowSidebar(false);
  };

  return (
    <div
      aria-hidden="true"
      className={classNames(
        "sidebar-overlay position-fixed top-0 bg-dark w-100 h-100 opacity-50",
        {
          "d-none": !isShowSidebar,
        },
      )}
      onClick={hideSidebar}
    />
  );
}
