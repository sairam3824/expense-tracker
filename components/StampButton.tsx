export default function StampButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add a new entry"
      className="safe-bottom fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-paper bg-stamp-red text-paper shadow-lg transition-transform active:scale-95"
    >
      <span className="-mt-0.5 font-display text-2xl leading-none">+</span>
    </button>
  );
}
