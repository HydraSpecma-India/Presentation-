// Synced from webdev-coding-templates/brand/react/AppFooter.tsx. Make shared changes there, then run npm run generate.
/** Footer carrying the brand payoff, as every HydraSpecma footer does. */
export function AppFooter({ text = "Moving forward in power and motion" }: { text?: string }) {
  return (
    <footer className="border-t border-line mt-12 py-6 text-center text-xs font-medium uppercase tracking-[0.15em] text-ink">
      {text}
    </footer>
  );
}
