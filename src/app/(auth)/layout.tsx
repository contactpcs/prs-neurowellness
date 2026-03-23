import { Brain } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-gradient items-center justify-center p-12">
        <div className="text-center text-white">
          <Brain className="h-20 w-20 mx-auto mb-6 opacity-90" />
          <h1 className="text-4xl font-bold mb-3">NeuroWellness PRS</h1>
          <p className="text-lg opacity-80 max-w-md">
            Clinical assessment platform for comprehensive neurological and psychiatric patient evaluation
          </p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
