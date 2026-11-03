import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import DepartmentManager from "@/components/page/departments/DepartmentManager";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await requireIdentity();

  if (user.role_code !== "SUPER_ADMIN" && user.role_code !== "ASSET_ADMIN") {
    redirect("/unauthorized");
  }

  return <DepartmentManager />;
}
