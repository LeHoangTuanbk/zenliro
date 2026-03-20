export function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-br-bg gap-4">
      <span className="text-2xl font-bold text-br-text tracking-wide">Zenliro</span>
      <div className="w-5 h-5 border-2 border-br-dim border-t-br-text rounded-full animate-spin" />
      <span className="text-[11px] text-br-dim">Loading catalog...</span>
    </div>
  );
}
