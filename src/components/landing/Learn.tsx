import { landingContent } from '@/content/landing';
import { learnIcons } from './icons';
import SplitText from './SplitText';
import AnimatedContent from './AnimatedContent';

export default function Learn() {
  const { learn } = landingContent;

  return (
    <section style={{ backgroundColor: 'var(--landing-bg)', paddingTop: 'var(--landing-space-7)', paddingBottom: 'var(--landing-space-5)' }}>
      <div className="landing-container">
        <div style={{ marginBottom: 'var(--landing-space-5)' }}>
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
              {learn.eyebrow}
            </p>
          </AnimatedContent>
          <SplitText
            tag="h2"
            className="landing-learn-title"
            text={learn.title}
            splitType="words"
            textAlign="left"
            delay={90}
            duration={1.2}
            ease="power2.out"
            from={{ opacity: 0, y: 20 }}
            to={{ opacity: 1, y: 0 }}
          />
        </div>

        <div
          className="landing-learn-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--landing-space-4)',
          }}
        >
          {learn.cards.map((card, i) => {
            const Icon = learnIcons[card.icon as keyof typeof learnIcons];
            const isIllustration = card.icon === 'hands' || card.icon === 'mate';
            return (
              <AnimatedContent
                key={card.title}
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
                    backgroundColor: 'var(--landing-surface)',
                    border: '1px solid var(--landing-border)',
                    borderRadius: 'var(--landing-radius-lg)',
                    padding: 'var(--landing-space-4)',
                  }}
                >
                  {isIllustration ? (
                    <Icon style={{ width: 44, height: 44, color: 'var(--landing-primary)' }} />
                  ) : (
                    <Icon strokeWidth={2.2} style={{ width: 40, height: 40, color: 'var(--landing-primary)' }} />
                  )}
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
              </AnimatedContent>
            );
          })}
        </div>
      </div>

      <style>{`
        .landing-learn-title {
          font-family: var(--landing-font-display);
          font-weight: 400;
          font-size: var(--landing-text-h2);
          line-height: var(--landing-leading-heading);
          color: var(--landing-ink);
          margin: 0;
          white-space: nowrap !important;
        }
        @media (max-width: 780px) {
          .landing-learn-grid {
            grid-template-columns: 1fr !important;
          }
          .landing-learn-title {
            white-space: normal !important;
          }
        }
      `}</style>
    </section>
  );
}
