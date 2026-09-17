import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SetupForm } from "./setup-form";
import { setupYetkisiVar } from "@/lib/auth";

export default async function SetupPage() {
  if (await prisma.uygulamaKurulumu.findUnique({ where: { id: "global" } }) || !(await setupYetkisiVar())) redirect("/giris");
  return <main className="mx-auto min-h-screen max-w-md p-6 pt-16"><h1 className="text-3xl font-extrabold">Sistem kurulumu</h1><p className="mt-3 text-sm text-muted-foreground">Sistem yöneticisi doğrulandı. Kurulumu tamamlamak için ana kurulum parolasını girin; firma ve firma sahibi sonraki ekranda tanımlanır.</p><SetupForm /></main>;
}
