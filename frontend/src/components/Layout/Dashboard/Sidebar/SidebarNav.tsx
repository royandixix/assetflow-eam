import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import {
  faBell,
  faBolt,
  faBox,
  faBoxesStacked,
  faBuilding,
  faChartLine,
  faChartPie,
  faClipboardList,
  faClockRotateLeft,
  faGauge,
  faGear,
  faLayerGroup,
  faLocationDot,
  faRightLeft,
  faScrewdriverWrench,
  faShieldHalved,
  faToolbox,
  faTruck,
  faUsers,
  faWrench,
} from "@fortawesome/free-solid-svg-icons";

import { Badge } from "react-bootstrap";

import SidebarNavGroup from "@/components/Layout/Dashboard/Sidebar/SidebarNavGroup";
import SidebarNavItem from "@/components/Layout/Dashboard/Sidebar/SidebarNavItem";

type MenuItem = {
  label: string;
  icon: IconDefinition;
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

const assetMenus: MenuItem[] = [
  {
    label: "Daftar Aset",
    icon: faBox,
    href: "/dashboard/assets",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Kategori Aset",
    icon: faLayerGroup,
    href: "/dashboard/asset-categories",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Lokasi",
    icon: faLocationDot,
    href: "/dashboard/locations",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Departemen",
    icon: faBuilding,
    href: "/dashboard/departments",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Penugasan Aset",
    icon: faClipboardList,
    href: "/dashboard/assignments",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
  {
    label: "Mutasi Aset",
    icon: faRightLeft,
    href: "/dashboard/transfers",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
];

const maintenanceMenus: MenuItem[] = [
  {
    label: "Maintenance",
    icon: faWrench,
    href: "/dashboard/maintenance",
    roles: allRoles,
  },
  {
    label: "Work Orders",
    icon: faScrewdriverWrench,
    href: "/dashboard/work-orders",
    roles: allRoles,
  },
  {
    label: "Vendor",
    icon: faTruck,
    href: "/dashboard/vendors",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN"],
  },
];

const monitoringMenus: MenuItem[] = [
  {
    label: "Laporan",
    icon: faChartPie,
    href: "/dashboard/reports",
    roles: ["SUPER_ADMIN", "ASSET_ADMIN", "MANAGER"],
  },
  {
    label: "Notifikasi",
    icon: faBell,
    href: "/dashboard/notifications",
    roles: allRoles,
  },
];

const administrationMenus: MenuItem[] = [
  {
    label: "Pengguna & Role",
    icon: faUsers,
    href: "/dashboard/users",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Audit Trail",
    icon: faClockRotateLeft,
    href: "#",
    roles: ["SUPER_ADMIN"],
  },
  {
    label: "Pengaturan",
    icon: faGear,
    href: "#",
    roles: ["SUPER_ADMIN"],
  },
];

function SidebarNavTitle({ children }: { children: string }) {
  return (
    <li className="nav-title px-3 py-2 mt-3 text-uppercase fw-bold">
      {children}
    </li>
  );
}

function visibleForRole(items: MenuItem[], roleCode: string): MenuItem[] {
  return items.filter((item) => item.roles.includes(roleCode));
}

function renderMenuItems(items: MenuItem[]) {
  return items.map((item) => (
    <SidebarNavItem key={item.label} icon={item.icon} href={item.href}>
      {item.label}
    </SidebarNavItem>
  ));
}

export default function SidebarNav({ roleCode }: { roleCode: string }) {
  const assets = visibleForRole(assetMenus, roleCode);

  const maintenance = visibleForRole(maintenanceMenus, roleCode);

  const monitoring = visibleForRole(monitoringMenus, roleCode);

  const administration = visibleForRole(administrationMenus, roleCode);

  return (
    <ul className="list-unstyled">
      <SidebarNavItem icon={faGauge} href="/dashboard">
        Dashboard
        <small className="ms-auto">
          <Badge bg="info" className="ms-auto">
            HOME
          </Badge>
        </small>
      </SidebarNavItem>

      {(assets.length > 0 || maintenance.length > 0) && (
        <SidebarNavTitle>Asset Management</SidebarNavTitle>
      )}

      {assets.length > 0 && (
        <SidebarNavGroup
          toggleIcon={faBoxesStacked}
          toggleText="Manajemen Aset"
        >
          {renderMenuItems(assets)}
        </SidebarNavGroup>
      )}

      {maintenance.length > 0 && (
        <SidebarNavGroup toggleIcon={faToolbox} toggleText="Pemeliharaan">
          {renderMenuItems(maintenance)}
        </SidebarNavGroup>
      )}

      {monitoring.length > 0 && (
        <>
          <SidebarNavTitle>Monitoring</SidebarNavTitle>

          <SidebarNavGroup
            toggleIcon={faChartLine}
            toggleText="Laporan & Notifikasi"
          >
            {renderMenuItems(monitoring)}
          </SidebarNavGroup>
        </>
      )}

      {administration.length > 0 && (
        <>
          <SidebarNavTitle>Administration</SidebarNavTitle>

          <SidebarNavGroup
            toggleIcon={faShieldHalved}
            toggleText="Administrasi"
          >
            {renderMenuItems(administration)}
          </SidebarNavGroup>
        </>
      )}

      <SidebarNavTitle>Workspace</SidebarNavTitle>

      <SidebarNavItem icon={faBolt} href="#">
        Aktivitas
      </SidebarNavItem>
    </ul>
  );
}
