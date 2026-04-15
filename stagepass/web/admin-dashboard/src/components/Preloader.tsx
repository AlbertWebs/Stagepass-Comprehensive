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
      className="flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950"
      style={fullScreen ? { minHeight: '100vh', width: '100%' } : { padding: '2rem' }}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        {/* Outer ring – light: gold + navy; dark: bright yellow + light blue */}
        <div
          className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-amber-600 border-r-[#1e2d5c] dark:border-t-amber-200 dark:border-r-sky-300"
          style={{ animation: 'preloader-spin 0.9s linear infinite' }}
        />
        {/* Inner mark – light: deeper gold + white S; dark: bright tile + navy S */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold bg-amber-700 text-white shadow-[0_4px_14px_rgba(161,98,7,0.45)] dark:bg-amber-200 dark:text-[#0f1838] dark:shadow-[0_4px_20px_rgba(253,224,71,0.35)]"
        >
          S
        </div>
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight text-slate-900 dark:text-amber-50">Stagepass</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-amber-200/85">{message}</p>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        <span
          className="h-2 w-2 rounded-full bg-amber-700 opacity-60 dark:bg-amber-200"
          style={{ animation: 'preloader-bounce 1.4s ease-in-out 0s infinite both' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-amber-700 opacity-60 dark:bg-amber-200"
          style={{ animation: 'preloader-bounce 1.4s ease-in-out 0.2s infinite both' }}
        />
        <span
          className="h-2 w-2 rounded-full bg-amber-700 opacity-60 dark:bg-amber-200"
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
