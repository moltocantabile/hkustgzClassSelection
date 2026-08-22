/* ================= inline SVG icons (no external deps) ================= */
type IconProps = { size?: number; className?: string };

function svgProps(size: number, className?: string){
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    className: className || undefined
  } as const;
}

export function PlusIcon({ size = 14, className }: IconProps){
  return <svg {...svgProps(size, className)}><path d="M8 3v10M3 8h10" /></svg>;
}

export function TrashIcon({ size = 14, className }: IconProps){
  return (
    <svg {...svgProps(size, className)}>
      <path d="M2.5 4.5h11M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5" />
      <path d="M3.5 4.5l.55 8.1a1 1 0 0 0 1 .9h5.9a1 1 0 0 0 1-.9l.55-8.1" />
      <path d="M6.5 7.2v3.2M9.5 7.2v3.2" />
    </svg>
  );
}

export function CloseIcon({ size = 12, className }: IconProps){
  return <svg {...svgProps(size, className)}><path d="M4 4l8 8M12 4l-8 8" /></svg>;
}

export function DownloadIcon({ size = 15, className }: IconProps){
  return (
    <svg {...svgProps(size, className)}>
      <path d="M8 2.5v7M5.2 6.8L8 9.6l2.8-2.8" />
      <path d="M2.5 12.5h11" />
    </svg>
  );
}
