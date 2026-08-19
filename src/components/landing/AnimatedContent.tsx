import React, { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export interface AnimatedContentProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Distancia en px desde la que entra el contenido. */
  distance?: number;
  direction?: 'vertical' | 'horizontal';
  reverse?: boolean;
  duration?: number;
  ease?: string;
  /** Delay en ms antes de iniciar la animación. */
  delay?: number;
  /** Blur inicial en px (0 lo desactiva). */
  blur?: number;
  /** Porcentaje del viewport que dispara la animación (0-1). */
  threshold?: number;
  as?: React.ElementType;
}

/**
 * Envoltorio de animación de scroll-reveal (entra desde abajo + blur),
 * inspirado en reactbits.dev/animations/animated-content. Pensado para
 * texto de cuerpo y elementos interactivos, no para titulares (que usan
 * SplitText).
 */
const AnimatedContent: React.FC<AnimatedContentProps> = ({
  children,
  className = '',
  style,
  distance = 18,
  direction = 'vertical',
  reverse = false,
  duration = 1.4,
  ease = 'power2.out',
  delay = 0,
  blur = 5,
  threshold = 0.1,
  as = 'div',
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;

      const axis = direction === 'horizontal' ? 'x' : 'y';
      const offset = reverse ? -distance : distance;
      const startPct = (1 - threshold) * 100;

      gsap.fromTo(
        ref.current,
        {
          opacity: 0,
          [axis]: offset,
          filter: blur ? `blur(${blur}px)` : undefined,
        },
        {
          opacity: 1,
          [axis]: 0,
          filter: blur ? 'blur(0px)' : undefined,
          duration,
          ease,
          delay: delay / 1000,
          scrollTrigger: {
            trigger: ref.current,
            start: `top ${startPct}%`,
            once: true,
          },
          willChange: 'transform, opacity, filter',
          force3D: true,
        }
      );
    },
    {
      scope: ref,
      dependencies: [distance, direction, reverse, duration, ease, delay, blur, threshold],
    }
  );

  const Tag = as as React.ElementType;

  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
};

export default AnimatedContent;
