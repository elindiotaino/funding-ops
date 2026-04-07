"use client";
import { useState } from "react";

type SiteHeaderProps = {
  basePath: string;
};

const navItems = [
  { label: "Programs", href: "#programs" },
  { label: "Tasks", href: "#tasks" },
  { label: "Deadlines", href: "#deadlines" },
];

export function SiteHeader({ basePath }: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <a className="brand" href={`${basePath || ""}/`}>
          <span className="brand__mark">J</span>
          <span className="brand__copy">
            <strong>Joche Dev</strong>
            <span>Funding Ops</span>
          </span>
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
          <a href="https://hub.joche.dev">Hub</a>
          <a href="https://joche.dev" target="_blank" rel="noreferrer">
            Joche.dev
          </a>
        </nav>

        <button
          type="button"
          className="mobile-toggle"
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          onClick={() => setMobileOpen((current) => !current)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`mobile-panel${mobileOpen ? " mobile-panel--open" : ""}`}>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              {item.label}
            </a>
          ))}
          <a href="https://hub.joche.dev" onClick={() => setMobileOpen(false)}>
            Hub
          </a>
          <a href="https://joche.dev" target="_blank" rel="noreferrer" onClick={() => setMobileOpen(false)}>
            Joche.dev
          </a>
        </nav>
      </div>
    </header>
  );
}
