import { landingContent } from '@/content/landing';
import { practicalInfoIcons, PinIcon, CalendarIcon } from './icons';
import SplitText from './SplitText';
import AnimatedContent from './AnimatedContent';

const MAP_LINK = 'https://maps.app.goo.gl/9c2PgHk7BCAragN57';

/**
 * Franja de datos (no tarjetas con caja, para no repetir el molde de
 * "Qué vas a aprender") + bloque de ubicación con mapa embebido.
 */
export default function PracticalInfo() {
  const { practicalInfo } = landingContent;

  return (
    <section
      style={{ backgroundColor: 'var(--landing-bg)', paddingTop: 'var(--landing-space-5)', paddingBottom: 'var(--landing-space-7)' }}
    >
      <div className="landing-container">
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
            {practicalInfo.eyebrow}
          </p>
        </AnimatedContent>
        <SplitText
          tag="h2"
          className="landing-practical-title"
          text={practicalInfo.title}
          splitType="words"
          textAlign="left"
          delay={90}
          duration={1.2}
          ease="power2.out"
          from={{ opacity: 0, y: 20 }}
          to={{ opacity: 1, y: 0 }}
        />

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
              <AnimatedContent
                key={card.value}
                direction="horizontal"
                reverse
                blur={0}
                distance={70}
                duration={1}
                delay={i * 600}
                style={{ height: '100%' }}
              >
                <div
                  style={{
                    height: '100%',
                    boxSizing: 'border-box',
                    padding: 'var(--landing-space-4) var(--landing-space-3)',
                    borderLeft: i > 0 ? '1px solid var(--landing-border)' : 'none',
                  }}
                >
                  <Icon strokeWidth={2.1} style={{ width: 34, height: 34, color: 'var(--landing-primary)' }} />
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
                  {card.label && (
                    <p
                      style={{
                        fontFamily: 'var(--landing-font-display)',
                        fontWeight: 400,
                        fontSize: 'var(--landing-text-h3)',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        color: 'var(--landing-muted)',
                        margin: 0,
                      }}
                    >
                      {card.label}
                    </p>
                  )}
                </div>
              </AnimatedContent>
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
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--landing-space-4)' }}>
            <AnimatedContent direction="horizontal" reverse blur={0} distance={70} duration={1}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <PinIcon strokeWidth={2.1} style={{ width: 28, height: 28, color: 'var(--landing-primary)', marginBottom: '0.5rem' }} />
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
            </AnimatedContent>

            <AnimatedContent direction="horizontal" reverse blur={0} distance={70} duration={1} delay={600}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                <CalendarIcon strokeWidth={2.1} style={{ width: 28, height: 28, color: 'var(--landing-primary)', marginBottom: '0.5rem' }} />
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
            </AnimatedContent>
          </div>

          <AnimatedContent
            direction="horizontal"
            reverse
            blur={0}
            distance={70}
            duration={1}
            delay={1200}
            style={{ height: '100%' }}
          >
            <div
              style={{
                position: 'relative',
                height: '100%',
                borderRadius: 'var(--landing-radius-lg)',
                overflow: 'hidden',
                minHeight: 260,
                border: '1px solid var(--landing-border)',
              }}
            >
              <iframe
                title={practicalInfo.location.label}
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3342.386674268928!2d-64.33297619999999!3d-33.0989168!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95cdff187b8186d3%3A0xa202a5b355b57213!2sSilicer!5e0!3m2!1ses-419!2sar!4v1786472329935!5m2!1ses-419!2sar"
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: 260, display: 'block' }}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <a
                href={MAP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir ${practicalInfo.location.label} en Google Maps`}
                style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
              />
            </div>
          </AnimatedContent>
        </div>
      </div>

      <style>{`
        .landing-practical-title {
          font-family: var(--landing-font-display);
          font-weight: 400;
          font-size: var(--landing-text-h2);
          line-height: var(--landing-leading-heading);
          color: var(--landing-ink);
          margin: 0 0 var(--landing-space-5);
        }
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
