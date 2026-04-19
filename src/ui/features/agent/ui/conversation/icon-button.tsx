type IconButtonProps = {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
};

export function IconButton({ title, onClick, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center text-[#666] hover:text-white hover:bg-white/5 rounded transition-colors"
      title={title}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        {children}
      </svg>
    </button>
  );
}
