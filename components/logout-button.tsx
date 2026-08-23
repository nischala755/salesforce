"use client";
import { useRouter } from "next/navigation";
export function LogoutButton() { const router = useRouter(); return <button className="btn secondary small" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }}>Log out</button>; }
