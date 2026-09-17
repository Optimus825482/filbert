import { ShieldX } from "lucide-react";
import { OturumKapatButonu } from "@/components/oturum-kapat-butonu";

export default function YetkisizPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#071126] p-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-amber-300/30 bg-[#0a1830] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300"><ShieldX /></div>
        <h1 className="mt-5 text-2xl font-extrabold">Bu ekrana erişim yetkiniz yok</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-sky-100">İşlem için gerekli modül veya alt işlem izni hesabınıza tanımlı değil. Firma yöneticinizden yetki talep edebilirsiniz.</p>
        <div className="mt-7 flex justify-center"><OturumKapatButonu /></div>
      </section>
    </main>
  );
}
