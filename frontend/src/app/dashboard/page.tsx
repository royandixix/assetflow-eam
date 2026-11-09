import { requireIdentity } from "@/lib/auth/get-identity";
import KitloongDashboard from "@/components/page/dashboard/KitloongDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireIdentity();

  return <KitloongDashboard roleCode={user.role_code} />;
}
