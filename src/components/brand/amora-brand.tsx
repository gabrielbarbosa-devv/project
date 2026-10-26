import Link from "next/link";

type AmoraBrandProps = { linked?: boolean; compact?: boolean };

export function AmoraBrand({ linked = false, compact = false }: AmoraBrandProps) {
  const mark = (
    <svg
      className="brand-mark"
      aria-hidden="true"
      viewBox="0 0 36 36"
      fill="none"
    >
      <path d="M5.5 29.5 15.8 7.2a2.4 2.4 0 0 1 4.4 0l10.3 22.3h-5.9L18 16.2l-6.6 13.3H5.5Z" fill="currentColor" />
      <path d="M15.2 24.1h10.5v4.6H13l2.2-4.6Z" fill="#F18F69" />
    </svg>
  );

  const content = (
    <>
      {mark}
      {!compact && <span>Amora</span>}
    </>
  );

  return linked ? (
    <Link className="brand-lockup" href="/" aria-label="Amora, início">
      {content}
    </Link>
  ) : (
    <span className="brand-lockup">{content}</span>
  );
}
