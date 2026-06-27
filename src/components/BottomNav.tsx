import { Link } from "@tanstack/react-router";
import { Home, Mic, ClipboardCheck, LineChart } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/practice", label: "Practice", icon: Mic },
  { to: "/mock", label: "Mock", icon: ClipboardCheck },
  { to: "/progress", label: "Progress", icon: LineChart },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeProps={{ className: "text-primary" }}
            inactiveProps={{ className: "text-muted-foreground" }}
            className="flex flex-col items-center gap-1 py-3 text-xs font-medium"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 font-sans text-foreground antialiased">
      <div className="mx-auto w-full max-w-md px-5 pt-8">{children}</div>
      <BottomNav />
    </div>
  );
}