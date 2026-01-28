import React from 'react';

export const Input = React.forwardRef(({ className = '', ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full px-4 py-2 rounded-sm outline-none ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';