
"use client";

import type { PropsWithChildren } from "react";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import Link from "next/link";
import { NavItem } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useSidebar } from "@/components/Layout/Dashboard/SidebarProvider";

type Props = {
  href: string;
  icon?: IconDefinition;
} & PropsWithChildren;

export default function SidebarNavItem({
  href,
  icon,
  children
}: Props) {
  const {
    showSidebarState: [, setIsShowSidebar]
  } = useSidebar();

  return (
    <NavItem>
      <Link
        href={href}
        className="nav-link px-3 py-2 d-flex align-items-center"
        onClick={() => setIsShowSidebar(false)}
      >
        {icon ? (
          <FontAwesomeIcon
            className="nav-icon ms-n3"
            icon={icon}
            fixedWidth
          />
        ) : (
          <span className="nav-icon ms-n3" />
        )}

        {children}
      </Link>
    </NavItem>
  );
}
