import { ActivityIcon, GroupsIcon, HomeIcon, MeIcon, WalletIcon } from "@/components/layouts/nav-icons";
import { pageRoutes } from "@/lib/routes";

export const navItems = [
	{ label: "Overview", href: pageRoutes.dashboardRoutes.OVERVIEW, Icon: HomeIcon },
	{ label: "Groups", href: pageRoutes.dashboardRoutes.GROUPS, Icon: GroupsIcon },
	{ label: "Activity", href: pageRoutes.dashboardRoutes.ACTIVITY, Icon: ActivityIcon },
	{ label: "Wallet", href: pageRoutes.dashboardRoutes.WALLET, Icon: WalletIcon },
	{ label: "My Account", href: pageRoutes.dashboardRoutes.ME, Icon: MeIcon },
];

/** Active when the path IS the item or is nested under it — matched on segments, not substrings. */
export const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
