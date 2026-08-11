import { landingContent } from '@/content/landing';
import { learnIcons } from './icons';

export default function Learn() {
  const { learn } = landingContent;

  return (
    <section style={{ backgroundColor: 'var(--landing-bg)', paddingBlock: 'var(--landing-space-7)' }}>
      <div className="landing-container">
        <div style={{ maxWidth: '46ch', marginBottom: 'var(--landing-space-5)' }}>
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
            {learn.eyebrow}
          </p>
          <h2
            style={{
              fontFamily: 'var(--landing-font-display)',
              fontWeight: 400,
              fontSize: 'var(--landing-text-h2)',
              lineHeight: 'var(--landing-leading-heading)',
              color: 'var(--landing-ink)',
              margin: 0,
            }}
          >
            {learn.title}
          </h2>
        </div>

        <div
          className="landing-learn-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--landing-space-4)',
          }}
        >
          {learn.cards.map((card) => {
            const Icon = learnIcons[card.icon as keyof typeof learnIcons];
            return (
              <div
                key={card.title}
                style={{
                  backgroundColor: 'var(--landing-surface)',
                  border: '1px solid var(--landing-border)',
                  borderRadius: 'var(--landing-radius-lg)',
                  padding: 'var(--landing-space-4)',
                }}
              >
                <Icon style={{ width: 40, height: 40, color: 'var(--landing-primary)' }} />
                <h3
                  style={{
                    fontFamily: 'var(--landing-font-display)',
                    fontWeight: 400,
                    fontSize: 'var(--landing-text-h3)',
                    color: 'var(--landing-ink)',
                    margin: 'var(--landing-space-3) 0 var(--landing-space-1)',
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--landing-font-body)',
                    fontWeight: 300,
                    fontSize: 'var(--landing-text-body)',
                    lineHeight: 'var(--landing-leading-body)',
                    color: 'var(--landing-muted)',
                    margin: 0,
                  }}
                >
                  {card.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @media (max-width: 780px) {
          .landing-learn-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
