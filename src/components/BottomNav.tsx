import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Mic, ClipboardCheck, LineChart } from "lucide-react";
import { SkipLink } from "@/components/SkipLink";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/practice", label: "Practice", icon: Mic },
  { to: "/mock", label: "Mock", icon: ClipboardCheck },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

function isNavActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            aria-current={isNavActive(pathname, to) ? "page" : undefined}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 py-3 text-xs font-medium"
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background pb-24 font-sans text-foreground antialiased">
      <SkipLink />
      <main id="main" className={`mx-auto w-full px-5 pt-8 ${wide ? "max-w-4xl" : "max-w-md"}`}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
