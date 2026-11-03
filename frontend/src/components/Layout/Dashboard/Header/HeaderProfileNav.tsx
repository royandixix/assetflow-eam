
"use client";

import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faComments,
  faCreditCard,
  faEnvelope,
  faGear,
  faListCheck,
  faLock,
  faUser
} from "@fortawesome/free-solid-svg-icons";
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle
} from "react-bootstrap";

import HeaderLogout from "./HeaderLogout";

type ProfileProps = {
  fullName: string;
  email: string;
  roleCode: string;
};

export default function HeaderProfileNav({
  fullName,
  email,
  roleCode
}: ProfileProps) {
  return (
    <Dropdown align="end">
      <DropdownToggle
        as="button"
        bsPrefix="btn"
        id="assetflow-profile"
        className="border-0 bg-transparent p-0 shadow-none rounded-circle"
        aria-label="Buka menu akun"
        title={fullName}
      >
        <span className="avatar avatar-md">
          <Image
            src="/assets/img/avatars/8.jpg"
            width={36}
            height={36}
            alt="Avatar akun"
            className="rounded-circle"
            style={{
              width: "36px",
              height: "36px",
              objectFit: "cover"
            }}
          />
        </span>
      </DropdownToggle>

      <DropdownMenu
        align="end"
        className="pt-0 shadow-sm"
        style={{ minWidth: "220px" }}
      >
        <DropdownHeader className="fw-bold">
          Account
        </DropdownHeader>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faBell}
            className="me-2"
            fixedWidth
          />
          Updates
        </DropdownItem>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faEnvelope}
            className="me-2"
            fixedWidth
          />
          Messages
        </DropdownItem>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faListCheck}
            className="me-2"
            fixedWidth
          />
          Tasks
        </DropdownItem>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faComments}
            className="me-2"
            fixedWidth
          />
          Comments
        </DropdownItem>

        <DropdownHeader className="fw-bold">
          Settings
        </DropdownHeader>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faUser}
            className="me-2"
            fixedWidth
          />
          Profile
        </DropdownItem>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faGear}
            className="me-2"
            fixedWidth
          />
          Settings
        </DropdownItem>

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faCreditCard}
            className="me-2"
            fixedWidth
          />
          Payments
        </DropdownItem>

        <DropdownDivider />

        <div className="px-3 py-2">
          <div className="fw-semibold small">
            {fullName}
          </div>

          <div className="text-body-secondary small text-break">
            {email}
          </div>

          <div className="mt-2">
            <span className="badge bg-primary">
              {roleCode}
            </span>
          </div>
        </div>

        <DropdownDivider />

        <DropdownItem disabled>
          <FontAwesomeIcon
            icon={faLock}
            className="me-2"
            fixedWidth
          />
          Lock account
        </DropdownItem>

        <HeaderLogout />
      </DropdownMenu>
    </Dropdown>
  );
}
