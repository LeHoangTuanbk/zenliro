import { cn } from '@/shared/lib/utils';

// ── BrButton ──────────────────────────────────────────────────────────────────
// Shared dark-theme button for Bright Room UI.
// variant: ghost (border/muted), primary (accent), success (green)
// size:    xs (panel labels), sm (dialog footer), md (toolbar)

type BrButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'primary' | 'success';
  size?: 'xs' | 'sm' | 'md';
};

const base =
  'inline-flex items-center justify-center font-sans cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default';

const variants = {
  ghost:
    'bg-transparent border border-br-elevated text-br-muted hover:text-br-text hover:border-br-mark',
  primary:
    'bg-br-accent-dark text-white border border-br-accent hover:bg-br-accent',
  success:
    'bg-br-green-bg text-br-green border border-br-green-border hover:bg-br-green-hover',
};

const sizes = {
  xs: 'rounded-[2px] px-2 py-0.5 text-[10px]',
  sm: 'rounded-[3px] px-3 text-[11px] h-6',
  md: 'rounded-[3px] px-3 py-1.5 text-[11px]',
};

export function BrButton({
  variant = 'ghost',
  size = 'xs',
  className,
  ...props
}: BrButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

// ── BrIconButton ──────────────────────────────────────────────────────────────
// Stateful icon button (rotate, flip, lock icons). active prop toggles accent bg.
// size: sm=w-7 h-7, md=w-8 h-8

type BrIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: 'sm' | 'md';
};

const iconBase =
  'flex items-center justify-center rounded-[2px] border cursor-pointer transition-colors';

const iconSizes = { sm: 'w-7 h-7', md: 'w-8 h-8' };

export function BrIconButton({
  active = false,
  size = 'md',
  className,
  ...props
}: BrIconButtonProps) {
  return (
    <button
      className={cn(
        iconBase,
        iconSizes[size],
        active
          ? 'bg-br-accent-dark text-white border-br-accent'
          : 'bg-transparent text-br-muted border-br-elevated hover:text-br-text hover:border-br-mark',
        className,
      )}
      {...props}
    />
  );
}
