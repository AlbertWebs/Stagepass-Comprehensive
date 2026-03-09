import { useEffect, useState } from 'react';
import { Preloader } from '@/components/Preloader';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/SectionCard';

type Props = { title: string; subtitle?: string };

export default function Placeholder({ title, subtitle }: Props) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <Preloader message={`Loading ${title}…`} fullScreen />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle ?? `Manage ${title.toLowerCase()}. This section is coming soon.`} />
      <SectionCard sectionLabel={title}>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-12 text-center">
          <p className="text-lg font-medium text-slate-800">{title}</p>
          <p className="mt-2 text-sm text-slate-500">This page is not implemented yet.</p>
        </div>
      </SectionCard>
    </div>
  );
}
