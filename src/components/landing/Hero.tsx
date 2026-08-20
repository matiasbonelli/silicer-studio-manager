import { landingContent } from '@/content/landing';
import SplitText from './SplitText';
import AnimatedContent from './AnimatedContent';

interface HeroProps {
  onCtaClick: () => void;
}

/**
 * Disposición en dos columnas: texto (con el tag de taller enmarcado) a la
 * izquierda, foto grande a la derecha. Titular a escala moderada (no la
 * escala póster) — ajuste pedido por el usuario sobre la versión anterior.
 */
export default function Hero({ onCtaClick }: HeroProps) {
  const { hero } = landingContent;

  return (
    <section
      id="top"
      style={{
        backgroundColor: 'var(--landing-bg)',
        paddingBlock: 'var(--landing-space-6)',
      }}
    >
      <div
        className="landing-container landing-hero-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 'var(--landing-space-5)',
          alignItems: 'center',
        }}
      >
        <div className="landing-hero-copy">
          <AnimatedContent>
            <p
              className="landing-hero-eyebrow"
              style={{
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
              }}
            >
              {hero.eyebrow}
            </p>
          </AnimatedContent>

          <SplitText
            tag="h1"
            className="landing-hero-title"
            text={hero.title}
            splitType="words"
            textAlign="left"
            delay={170}
            duration={2}
            ease="power2.out"
            from={{ opacity: 0, y: 24 }}
            to={{ opacity: 1, y: 0 }}
          />

          <AnimatedContent delay={150}>
            <p
              className="landing-hero-subtitle"
              style={{
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 300,
                fontSize: 'var(--landing-text-body-lg)',
                lineHeight: 'var(--landing-leading-body)',
                color: 'var(--landing-muted)',
                margin: 'var(--landing-space-3) 0 0',
                maxWidth: '38ch',
              }}
            >
              {hero.subtitle}
            </p>
          </AnimatedContent>

          <AnimatedContent delay={300}>
            <div style={{ marginTop: 'var(--landing-space-4)' }}>
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
                }}
              >
                {hero.ctaLabel}
              </button>
            </div>
          </AnimatedContent>
        </div>

        <AnimatedContent style={{ position: 'relative' }} delay={200}>
          <div
            className="landing-hero-image-frame"
            style={{
              borderRadius: 'var(--landing-radius-lg)',
              overflow: 'hidden',
              transform: 'rotate(-1.4deg)',
              boxShadow: '0 30px 60px -30px rgba(34, 25, 51, 0.35)',
              backgroundColor: 'var(--landing-bg-alt)',
            }}
          >
            <img
              src={hero.image.src}
              alt={hero.image.alt}
              style={{
                width: '100%',
                aspectRatio: '4 / 5',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </AnimatedContent>
      </div>

      <style>{`
        .landing-hero-title {
          font-family: var(--landing-font-display);
          font-weight: 400;
          font-size: var(--landing-text-display);
          line-height: var(--landing-leading-display);
          color: var(--landing-ink);
          margin: var(--landing-space-3) 0 0;
          max-width: 11ch;
        }
        .landing-hero-cta {
          transition: background-color 0.3s ease;
        }
        .landing-hero-cta:hover {
          background-color: var(--landing-secondary) !important;
        }
        .landing-hero-cta:focus-visible {
          outline: 2px solid var(--landing-primary);
          outline-offset: 3px;
        }
        @media (max-width: 860px) {
          .landing-hero-grid {
            grid-template-columns: 1fr !important;
          }
          .landing-hero-copy {
            text-align: center;
          }
          .landing-hero-title,
          .landing-hero-subtitle {
            margin-left: auto !important;
            margin-right: auto !important;
            text-align: center !important;
          }
        }
        @media (max-width: 640px) {
          .landing-hero-eyebrow {
            max-width: 220px;
          }
        }
      `}</style>
    </section>
  );
}
