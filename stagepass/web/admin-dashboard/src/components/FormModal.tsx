type FormModalProps = {
  /** When false, modal is not rendered (closed) */
  open?: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  /** When false, content area does not scroll (use for compact forms that fit in viewport) */
  scrollable?: boolean;
};

export function FormModal({
  open = true,
  title,
  onClose,
  children,
  wide = true,
  scrollable = true,
}: FormModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        <div className="form-card-header flex flex-shrink-0 items-center justify-between">
          <h2 id="form-modal-title" className="text-lg font-semibold text-brand-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={scrollable ? 'min-h-0 flex-1 overflow-y-auto' : 'flex-1 overflow-hidden'}>{children}</div>
      </div>
    </div>
  );
}
