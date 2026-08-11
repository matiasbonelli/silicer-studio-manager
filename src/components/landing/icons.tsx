/**
 * Iconos propios de la landing — trazo a mano, un solo color (currentColor),
 * consistentes con el resto de la identidad. Nada de librerías de iconos
 * genéricas acá (brief: "iconos siempre en SVG", "nada de sistema por defecto").
 */
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 48 48',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function WheelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16 30 C16 20 18 12 24 12 C30 12 32 20 32 30 C32 32 28 33 24 33 C20 33 16 32 16 30 Z" />
      <path d="M24 33 L24 37" />
      <ellipse cx="24" cy="40" rx="15" ry="3.2" />
    </svg>
  );
}

export function InfinityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 24 C6 18 11 14 16 14 C22 14 24 20 24 24 C24 20 26 14 32 14 C37 14 42 18 42 24 C42 30 37 34 32 34 C26 34 24 28 24 24 C24 28 22 34 16 34 C11 34 6 30 6 24 Z" />
    </svg>
  );
}

export function MateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M16 20 C16 14 19 10 24 10 C29 10 32 14 32 20 L32 30 C32 34 28 37 24 37 C20 37 16 34 16 30 Z" />
      <ellipse cx="24" cy="20" rx="8" ry="2.4" />
      <path d="M25 18 L37 7" />
      <circle cx="37.5" cy="6.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ImagePendingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="17" cy="17" r="3.4" />
      <path d="M8 33 L18 22 L24 28 L32 18 L40 30" />
    </svg>
  );
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="24" cy="24" r="15" />
      <path d="M24 15 L24 24 L31 28" />
    </svg>
  );
}

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="17" r="6" />
      <path d="M6 37c0-7.5 5.5-12 12-12s12 4.5 12 12" />
      <circle cx="32" cy="19" r="4.5" />
      <path d="M28 25.5c1.5-.7 3-1 4-1 5 0 9 3.5 9 9.5" />
    </svg>
  );
}

export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M24 9 L27.5 20.5 L39 24 L27.5 27.5 L24 39 L20.5 27.5 L9 24 L20.5 20.5 Z" />
    </svg>
  );
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M24 8c7 0 12.5 5.6 12.5 12.5C36.5 29 24 41 24 41S11.5 29 11.5 20.5C11.5 13.6 17 8 24 8Z" />
      <circle cx="24" cy="20" r="4" />
    </svg>
  );
}

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="8" y="8" width="32" height="32" rx="10" />
      <circle cx="24" cy="24" r="8" />
      <circle cx="33" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const learnIcons = {
  wheel: WheelIcon,
  infinity: InfinityIcon,
  mate: MateIcon,
} as const;

export const practicalInfoIcons = {
  clock: ClockIcon,
  users: UsersIcon,
  sparkles: SparkleIcon,
} as const;
