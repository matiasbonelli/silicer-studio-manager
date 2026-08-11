import { landingContent } from '@/content/landing';

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

          <h2
            style={{
              fontFamily: 'var(--landing-font-display)',
              fontWeight: 400,
              fontSize: 'var(--landing-text-h2)',
              lineHeight: 'var(--landing-leading-heading)',
              color: 'var(--landing-ink)',
              margin: '0 0 var(--landing-space-3)',
              maxWidth: '16ch',
            }}
          >
            {about.title}
          </h2>

          <div style={{ display: 'grid', gap: 'var(--landing-space-2)' }}>
            {about.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
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
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .landing-about-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
