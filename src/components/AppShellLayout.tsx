"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/" as Route, label: "Dashboard" },
  { href: "/opportunities" as Route, label: "Opportunities" },
  { href: "/programs" as Route, label: "Programs" },
  { href: "/tasks" as Route, label: "Tasks" },
  { href: "/settings" as Route, label: "Settings" },
];

export function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link className="app-brand" href="/">
          <span className="app-brand__mark">FO</span>
          <span className="app-brand__copy">
            <strong>Funding Ops</strong>
            <span>Joche Dev</span>
          </span>
        </Link>

        <nav className="app-nav" aria-label="Primary">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === item.href
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                className={`app-nav__link${active ? " app-nav__link--active" : ""}`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="app-sidebar__footer">
          <a href="https://hub.joche.dev">Back to Hub</a>
          <a href="https://funding-ops.joche.dev" target="_blank" rel="noreferrer">
            Live App
          </a>
        </div>
      </aside>

      <div className="app-main">
        <div className="app-mobilebar">
          <Link className="app-brand app-brand--mobile" href="/">
            <span className="app-brand__mark">FO</span>
            <span className="app-brand__copy">
              <strong>Funding Ops</strong>
              <span>Joche Dev</span>
            </span>
          </Link>
          <button
            type="button"
            className="app-mobilebar__toggle"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`app-drawer${mobileOpen ? " app-drawer--open" : ""}`}>
          <nav className="app-drawer__nav" aria-label="Mobile primary">
            {navItems.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  className={`app-nav__link${active ? " app-nav__link--active" : ""}`}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
