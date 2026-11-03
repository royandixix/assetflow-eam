import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import AssetManager from "@/components/page/assets/AssetManager";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const user = await requireIdentity();

  if (user.role_code !== "SUPER_ADMIN" && user.role_code !== "ASSET_ADMIN") {
    redirect("/unauthorized");
  }

  return <AssetManager />;
}
