import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/Header";
import { Toaster } from "sonner";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <div className="min-h-screen lg:pl-72">
        <Header />

        <main className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-400">
            {children}
          </div>
        </main>
      </div>

      <Toaster
        position="top-right"
        richColors
        closeButton
      />
    </div>
  );
}