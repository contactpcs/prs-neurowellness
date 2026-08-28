import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Matches the Anava Clinical UI design system's components/patterns/
 * PageShell.jsx exactly — breadcrumb + h1 title on the left, optional
 * actions on the right, optional search/filters row below. Every role
 * page's own top-level content should open with this instead of an
 * ad-hoc heading, so page headers read the same everywhere. */
export function PageShell({
  title,
  breadcrumb = [],
  root,
  actions,
  search,
  onSearch,
  filters,
  children,
}: {
  title: string;
  breadcrumb?: string[];
  root: string;
  actions?: React.ReactNode;
  search?: string;
  onSearch?: (value: string) => void;
  filters?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const crumbs = [root, ...breadcrumb];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <nav className="flex items-center gap-1.5 mb-1.5">
            {crumbs.map((c, i) => (
              <span key={c} className="flex items-center gap-1.5">
                <span className={cn("text-xs", i === crumbs.length - 1 ? "text-neutral-700 font-medium" : "text-neutral-400")}>
                  {c}
                </span>
                {i < crumbs.length - 1 && <span className="text-xs text-neutral-300">/</span>}
              </span>
            ))}
          </nav>
          <h1 className="text-2xl font-bold text-neutral-900 m-0">{title}</h1>
        </div>
        {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
      </div>

      {(search !== undefined || filters) && (
        <div className="flex gap-3 items-center flex-wrap">
          {search !== undefined && (
            <div className="relative flex-[0_1_320px] min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder="Search…"
                className="w-full h-[38px] pl-8 pr-3 rounded-lg border border-neutral-200 bg-white text-[13px] outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 transition-colors"
              />
            </div>
          )}
          {filters}
        </div>
      )}

      {children}
    </div>
  );
}
