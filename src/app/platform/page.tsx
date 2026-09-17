import { getCurrentOturum } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FirmaForm } from "./firma-form";
export default async function PlatformPage(){const y=(await getCurrentOturum())?.sistemYoneticisi;if(!y?.aktif)redirect("/giris");return <main className="mx-auto min-h-screen max-w-2xl p-6"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kurulum · 1/3</p><h1 className="mt-1 text-3xl font-extrabold">Platform yönetimi</h1><p className="mt-2 text-sm text-muted-foreground">{y.ad} · Yeni firma ve firma sahibi oluşturun.</p><FirmaForm/></main>;}
