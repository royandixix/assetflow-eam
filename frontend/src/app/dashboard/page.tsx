
import { requireIdentity } from "@/lib/auth/get-identity";
import KitloongDashboard from "@/components/page/dashboard/KitloongDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireIdentity();

  return <KitloongDashboard />;
}
