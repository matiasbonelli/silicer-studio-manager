import { landingContent } from '@/content/landing';
import SplitText from './SplitText';
import AnimatedContent from './AnimatedContent';

/**
 * Bloque editorial texto+imagen (referencia soil-net: imagen primero en el
 * DOM, proporción ~40:60, cuerpo generoso). Sin foto real todavía — se
 * reserva el espacio con un panel propio en vez de rellenar con stock.
 */
export default function About() {
  const { about } = landingContent;

  return (
    <section style={{ backgroundColor: 'var(--landing-bg-alt)', paddingBlock: 'var(--landing-space-7)' }}>
      <div
        className="landing-container landing-about-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '0.85fr 1.15fr',
          gap: 'var(--landing-space-5)',
          alignItems: 'center',
        }}
      >
        <div>
          {about.image.src ? (
            <img
              src={about.image.src}
              alt={about.image.alt}
              style={{
                width: '100%',
                aspectRatio: '5 / 6',
                objectFit: 'cover',
                borderRadius: 'var(--landing-radius-lg)',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                aspectRatio: '5 / 6',
                borderRadius: 'var(--landing-radius-lg)',
                backgroundColor: 'var(--landing-surface)',
                border: '1px solid var(--landing-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--landing-space-3)',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--landing-font-body)',
                  fontWeight: 700,
                  fontSize: 'var(--landing-text-small)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--landing-muted)',
                }}
              >
                Foto del espacio — próximamente
              </span>
            </div>
          )}
        </div>

        <div>
          <AnimatedContent>
            <p
              style={{
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 700,
                fontSize: 'var(--landing-text-small)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--landing-primary)',
                margin: '0 0 var(--landing-space-2)',
              }}
            >
              {about.eyebrow}
            </p>
          </AnimatedContent>

          <SplitText
            tag="h2"
            className="landing-about-title"
            text={about.title}
            splitType="words"
            textAlign="left"
            delay={90}
            duration={1.2}
            ease="power2.out"
            from={{ opacity: 0, y: 20 }}
            to={{ opacity: 1, y: 0 }}
          />

          <div style={{ display: 'grid', gap: 'var(--landing-space-2)' }}>
            {about.paragraphs.map((paragraph, i) => (
              <AnimatedContent key={paragraph} delay={150 + i * 150}>
                <p
                  style={{
                    fontFamily: 'var(--landing-font-body)',
                    fontWeight: 300,
                    fontSize: 'var(--landing-text-body-lg)',
                    lineHeight: 'var(--landing-leading-body)',
                    color: 'var(--landing-muted)',
                    margin: 0,
                    maxWidth: '52ch',
                  }}
                >
                  {paragraph}
                </p>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .landing-about-title {
          font-family: var(--landing-font-display);
          font-weight: 400;
          font-size: var(--landing-text-h2);
          line-height: var(--landing-leading-heading);
          color: var(--landing-ink);
          margin: 0 0 var(--landing-space-3);
          max-width: 16ch;
        }
        @media (max-width: 780px) {
          .landing-about-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
