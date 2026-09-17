import { requirePagePermission } from "@/lib/rbac/guard";

export default async function AramaLayout({ children }: LayoutProps<"/arama">) {
  await requirePagePermission("DASHBOARD", "GORUNTULE");
  return children;
}
