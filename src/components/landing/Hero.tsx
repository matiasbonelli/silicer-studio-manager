import { useEffect, useState } from 'react';
import { landingContent } from '@/content/landing';

interface HeroProps {
  onCtaClick: () => void;
}

/**
 * Estructura "afiche apilado": el titular ocupa casi toda la pantalla en
 * renglones apilados, la foto es un recuadro chico tipo estampilla incrustado
 * junto al texto (no un bloque en paralelo), y bajada+CTA se reubican a un
 * costado. Deliberadamente distinta del molde "foto al lado + texto al lado"
 * de silicer.com.ar — ver seed de Impeccable (concept-seed, scope: surface).
 */
export default function Hero({ onCtaClick }: HeroProps) {
  const { hero } = landingContent;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const reveal = (delayMs: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity var(--landing-duration-slow) var(--landing-ease-out) ${delayMs}ms, transform var(--landing-duration-slow) var(--landing-ease-out) ${delayMs}ms`,
  });

  return (
    <section
      id="top"
      className="landing-hero-poster"
      style={{
        backgroundColor: 'var(--landing-bg)',
        paddingBlock: 'var(--landing-space-5)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="landing-container"
        style={{
          minHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <p
          style={{
            ...reveal(0),
            fontFamily: 'var(--landing-font-body)',
            fontWeight: 700,
            fontSize: 'var(--landing-text-small)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--landing-primary)',
            margin: 0,
            display: 'inline-block',
            border: '1px solid var(--landing-primary)',
            borderRadius: 'var(--landing-radius-sm)',
            padding: '0.35rem 0.7rem',
            transform: 'rotate(-1.2deg)',
            alignSelf: 'flex-start',
          }}
        >
          {hero.eyebrow}
        </p>

        <div className="landing-hero-title-zone" style={{ position: 'relative', marginTop: 'var(--landing-space-3)' }}>
          <h1
            style={{
              fontFamily: 'var(--landing-font-display)',
              fontWeight: 400,
              fontSize: 'clamp(3.25rem, 2.4rem + 6.4vw, 8.5rem)',
              lineHeight: 0.92,
              color: 'var(--landing-ink)',
              margin: 0,
            }}
          >
            <span style={{ ...reveal(60), display: 'block' }}>Descubrí</span>
            <span style={{ ...reveal(140), display: 'block' }}>el arte de la</span>
            <span style={{ ...reveal(220), display: 'block' }}>cerámica</span>
          </h1>

          <div
            className="landing-hero-stamp"
            style={{
              ...reveal(300),
              position: 'absolute',
              right: '4%',
              top: '38%',
              width: 'clamp(140px, 16vw, 220px)',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--landing-surface)',
                padding: '0.5rem 0.5rem 1.1rem',
                borderRadius: 'var(--landing-radius-sm)',
                boxShadow: '0 24px 45px -22px rgba(34, 25, 51, 0.4)',
                transform: 'rotate(3.5deg)',
                transition: `transform var(--landing-duration-base) var(--landing-ease-out)`,
              }}
              className="landing-hero-stamp-card"
            >
              <img
                src={hero.image.src}
                alt={hero.image.alt}
                style={{
                  width: '100%',
                  aspectRatio: '5 / 6',
                  objectFit: 'cover',
                  display: 'block',
                  borderRadius: '2px',
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="landing-hero-footline"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 'var(--landing-space-4)',
          }}
        >
          <div style={{ ...reveal(380), maxWidth: '30ch', textAlign: 'right' }}>
            <p
              style={{
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 300,
                fontSize: 'var(--landing-text-body)',
                lineHeight: 'var(--landing-leading-body)',
                color: 'var(--landing-muted)',
                margin: '0 0 var(--landing-space-3)',
              }}
            >
              {hero.subtitle}
            </p>
            <button
              type="button"
              onClick={onCtaClick}
              className="landing-hero-cta"
              style={{
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 700,
                fontSize: 'var(--landing-text-body)',
                color: 'var(--landing-primary-foreground)',
                backgroundColor: 'var(--landing-primary)',
                border: 'none',
                borderRadius: 'var(--landing-radius-md)',
                padding: '0.9rem 1.9rem',
                cursor: 'pointer',
                transition: `background-color var(--landing-duration-fast) var(--landing-ease-out)`,
              }}
            >
              {hero.ctaLabel}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .landing-hero-stamp-card:hover {
          transform: rotate(0deg) scale(1.04);
        }
        .landing-hero-cta:hover {
          background-color: var(--landing-primary-hover);
        }
        .landing-hero-cta:focus-visible {
          outline: 2px solid var(--landing-primary);
          outline-offset: 3px;
        }
        @media (max-width: 720px) {
          .landing-hero-title-zone { margin-top: var(--landing-space-6) !important; }
          .landing-hero-stamp {
            position: static !important;
            width: 46vw !important;
            margin: var(--landing-space-4) 0 0 auto !important;
          }
          .landing-hero-footline { justify-content: flex-start !important; }
          .landing-hero-footline > div { text-align: left !important; }
        }
      `}</style>
    </section>
  );
}
