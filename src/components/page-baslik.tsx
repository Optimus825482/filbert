import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageBaslik({ baslik, alt, geri = "/" }: { baslik: string; alt?: string; geri?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        href={geri}
        aria-label="Geri"
        className="saha-btn h-11 w-11 min-h-11 rounded-xl border border-slate-700 bg-slate-800 text-sky-100"
      >
        <ChevronLeft className="h-6 w-6" />
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-white">{baslik}</h1>
        {alt && <p className="text-sm text-sky-100">{alt}</p>}
      </div>
    </div>
  );
}
