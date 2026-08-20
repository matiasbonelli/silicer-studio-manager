import { useEffect, useRef } from 'react';

interface NoiseProps {
  /** Opacidad (0-255) de cada píxel de grano. */
  patternAlpha?: number;
}

/**
 * Overlay de grano estático fijo sobre toda la página, adaptado de
 * reactbits.dev/animations/noise (ahí es animado; acá se dibuja una sola
 * vez para que no titile). pointer-events: none para no interferir con
 * clicks; z-index por encima del header pero por debajo del cursor custom
 * (9999) y los modales.
 */
export default function Noise({ patternAlpha = 5 }: NoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const canvasSize = 1024;

    const drawGrain = () => {
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';

      const imageData = ctx.createImageData(canvasSize, canvasSize);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() * 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = patternAlpha;
      }

      ctx.putImageData(imageData, 0, 0);
    };

    drawGrain();
    window.addEventListener('resize', drawGrain);
    return () => window.removeEventListener('resize', drawGrain);
  }, [patternAlpha]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9998,
        imageRendering: 'pixelated',
      }}
    />
  );
}
