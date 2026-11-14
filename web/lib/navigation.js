export const NAV_ITEMS = [
  {
    href: "/sensors",
    label: "Sensors",
    title: "Sensors",
    icon: "gauge",
    group: "Monitoring",
  },
  {
    href: "/controls",
    label: "Device Control",
    title: "Device Control",
    icon: "sliders-horizontal",
    group: "Monitoring",
  },
];

const GROUP_ORDER = ["Monitoring"];

export const NAV_GROUPS = GROUP_ORDER.map((title) => ({
  title,
  items: NAV_ITEMS.filter((item) => item.group === title),
})).filter((group) => group.items.length > 0);

export function isActivePath(pathname, href) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageMeta(pathname) {
  if (!pathname) return NAV_ITEMS[0];
  const exact = NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = NAV_ITEMS.find((item) => pathname.startsWith(`${item.href}/`));
  return nested || NAV_ITEMS[0];
}
