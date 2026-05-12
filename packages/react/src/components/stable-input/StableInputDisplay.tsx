import { type RefObject, type CSSProperties } from 'react';

export interface StableInputDisplayProps {
  containerRef: RefObject<HTMLDivElement | null>;
  className?: string;
  style?: CSSProperties;
}

export function StableInputDisplay({ containerRef, className, style }: StableInputDisplayProps) {
  return <div ref={containerRef as RefObject<HTMLDivElement>} className={className} style={style} />;
}
