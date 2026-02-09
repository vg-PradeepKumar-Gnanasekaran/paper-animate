'use client';

import dynamic from 'next/dynamic';

const AppContent = dynamic(() => import('@/components/AppContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading PaperAnimate...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return <AppContent />;
}
