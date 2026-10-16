import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboard } from "./admin-dashboard";
import { hasAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Avanço do projeto",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function AdminPage() {
  if (!(await hasAdminSession())) {
    redirect("/admin/login");
  }

  return <AdminDashboard />;
}
