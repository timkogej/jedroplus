'use client';

import * as React from 'react';
import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CaretDown, Check } from '@phosphor-icons/react';

// Context for managing select state
interface SelectContextValue {
  value: string;
  setValue: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  highlightedIndex: number;
  setHighlightedIndex: (index: number) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('Select components must be used within a Select provider');
  }
  return context;
}

// Types
interface SelectProps {
  value: string;
  setValue: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface SelectOptionProps {
  value: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  description?: string;
  /** CSS gradient string or hex color for the color dot */
  colorDot?: string;
  /** If true, option text is rendered in gray (still selectable) */
  dimmed?: boolean;
}

// Helper to get background style for color dots (handles gradients and hex colors)
function getColorDotBackground(color: string): string {
  // If it's already a gradient CSS string, use it directly
  if (color.includes('gradient') || color.includes('linear') || color.includes('radial')) {
    return color;
  }
  // If it's a hex color, create a subtle gradient from it
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 100;
    const g = parseInt(hex.substring(2, 4), 16) || 100;
    const b = parseInt(hex.substring(4, 6), 16) || 240;
    const lighterR = Math.min(255, r + 30);
    const lighterG = Math.min(255, g + 30);
    const lighterB = Math.min(255, b + 30);
    return `linear-gradient(135deg, rgb(${lighterR}, ${lighterG}, ${lighterB}) 0%, ${color} 100%)`;
  }
  // Fallback to solid color
  return color;
}

// Animation variants
const dropdownVariants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: {
      duration: 0.15,
    },
  },
};

const optionVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      type: 'spring' as const,
      stiffness: 500,
      damping: 30,
    },
  }),
};

// Main Select component
export function Select({
  value,
  setValue,
  placeholder = 'Select an option',
  children,
  className = '',
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const selectRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Get all option values for keyboard navigation
  const options = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<SelectOptionProps> =>
      React.isValidElement(child) && child.type === SelectOption
  );

  // Find selected option to display
  const selectedOption = options.find((opt) => opt.props.value === value);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
          event.preventDefault();
          setIsOpen(true);
          setHighlightedIndex(0);
        }
        return;
      }

      switch (event.key) {
        case 'Escape':
          setIsOpen(false);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % options.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            setValue(options[highlightedIndex].props.value);
            setIsOpen(false);
          }
          break;
      }
    }

    if (selectRef.current) {
      selectRef.current.addEventListener('keydown', handleKeyDown);
      return () => selectRef.current?.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, highlightedIndex, options, setValue]);

  return (
    <SelectContext.Provider
      value={{ value, setValue, isOpen, setIsOpen, highlightedIndex, setHighlightedIndex }}
    >
      <div ref={selectRef} className={`relative ${className}`}>
        {/* Trigger button */}
        <motion.button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-2.5
                     text-left text-sm transition-all
                     ${isOpen
                       ? 'border-[#1A1F36]/30 ring-2 ring-[#1A1F36]/10 bg-white'
                       : 'border-gray-200 bg-white hover:border-gray-300'
                     }
                     ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                     focus:outline-none focus:ring-2 focus:ring-[#1A1F36]/20`}
          whileTap={{ scale: disabled ? 1 : 0.99 }}
        >
          <span className={`flex items-center gap-2 ${!selectedOption && !value ? 'text-gray-400' : 'text-[#1A1F36]'}`}>
            {selectedOption ? (
              <>
                {selectedOption.props.colorDot && (
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ background: getColorDotBackground(selectedOption.props.colorDot) }}
                  />
                )}
                {selectedOption.props.icon}
                {selectedOption.props.children}
              </>
            ) : value ? (
              value
            ) : (
              placeholder
            )}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown className="h-4 w-4 text-gray-400" weight="bold" />
          </motion.span>
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="dropdown"
              ref={optionsRef}
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-100
                         bg-white shadow-lg shadow-gray-200/50"
            >
              <div className="max-h-60 overflow-y-auto p-1.5">
                {React.Children.map(children, (child, index) => {
                  if (React.isValidElement(child) && child.type === SelectOption) {
                    return React.cloneElement(child, { _index: index } as any);
                  }
                  return child;
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </SelectContext.Provider>
  );
}

// SelectOption component
export function SelectOption({
  value: optionValue,
  children,
  icon,
  description,
  colorDot,
  dimmed = false,
  _index = 0,
}: SelectOptionProps & { _index?: number }) {
  const { value, setValue, setIsOpen, highlightedIndex, setHighlightedIndex } = useSelectContext();
  const isSelected = value === optionValue;
  const isHighlighted = highlightedIndex === _index;

  return (
    <motion.button
      type="button"
      variants={optionVariants}
      initial="hidden"
      animate="visible"
      custom={_index}
      onClick={() => {
        setValue(optionValue);
        setIsOpen(false);
      }}
      onMouseEnter={() => setHighlightedIndex(_index)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm
                 transition-colors
                 ${isHighlighted ? 'bg-[#1A1F36]/5' : ''}
                 ${isSelected ? 'bg-[#1A1F36]/10' : ''}
                 hover:bg-[#1A1F36]/5`}
    >
      {/* Color dot with gradient support */}
      {colorDot && (
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm"
          style={{ background: getColorDotBackground(colorDot) }}
        />
      )}

      {/* Icon */}
      {icon && <span className="flex-shrink-0 text-gray-500">{icon}</span>}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${dimmed ? 'text-gray-400' : isSelected ? 'text-[#1A1F36]' : 'text-gray-700'}`}>
          {children}
        </div>
        {description && (
          <div className="text-xs text-gray-400 truncate">{description}</div>
        )}
      </div>

      {/* Check mark */}
      {isSelected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex-shrink-0"
        >
          <Check className="h-4 w-4 text-[#1A1F36]" weight="bold" />
        </motion.span>
      )}
    </motion.button>
  );
}

// Export default for convenience
export default Select;
