import { ActivityIcon, GroupsIcon, HomeIcon, MeIcon, WalletIcon } from "@/components/layouts/nav-icons";
import { pageRoutes } from "@/lib/routes";

export const navItems = [
	{ label: "Overview", href: pageRoutes.dashboardRoutes.OVERVIEW, Icon: HomeIcon },
	{ label: "Groups", href: pageRoutes.dashboardRoutes.GROUPS, Icon: GroupsIcon },
	{ label: "Activity", href: pageRoutes.dashboardRoutes.ACTIVITY, Icon: ActivityIcon },
	// Personal savings lives under Wallet in the designs.
	{ label: "Wallet", href: pageRoutes.dashboardRoutes.WALLET, Icon: WalletIcon, also: [pageRoutes.dashboardRoutes.SAVINGS] },
	{ label: "My Account", href: pageRoutes.dashboardRoutes.ME, Icon: MeIcon },
];

/** Active when the path IS the item or is nested under it — matched on segments, not substrings. */
export const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** The item's own path, or one of the sections it also covers (`also`). */
export const isNavActive = (pathname: string, item: { href: string; also?: string[] }) =>
	[item.href, ...(item.also ?? [])].some((href) => isActivePath(pathname, href));
