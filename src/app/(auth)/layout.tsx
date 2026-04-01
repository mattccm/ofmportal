import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-white p-1.5">
              <Image
                src="/ccm-logo.png"
                alt="CCM"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold text-white">CCM</span>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              Creator
              <br />
              <span className="bg-gradient-to-r from-primary via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Content Portal
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-md">
              Securely upload and manage your content. Built by CCM for our creators.
            </p>

            {/* Features */}
            <div className="grid gap-4 pt-4">
              {[
                "Fast & secure uploads",
                "Track request progress",
                "Direct communication with your team",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-gradient-to-r from-primary to-violet-500" />
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="space-y-2">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} Content Creation Management Pty Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
            <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-white dark:bg-slate-800 p-2 shadow-lg">
              <Image
                src="/ccm-logo.png"
                alt="CCM"
                fill
                className="object-contain dark:invert"
              />
            </div>
            <span className="text-xl font-bold text-foreground">CCM</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
