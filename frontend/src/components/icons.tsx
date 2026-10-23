import type { ReactNode } from 'react';

// Inline SVG (no icon font, no inline styles) keeps the strict CSP intact.
// Every icon is decorative: the accessible name always comes from nearby text.
function Icon({
  className = 'size-4',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const CheckCircleIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="m6.75 10.25 2.25 2.25 4.25-4.75" />
  </Icon>
);

export const BanIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="m4.9 4.9 10.2 10.2" />
  </Icon>
);

export const AlertIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M10 3 2.75 16h14.5L10 3Z" />
    <path d="M10 8v3.5M10 13.75v.01" />
  </Icon>
);

export const CloseIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
  </Icon>
);

export const LockIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <rect x="4.25" y="9" width="11.5" height="8" rx="1.5" />
    <path d="M6.75 9V6.5a3.25 3.25 0 0 1 6.5 0V9" />
  </Icon>
);

export const PlusIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icon>
);

export const ChevronIcon = ({ className }: IconProps) => (
  <Icon className={className}>
    <path d="m7.5 5 5 5-5 5" />
  </Icon>
);
