"use client";

import React from "react";
import DashboardNavbar from "@/app/components/navbar/DashboardNavbar";

export default function SalesApprovalPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
      <DashboardNavbar />
      <br />
      <div className="container mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#891F1A] mb-1">Design Approval Center</h1>
          <p className="text-gray-600">Review and approve designs submitted by designers</p>
        </div>
        
        <div className="text-center py-20">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">Coming Soon</h3>
          <p className="text-gray-600 text-lg">This page is under construction.</p>
        </div>
      </div>
    </div>
  );
}