import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-white/5 rounded-full blur-2xl" />
        <div className="absolute top-1/3 left-1/4 w-48 h-48 bg-white/10 rounded-full blur-xl animate-pulse" />

        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">SaleAssist</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-6">
            Transform your store with{' '}
            <span className="text-white/90">Live Video Commerce</span>
          </h1>
          <p className="text-lg text-white/70 leading-relaxed mb-10 max-w-md">
            Engage customers with 1:1 video calls, live streams, shoppable videos,
            and AI-powered chat — all from one powerful dashboard.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8">
            <div>
              <div className="text-3xl font-bold">3.5x</div>
              <div className="text-sm text-white/60 mt-1">Higher conversion</div>
            </div>
            <div>
              <div className="text-3xl font-bold">89%</div>
              <div className="text-sm text-white/60 mt-1">Customer satisfaction</div>
            </div>
            <div>
              <div className="text-3xl font-bold">40%</div>
              <div className="text-sm text-white/60 mt-1">Avg. AOV increase</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
