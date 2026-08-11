import { landingContent } from '@/content/landing';
import { practicalInfoIcons, PinIcon } from './icons';

/**
 * Franja de datos (no tarjetas con caja, para no repetir el molde de
 * "Qué vas a aprender") + bloque de ubicación con mapa embebido.
 */
export default function PracticalInfo() {
  const { practicalInfo } = landingContent;
  const mapQuery = encodeURIComponent(practicalInfo.location.address);

  return (
    <section style={{ backgroundColor: 'var(--landing-bg)', paddingBlock: 'var(--landing-space-7)' }}>
      <div className="landing-container">
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
          {practicalInfo.eyebrow}
        </p>
        <h2
          style={{
            fontFamily: 'var(--landing-font-display)',
            fontWeight: 400,
            fontSize: 'var(--landing-text-h2)',
            lineHeight: 'var(--landing-leading-heading)',
            color: 'var(--landing-ink)',
            margin: '0 0 var(--landing-space-5)',
          }}
        >
          {practicalInfo.title}
        </h2>

        <div
          className="landing-info-strip"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            borderTop: '1px solid var(--landing-border)',
            borderBottom: '1px solid var(--landing-border)',
            marginBottom: 'var(--landing-space-6)',
          }}
        >
          {practicalInfo.cards.map((card, i) => {
            const Icon = practicalInfoIcons[card.icon as keyof typeof practicalInfoIcons];
            return (
              <div
                key={card.label}
                style={{
                  padding: 'var(--landing-space-4) var(--landing-space-3)',
                  borderLeft: i > 0 ? '1px solid var(--landing-border)' : 'none',
                }}
              >
                <Icon style={{ width: 30, height: 30, color: 'var(--landing-primary)' }} />
                <p
                  style={{
                    fontFamily: 'var(--landing-font-display)',
                    fontWeight: 400,
                    fontSize: 'var(--landing-text-h3)',
                    color: 'var(--landing-ink)',
                    margin: 'var(--landing-space-2) 0 0.25rem',
                  }}
                >
                  {card.value}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--landing-font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--landing-text-small)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--landing-muted)',
                    margin: 0,
                  }}
                >
                  {card.label}
                </p>
              </div>
            );
          })}
        </div>

        <div
          className="landing-location-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '0.9fr 1.1fr',
            gap: 'var(--landing-space-4)',
            alignItems: 'stretch',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--landing-space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--landing-space-2)', alignItems: 'flex-start' }}>
              <PinIcon style={{ width: 24, height: 24, color: 'var(--landing-primary)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p
                  style={{
                    fontFamily: 'var(--landing-font-body)',
                    fontWeight: 700,
                    fontSize: 'var(--landing-text-small)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--landing-muted)',
                    margin: '0 0 0.2rem',
                  }}
                >
                  {practicalInfo.location.label}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--landing-font-body)',
                    fontWeight: 300,
                    fontSize: 'var(--landing-text-body-lg)',
                    color: 'var(--landing-ink)',
                    margin: 0,
                  }}
                >
                  {practicalInfo.location.address}
                </p>
              </div>
            </div>

            <div>
              <p
                style={{
                  fontFamily: 'var(--landing-font-body)',
                  fontWeight: 700,
                  fontSize: 'var(--landing-text-small)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: 'var(--landing-muted)',
                  margin: '0 0 0.2rem',
                }}
              >
                {practicalInfo.schedule.label}
              </p>
              <p
                style={{
                  fontFamily: 'var(--landing-font-body)',
                  fontWeight: 300,
                  fontSize: 'var(--landing-text-body-lg)',
                  color: 'var(--landing-ink)',
                  margin: 0,
                }}
              >
                {practicalInfo.schedule.value}
              </p>
            </div>
          </div>

          <div
            style={{
              borderRadius: 'var(--landing-radius-lg)',
              overflow: 'hidden',
              minHeight: 260,
              border: '1px solid var(--landing-border)',
            }}
          >
            <iframe
              title={practicalInfo.location.label}
              src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: 260, display: 'block' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .landing-info-strip {
            grid-template-columns: 1fr !important;
          }
          .landing-info-strip > div {
            border-left: none !important;
            border-top: 1px solid var(--landing-border);
          }
          .landing-info-strip > div:first-child {
            border-top: none;
          }
          .landing-location-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
