import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./AuthShell.module.css";

type AuthShellProps = {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkLabel: string;
  children: ReactNode;
};

export default function AuthShell({
  title,
  subtitle,
  footerText,
  footerLinkHref,
  footerLinkLabel,
  children,
}: AuthShellProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.card}>
          <header className={styles.cardHeader}>
            <div className={styles.brandLogo} aria-hidden="true">
              AF
            </div>

            <div className={styles.brandCopy}>
              <div className={styles.brand}>AssetFlow EAM</div>

              <div className={styles.brandDescription}>
                Enterprise Asset Management
              </div>

              <div className={styles.brandTagline}>Secure Access Portal</div>
            </div>
          </header>

          <div className={styles.cardBody}>
            <h1 className={styles.formTitle}>{title}</h1>

            <p className={styles.formSubtitle}>{subtitle}</p>

            {children}
          </div>

          <footer className={styles.cardFooter}>
            <div className={styles.footerText}>
              {footerText} <Link href={footerLinkHref}>{footerLinkLabel}</Link>
            </div>

            <div className={styles.footerDivider} />

            <Link href="/" className={styles.backLink}>
              Kembali ke Beranda
            </Link>
          </footer>
        </section>

        <p className={styles.footerCopyright}>
          AssetFlow EAM
          {" · "}
          Enterprise Asset Management
          <span className="d-block">Secure Workspace</span>
        </p>
      </div>
    </main>
  );
}
