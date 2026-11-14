"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS, isActivePath } from "@/lib/navigation";
import { formatRelativeTime } from "@/lib/format";
import { getDashboardStatus, SENSOR_STATUS_LABELS } from "@/lib/freshness";
import { useNow } from "@/hooks/use-now";
import { Icon } from "@/components/common/icon";
import { StatusBadge, StatusDot } from "@/components/common/status-badge";
import { useHomePilot } from "@/components/providers/homepilot-provider";
import { cn } from "cn";

function Brand({ onNavigate }) {
  return (
    <Link
      href="/sensors"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-lg p-2 outline-none group-data-[collapsible=icon]:justify-center focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-mint text-brand-dark">
        <Icon name="home" className="size-4" />
      </span>
      <span className="min-w-0 group-data-[collapsible=icon]:hidden">
        <span className="block truncate text-sm font-semibold tracking-tight text-white">HomePilot</span>
        <span className="block truncate text-[11px] text-sidebar-foreground/60">Smart room monitoring</span>
      </span>
    </Link>
  );
}

function NavItem({ item, active, onNavigate }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className="relative font-medium"
        >
          {active ? (
            <span
              className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-mint"
              aria-hidden="true"
            />
          ) : null}
          <Icon name={item.icon} className="size-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const STATUS_TONES = {
  live: "mint",
  stale: "warning",
  "no-data": "neutral",
  "connection-error": "danger",
};

function DataSourceStatus() {
  const { sensors, sensorsStatus, sensorsError } = useHomePilot();
  const now = useNow();

  const lastReading =
    Object.values(sensors)
      .map((sensor) => sensor?.timestamp)
      .filter(Boolean)
      .sort()
      .pop() || null;

  const dashboardStatus =
    sensorsStatus === "loading"
      ? "loading"
      : getDashboardStatus(sensors, now, Boolean(sensorsError));

  const tone = dashboardStatus === "loading" ? "neutral" : STATUS_TONES[dashboardStatus];
  const label =
    dashboardStatus === "loading" ? "Connecting" : SENSOR_STATUS_LABELS[dashboardStatus];

  return (
    <div className="rounded-lg border border-sidebar-border bg-white/5 p-2.5">
      <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
        <span className="text-[11px] font-medium tracking-wide text-sidebar-foreground/60 uppercase">
          Data source
        </span>
        <StatusBadge tone={tone} dot>
          {label}
        </StatusBadge>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
        {sensorsError
          ? "Connection lost. Showing the last successful readings."
          : lastReading
            ? `Last reading ${formatRelativeTime(lastReading, now)}.`
            : "No sensor readings received yet."}
      </p>
      <div className="hidden justify-center group-data-[collapsible=icon]:flex">
        <StatusDot tone={tone} />
      </div>
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Brand onNavigate={closeMobile} />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, index) => (
          <SidebarGroup key={group.title} className={cn(index > 0 && "pt-0")}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    item={item}
                    active={isActivePath(pathname, item.href)}
                    onNavigate={closeMobile}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <DataSourceStatus />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
