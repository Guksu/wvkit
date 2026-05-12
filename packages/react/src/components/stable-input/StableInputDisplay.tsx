import { forwardRef, type RefObject, type CSSProperties } from 'react';

export interface StableInputDisplayProps {
  containerRef: RefObject<HTMLDivElement | null>;
  className?: string;
  style?: CSSProperties;
}

export function StableInputDisplay({ containerRef, className, style }: StableInputDisplayProps) {
  return <div ref={containerRef as RefObject<HTMLDivElement>} className={className} style={style} />;
}

// forwardRef export — ref를 직접 전달하는 패턴도 지원
export const StableInputDisplayForwardRef = forwardRef<HTMLDivElement, Omit<StableInputDisplayProps, 'containerRef'>>(
  function StableInputDisplayForwardRef({ className, style }, ref) {
    return <div ref={ref} className={className} style={style} />;
  },
);
