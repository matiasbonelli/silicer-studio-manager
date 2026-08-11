import { landingContent } from '@/content/landing';
import { ImagePendingIcon } from './icons';

/**
 * Grilla tipo mosaicist (recuadros foto+texto). Sin fotos reales todavía:
 * la estructura queda lista y el espacio se reserva con recuadros propios,
 * nunca con stock de relleno (docs/03: "mejor mostrar menos que mostrar
 * algo genérico").
 */
export default function Students() {
  const { students } = landingContent;
  const hasRealItems = students.items.length > 0;
  const placeholderCount = students.minItemsReserved;

  return (
    <section style={{ backgroundColor: 'var(--landing-bg-alt)', paddingBlock: 'var(--landing-space-7)' }}>
      <div className="landing-container">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: 'var(--landing-space-3)',
            marginBottom: 'var(--landing-space-2)',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--landing-font-body)',
              fontWeight: 700,
              fontSize: 'var(--landing-text-small)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--landing-primary)',
              margin: 0,
            }}
          >
            {students.eyebrow}
          </p>
          {students.pendingAsset && (
            <span
              style={{
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 700,
                fontSize: 'var(--landing-text-small)',
                color: 'var(--landing-primary)',
                border: '1px solid var(--landing-primary)',
                borderRadius: 'var(--landing-radius-sm)',
                padding: '0.15rem 0.55rem',
              }}
            >
              Próximamente
            </span>
          )}
        </div>

        <h2
          style={{
            fontFamily: 'var(--landing-font-display)',
            fontWeight: 400,
            fontSize: 'var(--landing-text-h2)',
            lineHeight: 'var(--landing-leading-heading)',
            color: 'var(--landing-ink)',
            margin: '0 0 var(--landing-space-1)',
          }}
        >
          {students.title}
        </h2>
        <p
          style={{
            fontFamily: 'var(--landing-font-body)',
            fontWeight: 300,
            fontSize: 'var(--landing-text-body-lg)',
            color: 'var(--landing-muted)',
            margin: '0 0 var(--landing-space-5)',
            maxWidth: '50ch',
          }}
        >
          {students.subtitle}
        </p>

        {hasRealItems ? (
          <div className="landing-students-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--landing-space-3)' }}>
            {students.items.map((item) => (
              <img
                key={item.src}
                src={item.src}
                alt={item.alt}
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 'var(--landing-radius-lg)' }}
              />
            ))}
          </div>
        ) : (
          <div className="landing-students-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--landing-space-3)' }}>
            {Array.from({ length: placeholderCount }).map((_, i) => (
              <div
                key={i}
                className="landing-student-slot"
                style={{
                  gridColumn: i % 5 === 0 ? 'span 2' : 'span 1',
                  aspectRatio: i % 5 === 0 ? '2.2 / 1' : '1 / 1',
                  borderRadius: 'var(--landing-radius-lg)',
                  backgroundColor: 'var(--landing-surface)',
                  border: '1px solid var(--landing-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ImagePendingIcon style={{ width: 28, height: 28, color: 'var(--landing-border)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 780px) {
          .landing-students-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .landing-student-slot {
            grid-column: span 1 !important;
            aspect-ratio: 1 / 1 !important;
          }
        }
      `}</style>
    </section>
  );
}
