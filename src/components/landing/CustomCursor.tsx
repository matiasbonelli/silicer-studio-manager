import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * Reemplaza el cursor nativo por un círculo violeta que sigue al mouse con
 * un pequeño retraso (gsap.quickTo, más liviano que animar en cada frame a
 * mano). Se desactiva solo en dispositivos sin mouse fino (touch) — ahí el
 * cursor nativo no se oculta.
 */
export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const cursor = cursorRef.current;
    if (!hasFinePointer || !cursor) return;

    document.documentElement.classList.add('landing-cursor-active');

    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' });

    let hasMoved = false;

    const handleMove = (e: MouseEvent) => {
      if (!hasMoved) {
        gsap.set(cursor, { opacity: 1 });
        hasMoved = true;
      }
      xTo(e.clientX);
      yTo(e.clientY);

      const target = e.target as HTMLElement;
      const isInteractive = target.closest('a, button, [role="button"]');

      cursor.classList.toggle('landing-cursor--hover', !!isInteractive);
    };

    const handleLeave = () => gsap.set(cursor, { opacity: 0 });
    const handleEnter = () => {
      if (hasMoved) gsap.set(cursor, { opacity: 1 });
    };

    window.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);

    return () => {
      document.documentElement.classList.remove('landing-cursor-active');
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, []);

  return (
    <div ref={cursorRef} className="landing-cursor" aria-hidden="true">
      <div className="landing-cursor__dot" />
    </div>
  );
}
