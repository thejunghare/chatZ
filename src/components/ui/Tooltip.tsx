import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export function Tooltip({ content, children, side = 'top', className, delay = 0.2 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const animationVariants = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
  };

  return (
    <div 
      className={clsx("relative inline-block", className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={animationVariants}
            transition={{ duration: 0.15, delay }}
            className={clsx(
              "absolute z-50 px-2 py-1 text-[10px] font-medium text-white bg-gray-900 dark:bg-gray-700 rounded shadow-sm whitespace-nowrap pointer-events-none",
              positionClasses[side]
            )}
            role="tooltip"
          >
            {content}
            {/* Arrow */}
            <div 
              className={clsx(
                "absolute w-1.5 h-1.5 bg-gray-900 dark:bg-gray-700 rotate-45",
                side === 'top' && "bottom-[-3px] left-1/2 -translate-x-1/2",
                side === 'bottom' && "top-[-3px] left-1/2 -translate-x-1/2",
                side === 'left' && "right-[-3px] top-1/2 -translate-y-1/2",
                side === 'right' && "left-[-3px] top-1/2 -translate-y-1/2",
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
