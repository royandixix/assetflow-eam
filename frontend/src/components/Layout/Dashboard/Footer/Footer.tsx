export default function Footer() {
  return (
    <footer className="footer px-4 d-flex flex-wrap align-items-center justify-content-between gap-2">
      <div>
        <span className="fw-semibold text-primary">
          AssetFlow EAM
        </span>
        <span className="ms-2 text-body-secondary">
          © 2026. Enterprise Asset Management.
        </span>
      </div>

      <div className="text-body-secondary small">
        Powered by{" "}
        <span className="fw-semibold">
          Next.js, Go & Supabase
        </span>
      </div>
    </footer>
  );
}
