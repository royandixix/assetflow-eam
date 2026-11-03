import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import AssignmentManager from "@/components/page/assignments/AssignmentManager";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const user = await requireIdentity();

  if (
    user.role_code !== "SUPER_ADMIN" &&
    user.role_code !== "ASSET_ADMIN"
  ) {
    redirect("/unauthorized");
  }

  return <AssignmentManager />;
}
