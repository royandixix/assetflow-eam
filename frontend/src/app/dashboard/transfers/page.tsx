import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import TransferManager from "@/components/page/transfers/TransferManager";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const user = await requireIdentity();

  if (
    user.role_code !== "SUPER_ADMIN" &&
    user.role_code !== "ASSET_ADMIN"
  ) {
    redirect("/unauthorized");
  }

  return <TransferManager />;
}
