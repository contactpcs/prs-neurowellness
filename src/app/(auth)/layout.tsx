import { Brain, ShieldCheck, Activity, Users } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] bg-brand-gradient relative overflow-hidden flex-shrink-0">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-white/[0.03]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">Anava</p>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest leading-tight">PRS</p>
            </div>
          </div>

          {/* Headline + features */}
          <div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-4">
              Clinical assessment<br />made precise
            </h1>
            <p className="text-white/70 text-base leading-relaxed max-w-xs">
              A comprehensive platform for neurological and psychiatric patient rating — built for clinicians.
            </p>

            <ul className="mt-8 space-y-3">
              <li className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white/80 text-sm">Secure &amp; HIPAA-compliant data handling</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Activity className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white/80 text-sm">Multi-scale neurological assessments</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-white/80 text-sm">Collaborative care across clinical teams</span>
              </li>
            </ul>
          </div>

          {/* Footer */}
          <p className="text-white/40 text-xs">
            © {new Date().getFullYear()} Anava. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-accent-dark">Anava PRS</span>
          </div>

          <div className="bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
