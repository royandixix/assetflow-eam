import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth/get-identity";
import LocationManager from "@/components/page/locations/LocationManager";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const user = await requireIdentity();

  if (user.role_code !== "SUPER_ADMIN" && user.role_code !== "ASSET_ADMIN") {
    redirect("/unauthorized");
  }

  return <LocationManager />;
}
