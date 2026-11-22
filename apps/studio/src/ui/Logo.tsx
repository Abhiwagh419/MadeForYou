import { BRAND } from "@madeforyou/ui";

/** Arch (the jharokha window used across the product) with a heart cut into it. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M4 29V15a12 12 0 0 1 24 0v14z" fill="var(--rose)" />
      <path d="M16 24s-5.600-3.400-7.200-6.900C7.800 14.600 9.100 12.500 11.500 12.500c1.500 0 2.600.8 3.300 1.900h2.400c.7-1.100 1.800-1.900 3.300-1.900 2.400 0 3.700 2.100 2.700 4.600C21.600 20.600 16 24 16 24z" fill="var(--cream)" />
    </svg>
  );
}

export function Logo() {
  return (
    <a className="logo" href="/#/" aria-label={`${BRAND.name} home`}>
      <Mark />
      <span>{BRAND.name}</span>
    </a>
  );
}
