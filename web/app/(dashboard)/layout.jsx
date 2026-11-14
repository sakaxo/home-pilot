import { HomePilotProvider } from "@/components/providers/homepilot-provider";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: {
    default: "HomePilot",
    template: "%s · HomePilot",
  },
  description: "HomePilot smart room monitoring and automation dashboard.",
};

export default function DashboardLayout({ children }) {
  return (
    <HomePilotProvider>
      <AppShell>{children}</AppShell>
    </HomePilotProvider>
  );
}
