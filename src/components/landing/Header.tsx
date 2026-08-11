import { useEffect, useState } from 'react';
import { landingContent } from '@/content/landing';

interface HeaderProps {
  onCtaClick: () => void;
}

export default function Header({ onCtaClick }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { header } = landingContent;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="landing-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        transition: `background-color var(--landing-duration-base) var(--landing-ease-out), border-color var(--landing-duration-base) var(--landing-ease-out), box-shadow var(--landing-duration-base) var(--landing-ease-out)`,
        backgroundColor: scrolled ? 'color-mix(in srgb, var(--landing-bg) 92%, transparent)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: `1px solid ${scrolled ? 'var(--landing-border)' : 'transparent'}`,
      }}
    >
      <div
        className="landing-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBlock: 'var(--landing-space-2)',
        }}
      >
        <a href="#top" aria-label={header.logoAlt}>
          <img src="/logo.svg" alt={header.logoAlt} style={{ height: 28, display: 'block' }} />
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
            position: 'relative',
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
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 22,
              bottom: 0,
              height: 1,
              backgroundColor: 'var(--landing-primary)',
              transform: 'scaleX(0)',
              transformOrigin: 'left',
              transition: `transform var(--landing-duration-fast) var(--landing-ease-out)`,
            }}
            className="landing-header-cta-underline"
          />
        </button>
      </div>

      <style>{`
        .landing-header-cta:hover .landing-header-cta-underline,
        .landing-header-cta:focus-visible .landing-header-cta-underline {
          transform: scaleX(1);
        }
        .landing-header-cta:focus-visible {
          outline: 2px solid var(--landing-primary);
          outline-offset: 4px;
          border-radius: 2px;
        }
      `}</style>
    </header>
  );
}
