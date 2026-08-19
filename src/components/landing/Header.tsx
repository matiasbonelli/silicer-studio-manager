import { useEffect, useRef, useState } from 'react';
import { landingContent } from '@/content/landing';

interface HeaderProps {
  onCtaClick: () => void;
  // El header pasó de sticky a fixed (sticky no funciona dentro del
  // contenedor con transform de ScrollSmoother), así que ya no reserva su
  // propio espacio en el flujo — el padre necesita esta altura para poner
  // un espaciador y que el Hero no quede tapado debajo.
  onHeightChange?: (height: number) => void;
}

export default function Header({ onCtaClick, onHeightChange }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const { header } = landingContent;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!onHeightChange || !headerRef.current) return;
    const el = headerRef.current;
    const report = () => onHeightChange(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <header
      ref={headerRef}
      className="landing-header"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding: 'var(--landing-space-3) 0 0',
      }}
    >
      <div className="landing-container">
        <div
          className="landing-header-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.65rem 1.5rem',
            borderRadius: 'var(--landing-radius-form)',
            backgroundColor: scrolled
              ? 'color-mix(in srgb, var(--landing-bg) 62%, transparent)'
              : 'color-mix(in srgb, var(--landing-bg) 48%, transparent)',
            backdropFilter: 'blur(22px) saturate(160%)',
            WebkitBackdropFilter: 'blur(22px) saturate(160%)',
            border: '1px solid color-mix(in srgb, var(--landing-ink) 8%, transparent)',
            boxShadow: scrolled
              ? '0 2px 5px rgba(20, 14, 30, 0.06), 0 28px 54px -16px rgba(20, 14, 30, 0.3)'
              : '0 2px 5px rgba(20, 14, 30, 0.04), 0 24px 48px -18px rgba(20, 14, 30, 0.2)',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          }}
        >
          <a href="#top" aria-label={header.logoAlt}>
            <img
              src="/logo.svg"
              alt={header.logoAlt}
              style={{ height: 24, display: 'block' }}
            />
          </a>

          <button
            type="button"
            onClick={onCtaClick}
            className="landing-header-cta"
            style={{
              fontFamily: 'var(--landing-font-body)',
              fontWeight: 300,
              fontSize: 'var(--landing-text-small)',
              color: 'var(--landing-ink)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.35rem 0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {header.ctaLabel}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
              <path
                d="M8.5 1L13 5M13 5L8.5 9M13 5H1"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        .landing-header-cta:focus-visible {
          outline: 2px solid var(--landing-primary);
          outline-offset: 4px;
          border-radius: 2px;
        }
      `}</style>
    </header>
  );
}
