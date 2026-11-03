
import Link from "next/link";
import { Nav, NavItem } from "react-bootstrap";

import { getDictionary } from "@/locales/dictionary";

export default async function HeaderFeaturedNav() {
  const dict = await getDictionary();

  return (
    <Nav>
      <NavItem>
        <Link
          href="/dashboard"
          className="nav-link p-2"
        >
          {dict.featured_nav.dashboard}
        </Link>
      </NavItem>

      <NavItem>
        <span
          className="nav-link p-2"
          aria-disabled="true"
          title="Modul pengguna belum tersedia"
        >
          Users
        </span>
      </NavItem>

      <NavItem>
        <span
          className="nav-link p-2"
          aria-disabled="true"
          title="Modul pengaturan belum tersedia"
        >
          Settings
        </span>
      </NavItem>
    </Nav>
  );
}

