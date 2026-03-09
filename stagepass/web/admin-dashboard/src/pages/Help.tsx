import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { api } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';

const DEFAULT_GUIDES = ['mobile-user-guide', 'web-admin-guide'];

const BRAND = {
  navBg: '#172455',
  navActive: 'rgba(255,255,255,0.95)',
  navInactive: 'rgba(255,255,255,0.7)',
};

export default function Help() {
  const [loading, setLoading] = useState(true);
  const [guides, setGuides] = useState<{ id: string; title: string; content: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchGuides = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const listRes = await api.docs.listGuides();
      const guideList = listRes.guides;
      const ids = guideList && guideList.length > 0 ? guideList.map((g) => g.id) : DEFAULT_GUIDES;
      const loaded = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await api.docs.getGuide(id);
            return { id: res.id, title: res.title, content: res.content };
          } catch {
            return { id, title: id.replace(/-/g, ' '), content: '*Failed to load this guide.*' };
          }
        })
      );
      setGuides(loaded);
      setActiveId((prev) => {
        const shouldReset = loaded.length > 0 && (!prev || !loaded.some((g) => g.id === prev));
        return shouldReset ? loaded[0].id : prev;
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to load documentation.';
      const isParserError = /Unparenthesized|is not supported|Use either/.test(raw);
      setError(isParserError ? 'Failed to load documentation. Try again or check the docs API.' : raw);
      setGuides([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchGuides();
  }, [fetchGuides]);

  if (loading && guides.length === 0) {
    return <Preloader message="Loading documentation…" fullScreen />;
  }

  const activeGuide = guides.find((g) => g.id === activeId) || null;

  return (
    <div className="min-h-0">
      <PageHeader
        title="Help & Documentation"
        subtitle="Guides for the Stagepass mobile app and web admin. When we change a feature, we update these guides."
      />

      {error && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchGuides(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 font-medium text-red-800 hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      )}

      {guides.length > 0 && (
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* Sidebar: guide list */}
          <aside
            className="flex-shrink-0 lg:w-56 lg:sticky lg:top-6 lg:self-start"
            aria-label="Guide navigation"
          >
            <div
              className="rounded-xl border border-slate-200/90 bg-white shadow-sm"
              style={{ borderLeft: '4px solid ' + BRAND.navBg }}
            >
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Guides
                </h2>
              </div>
              <nav className="p-2">
                {guides.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveId(g.id)}
                    className="mb-0.5 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition"
                    style={{
                      backgroundColor: activeId === g.id ? 'rgba(23,36,85,0.08)' : 'transparent',
                      color: activeId === g.id ? BRAND.navBg : undefined,
                    }}
                  >
                    {g.title}
                  </button>
                ))}
              </nav>
              <div className="border-t border-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => fetchGuides(true)}
                  disabled={refreshing}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
                >
                  {refreshing ? 'Refreshing…' : 'Refresh guides'}
                </button>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">
            <article className="rounded-xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {activeGuide ? activeGuide.title : 'Guide'}
                </h2>
              </div>
              <div className="help-prose scrollbar-thin overflow-y-auto max-h-[calc(100vh-16rem)] min-h-[320px] px-6 py-6">
                {activeGuide && (
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="help-h1 border-b border-slate-200 pb-2 text-xl font-bold text-slate-900">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="help-h2 mt-8 mb-3 text-lg font-semibold text-slate-900">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="help-h3 mt-6 mb-2 text-base font-semibold text-slate-800">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="help-p my-3 text-slate-700 leading-relaxed">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="help-ul my-3 list-disc space-y-1 pl-6 text-slate-700">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="help-ol my-3 list-decimal space-y-1 pl-6 text-slate-700">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-900">{children}</strong>
                      ),
                      hr: () => <hr className="my-8 border-slate-200" />,
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          target={href?.startsWith('http') ? '_blank' : undefined}
                          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="text-[#172455] underline hover:text-[#2f4178]"
                        >
                          {children}
                        </a>
                      ),
                      code: ({ className, children, ...rest }) => {
                        const content = typeof children === 'string' ? children : String(children ?? '');
                        const isBlock = className?.includes('language-') || content.includes('\n');
                        if (isBlock) {
                          return (
                            <pre className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                              <code className="text-slate-800" {...rest}>
                                {children}
                              </code>
                            </pre>
                          );
                        }
                        return (
                          <code
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-medium text-slate-800"
                            {...rest}
                          >
                            {children}
                          </code>
                        );
                      },
                      blockquote: ({ children }) => (
                        <blockquote className="my-4 border-l-4 border-amber-200 bg-amber-50/50 pl-4 py-2 text-slate-700 italic">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {activeGuide.content}
                  </ReactMarkdown>
                )}
              </div>
            </article>

            {/* Tip */}
            <div
              className="mt-6 rounded-xl border px-5 py-4 text-sm"
              style={{
                borderColor: 'rgb(251 191 36 / 0.5)',
                backgroundColor: 'rgb(254 252 232 / 0.8)',
                color: 'rgb(120 53 15)',
              }}
            >
              <p className="font-semibold">Keeping documentation up to date</p>
              <p className="mt-1 leading-relaxed">
                When you add or change a feature in the mobile app or web admin, update the relevant
                guide in the project (see <code className="rounded bg-amber-100 px-1 py-0.5">docs/guides/</code> and
                the README there). The Help page loads these guides from the server so users always
                see the latest version.
              </p>
            </div>
          </main>
        </div>
      )}

      {!loading && guides.length === 0 && !error && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-8 py-12 text-center shadow-sm">
          <p className="text-slate-600">No guides available.</p>
          <p className="mt-1 text-sm text-slate-500">
            Add markdown guides to the docs and ensure the API can serve them.
          </p>
          <button
            type="button"
            onClick={() => fetchGuides(true)}
            className="mt-4 text-sm font-medium text-[#172455] hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
