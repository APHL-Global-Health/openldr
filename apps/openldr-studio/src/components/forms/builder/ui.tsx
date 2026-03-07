import React from 'react';

// ------------------------------------------------------------------
// Input
// ------------------------------------------------------------------
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}
export const Input: React.FC<InputProps> = ({ label, className = '', ...rest }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">{label}</span>}
    <input
      {...rest}
      className={`w-full bg-[#0F1E2E] border border-[#2A3F57] text-[#E2EAF4] rounded-lg px-3 py-2 text-sm placeholder:text-[#3A5068] focus:border-[#6EE7B7] focus:ring-1 focus:ring-[#6EE7B7]/30 transition-colors ${className}`}
    />
  </div>
);

// ------------------------------------------------------------------
// Textarea
// ------------------------------------------------------------------
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}
export const Textarea: React.FC<TextareaProps> = ({ label, className = '', ...rest }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">{label}</span>}
    <textarea
      {...rest}
      className={`w-full bg-[#0F1E2E] border border-[#2A3F57] text-[#E2EAF4] rounded-lg px-3 py-2 text-sm placeholder:text-[#3A5068] focus:border-[#6EE7B7] focus:ring-1 focus:ring-[#6EE7B7]/30 transition-colors resize-y ${className}`}
    />
  </div>
);

// ------------------------------------------------------------------
// Select
// ------------------------------------------------------------------
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...rest }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <span className="text-[10px] font-bold uppercase tracking-widest text-[#607A94]">{label}</span>}
    <select
      {...rest}
      className={`w-full bg-[#0F1E2E] border border-[#2A3F57] text-[#E2EAF4] rounded-lg px-3 py-2 text-sm focus:border-[#6EE7B7] focus:ring-1 focus:ring-[#6EE7B7]/30 transition-colors ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

// ------------------------------------------------------------------
// Toggle
// ------------------------------------------------------------------
interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
}
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-[#6EE7B7]' : 'bg-[#2A3F57]'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
    {label && <span className="text-sm text-[#A0B4C8]">{label}</span>}
  </div>
);

// ------------------------------------------------------------------
// IconButton
// ------------------------------------------------------------------
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'danger' | 'accent';
}
export const IconButton: React.FC<IconButtonProps> = ({ variant = 'ghost', className = '', children, ...rest }) => {
  const variantClass = {
    ghost: 'text-[#4A6480] hover:text-[#E2EAF4] hover:bg-white/5',
    danger: 'text-[#4A6480] hover:text-[#F87171] hover:bg-red-500/10',
    accent: 'text-[#4A6480] hover:text-[#6EE7B7] hover:bg-[#6EE7B7]/10',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
};

// ------------------------------------------------------------------
// Badge
// ------------------------------------------------------------------
export const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span
    className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold font-mono"
    style={{ background: color + '22', color }}
  >
    {children}
  </span>
);

// ------------------------------------------------------------------
// Button
// ------------------------------------------------------------------
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}
export const Button: React.FC<ButtonProps> = ({ variant = 'secondary', size = 'md', className = '', children, ...rest }) => {
  const v = {
    primary: 'bg-[#6EE7B7] text-[#0A1628] font-bold hover:bg-[#4ADE80] shadow-lg shadow-[#6EE7B7]/20',
    secondary: 'bg-[#1A2C40] border border-[#2A3F57] text-[#A0B4C8] hover:border-[#4A6480] hover:text-[#E2EAF4]',
    ghost: 'text-[#607A94] hover:text-[#E2EAF4] hover:bg-white/5',
    danger: 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20',
  }[variant];
  const s = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center gap-2 rounded-lg font-semibold transition-all cursor-pointer disabled:opacity-50 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  );
};
