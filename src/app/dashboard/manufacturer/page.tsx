"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { requireRole } from "@/utils/requireRole";

export default function ManufacturerDashboard() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const res = await requireRole("manufacturer");
      if (res?.redirect) router.push(res.redirect);
    };
    check();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-3xl font-bold">
      Manufacturer Dashboard 🏭
    </div>
  );
}