import Link from "next/link";
import { requirePageSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const settings = await prisma.organizationSettings.findUnique({ where: { id: "default" } }).catch(() => null);
  return <div className="shell">
    <header className="topbar"><Link className="brand" href="/dashboard">ComplyLens</Link><nav className="nav" aria-label="Primary"><Link href="/dashboard">Overview</Link><Link href="/contacts">Contacts</Link><Link href="/breach">Breach tracker</Link><Link href="/rights-requests">Rights requests</Link><Link href="/timeline">Timeline</Link><Link href="/dpo">DPO view</Link></nav><span className="user">{session.name} · {session.role}</span><LogoutButton /></header>
    {settings?.sdfMode && <aside className="sdf"><strong>▲ SDF mode</strong><span className="obligation-chip">DPO</span><span className="obligation-chip">DPIA & audits</span><span className="obligation-chip">Prescribed measures</span><span className="legal-chip" title="SDF classification depends on government notification.">ⓘ Operational flag—not legal classification</span></aside>}
    {children}
  </div>;
}
