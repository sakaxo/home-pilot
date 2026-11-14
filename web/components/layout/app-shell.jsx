"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";

function AppShell({ children }) {
  return (
    <SidebarProvider className="bg-app">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-brand px-3 py-2 text-sm font-medium text-white outline-none focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-app">
        <Topbar />
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export { AppShell };
