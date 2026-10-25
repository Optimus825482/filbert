import { requirePagePermission } from "@/lib/rbac/guard";

export default async function AramaLayout({ children }: { children: React.ReactNode }) {
  await requirePagePermission("DASHBOARD", "GORUNTULE");
  return children;
}
