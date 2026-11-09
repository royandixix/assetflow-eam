import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-regular-svg-icons";
import { Nav, NavItem } from "react-bootstrap";

import HeaderLocale from "@/components/Layout/Dashboard/Header/HeaderLocale";
import { getLocale } from "@/locales/dictionary";

export default async function HeaderNotificationNav() {
  const currentLocale = await getLocale();

  return (
    <Nav className="d-flex align-items-center gap-2">
      <NavItem>
        <Link
          href="/dashboard/notifications"
          className="nav-link d-inline-flex align-items-center justify-content-center rounded-2 px-2 py-2 text-body-secondary"
          aria-label="Buka notifikasi"
          title="Notifikasi AssetFlow EAM"
        >
          <FontAwesomeIcon icon={faBell} size="lg" fixedWidth />
        </Link>
      </NavItem>

      <NavItem>
        <HeaderLocale currentLocale={currentLocale} />
      </NavItem>
    </Nav>
  );
}
