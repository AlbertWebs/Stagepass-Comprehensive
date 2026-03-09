import React from 'react';

type PreloaderProps = {
  /** Optional message below the logo */
  message?: string;
  /** Full screen (default) or inline */
  fullScreen?: boolean;
};

export function Preloader({ message = 'Loading…', fullScreen = true }: PreloaderProps) {
  const content = (
    <div
      className="flex flex-col items-center justify-center gap-6 bg-slate-50"
      style={fullScreen ? { minHeight: '100vh', width: '100%' } : { padding: '2rem' }}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-2xl border-2 border-transparent"
          style={{
            borderTopColor: '#ca8a04',
            borderRightColor: '#1e2d5c',
            animation: 'preloader-spin 0.9s linear infinite',
          }}
        />
        {/* Inner logo */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
          style={{ backgroundColor: '#ca8a04', boxShadow: '0 4px 14px rgba(202, 138, 4, 0.35)' }}
        >
          S
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight text-slate-800">Stagepass</p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
      {/* Dots */}
      <div className="flex gap-1.5" aria-hidden>
        <span
          className="h-2 w-2 rounded-full bg-brand-accent opacity-60"
          style={{ animation: 'preloader-bounce 1.4s ease-in-out 0s infinite both' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-brand-accent opacity-60"
          style={{ animation: 'preloader-bounce 1.4s ease-in-out 0.2s infinite both' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-brand-accent opacity-60"
          style={{ animation: 'preloader-bounce 1.4s ease-in-out 0.4s infinite both' }}
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" role="status" aria-live="polite">
        {content}
      </div>
    );
  }

  return content;
}
