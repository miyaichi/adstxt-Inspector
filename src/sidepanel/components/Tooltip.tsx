import React, { useEffect, useRef, useState } from 'react';

interface TooltipProps {
  /** The content to be displayed inside the tooltip */
  content: string;
  /** The children elements that will trigger the tooltip on hover */
  children: React.ReactNode;
}

/**
 * Tooltip component that displays a tooltip with the given content when the user hovers over the children elements
 * @param content - The content to be displayed inside the tooltip
 * @param children - The children elements that will trigger the tooltip on hover
 * @returns A React element representing the tooltip
 */
export const Tooltip = ({ content, children }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      if (tooltipRef.current && targetRef.current) {
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const targetRect = targetRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        // Calc position
        let left = targetRect.left;
        let top = targetRect.bottom + 5;

        // Check and adjust position
        if (left + tooltipRect.width > viewportWidth - 10) {
          left = viewportWidth - tooltipRect.width - 10;
        }
        if (left < 10) {
          left = 10;
        }

        tooltipRef.current.style.left = `${left}px`;
        tooltipRef.current.style.top = `${top}px`;
      }
    };

    if (isVisible) {
      updatePosition();
      // Add event listener to update position on window resize
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isVisible]);

  return (
    <div
      ref={targetRef}
      className="tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div ref={tooltipRef} className="tooltip">
          {content}
        </div>
      )}
    </div>
  );
};
