import type { ReactNode } from "react";
import { Link, Navigate, NavLink, useLocation } from "react-router";
import { useAuth } from "../context/auth";
import { config } from "../config";
import type { RentalStatus, Tool } from "../lib/types";
import { api } from "../lib/client";

// ---- Nav --------------------------------------------------------------------

export function Nav() {
  const { user, signOut } = useAuth();
  const links = "rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const idle = "text-stone-600 hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800";
  const active = "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-white";

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="mr-2 flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-base text-white shadow-sm">🔧</span>
          ToolShare
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={({ isActive }) => `${links} ${isActive ? active : idle}`}>
            Browse
          </NavLink>
          {user && (
            <>
              <NavLink to="/rentals" className={({ isActive }) => `${links} ${isActive ? active : idle}`}>
                My rentals
              </NavLink>
              <NavLink to="/my-tools" className={({ isActive }) => `${links} ${isActive ? active : idle}`}>
                My tools
              </NavLink>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {config.mock && (
            <span className="hidden rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 sm:inline dark:bg-violet-900/50 dark:text-violet-300">
              demo mode
            </span>
          )}
          {user ? (
            <>
              <Link
                to="/tools/new"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                List a tool
              </Link>
              <span className="hidden max-w-40 truncate text-sm text-stone-500 sm:inline dark:text-stone-400" title={user.email}>
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="rounded-md px-2.5 py-1.5 text-sm text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={`${links} ${idle}`}>
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// ---- Route guard --------------------------------------------------------------

export function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

// ---- Bits ----------------------------------------------------------------------

export function Money({ amount }: { amount: number }) {
  return <span>฿{amount.toLocaleString()}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-stone-500 dark:text-stone-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-amber-500" />
      {label ?? "Loading…"}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center dark:border-stone-700">
      <p className="text-lg font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const statusStyles: Record<RentalStatus, string> = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  reserved: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  returned: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

export function StatusBadge({ status }: { status: RentalStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

// ---- ToolCard --------------------------------------------------------------------

export function ToolCard({ tool, footer }: { tool: Tool; footer?: ReactNode }) {
  const img = api.imageUrl(tool);
  return (
    <div className="group overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900">
      <Link to={`/tools/${tool.toolId}`} className="block">
        <div className="aspect-[8/5] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
          {img ? (
            <img
              src={img}
              alt={tool.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-4xl text-stone-300 dark:text-stone-600">🔧</div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-tight">{tool.name}</h3>
            <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
              <Money amount={tool.costPerDay} />
              <span className="font-normal text-stone-400">/day</span>
            </span>
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-stone-400">{tool.type}</p>
        </div>
      </Link>
      {footer && <div className="border-t border-stone-100 p-3 dark:border-stone-800">{footer}</div>}
    </div>
  );
}
