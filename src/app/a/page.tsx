import { randomUUID } from "crypto";
import AdminDashboard from "@/components/Admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default function AdminRoute() {
  const nonce = randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();

  return (
    <AdminDashboard
      sessionNonce={nonce}
    />
  );
}
