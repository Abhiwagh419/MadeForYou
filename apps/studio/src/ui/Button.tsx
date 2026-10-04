import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

interface Common {
  variant?: "primary" | "secondary" | "ghost" | "soft" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
  className?: string;
}
type BtnProps = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { href?: undefined };
type LinkProps = Common & { href: string; target?: string; rel?: string; download?: string; onClick?: () => void; "aria-label"?: string };

export function Button(props: BtnProps | LinkProps) {
  const { variant = "primary", size = "md", icon, iconRight, children, className = "", ...rest } = props;
  const cls = `btn btn-${variant} btn-${size} ${children ? "" : "btn-icon"} ${className}`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "lg" ? 20 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === "lg" ? 20 : 18} />}
    </>
  );
  if ("href" in rest && rest.href) {
    const { href, ...a } = rest as LinkProps;
    return <a className={cls} href={href} {...a}>{inner}</a>;
  }
  return <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>{inner}</button>;
}
