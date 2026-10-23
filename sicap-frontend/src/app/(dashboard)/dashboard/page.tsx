import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "DRIVER", "CLIENT"].includes(session.user.role)) {
    redirect("/login");
  }
  return <LiveDashboard role={session.user.role} userId={session.user.id}
    name={session.user.name ?? ""} email={session.user.email ?? ""} />;
}
