import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const settings = await prisma.organizationSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  return <div className="shell">
    <header className="topbar">
      <Link className="brand" href="/dashboard">ComplyLens</Link>
      <nav className="nav" aria-label="Primary">
        <Link href="/dashboard">Overview</Link>
        <Link href="/contacts">Investigate</Link>
        <Link href="/breach">Incidents</Link>
        <Link href="/dpo">Governance</Link>
      </nav>
      <span className="user">{session.name} · {session.role}</span>
      <LogoutButton />
    </header>
    {settings?.sdfMode && <aside className="sdf" title="An operational setting; legal SDF classification depends on government notification."><strong>SDF operational mode</strong><span>Enhanced review controls enabled</span></aside>}
    {children}
  </div>;
}
