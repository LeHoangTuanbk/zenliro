import { cn } from '@/shared/lib/utils';

type ModuleTabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

const base =
  'px-2 mx-1 h-9 text-[11px] font-medium tracking-wide cursor-pointer transition-colors border-none';

export function ModuleTab({ active = false, className, ...props }: ModuleTabProps) {
  return (
    <button
      className={cn(
        base,
        active
          ? 'text-br-text bg-br-bg'
          : 'text-br-muted bg-transparent hover:text-br-text-hover',
        className,
      )}
      {...props}
    />
  );
}
