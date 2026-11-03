import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import CategoryManager from "@/components/page/asset-categories/CategoryManager";

export const dynamic = "force-dynamic";

export default async function AssetCategoriesPage() {
  const user = await requireIdentity();

  if (
    user.role_code !== "SUPER_ADMIN" &&
    user.role_code !== "ASSET_ADMIN"
  ) {
    redirect("/unauthorized");
  }

  return <CategoryManager />;
}
