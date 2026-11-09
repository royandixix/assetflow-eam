import Link from "next/link";
import { Container } from "react-bootstrap";

import HeaderSidebarToggler from "./HeaderSidebarToggler";
import HeaderFeaturedNav from "./HeaderFeaturedNav";
import HeaderNotificationNav from "./HeaderNotificationNav";
import HeaderProfileNav from "./HeaderProfileNav";

import Breadcrumb from "@/components/Layout/Dashboard/Breadcrumb/Breadcrumb";

type HeaderProps = {
  fullName: string;
  email: string;
  roleCode: string;
};

export default function Header({ fullName, email, roleCode }: HeaderProps) {
  return (
    <header className="header sticky-top mb-4 py-2 px-sm-2 border-bottom bg-body">
      <Container
        fluid
        className="header-navbar d-flex align-items-center gap-2 px-0"
      >
        <HeaderSidebarToggler />

        <Link
          href="/dashboard"
          className="header-brand d-xl-none text-decoration-none fw-bold text-body"
        >
          AssetFlow EAM
        </Link>

        <div className="header-nav d-none d-xl-flex">
          <HeaderFeaturedNav roleCode={roleCode} />
        </div>

        <div className="header-nav ms-auto d-flex align-items-center">
          <HeaderNotificationNav />
        </div>

        <div className="header-nav ms-2">
          <HeaderProfileNav
            fullName={fullName}
            email={email}
            roleCode={roleCode}
          />
        </div>
      </Container>

      <div className="header-divider border-top my-2 mx-sm-n2" />

      <Container fluid>
        <Breadcrumb />
      </Container>
    </header>
  );
}
