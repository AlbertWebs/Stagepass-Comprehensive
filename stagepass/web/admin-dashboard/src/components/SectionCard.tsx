type SectionCardProps = {
  /** Optional label above the card (e.g. "Team members", "Events") */
  sectionLabel?: string;
  children: React.ReactNode;
  className?: string;
};

export function SectionCard({ sectionLabel, children, className = '' }: SectionCardProps) {
  return (
    <section className={className}>
      {sectionLabel && (
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-accent">
          {sectionLabel}
        </h2>
      )}
      <div className="card-elegant overflow-hidden">
        {children}
      </div>
    </section>
  );
}
