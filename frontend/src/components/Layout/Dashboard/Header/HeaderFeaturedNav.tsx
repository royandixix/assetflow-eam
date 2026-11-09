"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Nav, NavItem } from "react-bootstrap";

type HeaderFeaturedNavProps = {
  roleCode: string;
};

type MenuItem = {
  label: string;
  href: string;
  roles: string[];
};

const allRoles = [
  "SUPER_ADMIN",
  "ASSET_ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "STAFF",
];

const menus: MenuItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    roles: allRoles,
  },
  {
    label: "Aset",
    href: "/dashboard/assets",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Laporan",
    href: "/dashboard/reports",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN", "MANAGER"],
  },
  {
    label: "Pengguna",
    href: "/dashboard/users",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Pengaturan",
    href: "/dashboard/settings",
    roles: ["SUPER_ADMIN"],
  },
];

export default function HeaderFeaturedNav({
  roleCode,
}: HeaderFeaturedNavProps) {
  const pathname = usePathname();

  const visibleMenus = menus.filter((menu) => menu.roles.includes(roleCode));

  return (
    <Nav className="d-flex align-items-center gap-1">
      {visibleMenus.map((menu) => {
        const active =
          pathname === menu.href ||
          (menu.href !== "/dashboard" && pathname.startsWith(`${menu.href}/`));

        return (
          <NavItem key={menu.href}>
            <Link
              href={menu.href}
              aria-current={active ? "page" : undefined}
              className={[
                "nav-link px-3 py-2 rounded-2",
                "text-decoration-none",
                active
                  ? "fw-semibold bg-body-secondary text-body"
                  : "text-body-secondary",
              ].join(" ")}
            >
              {menu.label}
            </Link>
          </NavItem>
        );
      })}
    </Nav>
  );
}
