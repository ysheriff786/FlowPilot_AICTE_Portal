import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NAV_LINKS } from './landingData';

export const LandingHeader: React.FC = () => {
  const [open, setOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => firstLinkRef.current?.focus(), 40);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  return (
    <header className="fp-header" data-chapter="hero" data-scrolled="false">
      <div className="fp-header__shell">
        <a className="fp-wordmark" href="#top" aria-label="FlowPilot, back to top">
          <span className="fp-wordmark__mark" aria-hidden="true" />
          <span className="fp-wordmark__name">FlowPilot</span>
        </a>

        <nav className="fp-header__nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <Link className="fp-header__signin" to="/login">
            Sign in
          </Link>
        </nav>

        <div className="fp-header__mobile">
          <Link className="fp-header__signin" to="/login">
            Sign in
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            className="fp-menu-button"
            aria-expanded={open}
            aria-controls="fp-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>

      {open && (
        <>
          <div className="fp-menu-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <nav id="fp-mobile-menu" className="fp-mobile-menu" aria-label="Sections">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <p className="fp-mobile-menu__meta">
              Sample file · AICTE/2026/0412
              <br />
              Six gates · 12 Aug – 27 Sep 2026
            </p>
          </nav>
        </>
      )}
    </header>
  );
};
