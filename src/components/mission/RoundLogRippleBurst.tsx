import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

interface RoundLogRippleBurstProps {
  pulseKey: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Concentric gradient ripples for a logged round. Rendered in a fixed portal
 * so they can expand past the live view's overflow containers instead of
 * getting clipped at the card edge.
 */
export function RoundLogRippleBurst({ pulseKey, buttonRef }: RoundLogRippleBurstProps) {
  const [origin, setOrigin] = useState<{ x: number; y: number; size: number } | null>(null);

  useLayoutEffect(() => {
    if (pulseKey <= 0) {
      return;
    }
    const el = buttonRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    setOrigin({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      size: Math.max(rect.width * 0.55, rect.height, 92),
    });
  }, [pulseKey, buttonRef]);

  if (pulseKey <= 0 || !origin || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <span
      key={pulseKey}
      aria-hidden="true"
      className="round-log-ripple"
      style={{
        left: origin.x,
        top: origin.y,
        width: origin.size,
        height: origin.size,
        marginLeft: -origin.size / 2,
        marginTop: -origin.size / 2,
      }}
    >
      <span className="round-log-ripple-wave" />
      <span className="round-log-ripple-wave" />
      <span className="round-log-ripple-wave" />
    </span>,
    document.body
  );
}
