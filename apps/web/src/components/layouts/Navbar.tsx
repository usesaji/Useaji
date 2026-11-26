"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiOutlinePlusSmall } from "react-icons/hi2";
import { Logo } from "@repo/ui/logo";
import { Avatar } from "@repo/ui/avatar";
import { LinkButton } from "@/components/LinkButton";
import { isNavActive, navItems } from "@/components/layouts/nav";
import { useAccount } from "@/features/auth/hooks";
import { initials } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** The sidebar on desktop, the tab bar on phones. */
export function Navbar() {
	const pathname = usePathname();
	const { data: account } = useAccount();
	const name = account?.profile ? `${account.profile.firstName} ${account.profile.lastName}` : null;

	return (
		<>
			<aside className="mt-10 h-screen bg-white pb-20 max-lg:hidden">
				<Link href={pageRoutes.dashboardRoutes.OVERVIEW} className="block px-7.5" aria-label="Saji">
					<Logo />
				</Link>
				<div className="flex h-full flex-col justify-between border-r border-r-neutral-light-hover">
					<nav className="mt-15 pl-7.5" aria-label="Main">
						<ul className="flex flex-col justify-between gap-10 bg-white">
							{navItems.map((item) => {
								const { href, label, Icon } = item;
								const active = isNavActive(pathname, item);
								return (
									<li key={href}>
										<Link href={href} className="flex items-center" aria-current={active ? "page" : undefined}>
											<div className={`mr-4 h-[28.2px] w-1.25 rounded-[21.1px] xl:mr-5.5 ${active ? "bg-primary" : "bg-white"}`} />
											<div className="scale-[0.9]">
												<Icon active={active} />
											</div>
											<span className={`ml-5 text-lg transition hover:text-neutral-dark xl:ml-7 xl:text-xl ${active ? "text-neutral-dark" : "text-neutral-light-hover"}`}>
												{label}
											</span>
										</Link>
									</li>
								);
							})}
						</ul>
					</nav>

					<div className="flex flex-col items-center gap-6.5 px-7.5 pb-10">
						<Link href={pageRoutes.dashboardRoutes.ME} className="flex w-full items-center gap-[8.3px] rounded-[8.5px] bg-panel px-3.5 py-[8.5px]">
							<Avatar src={account?.avatarUrl} initials={initials(name)} label={name ?? undefined} className="h-12.75 w-12.75" textClassName="text-base" />
							<div className="min-w-0">
								<h4 className="truncate font-medium">{name ?? "—"}</h4>
								<p className="-mt-0.5 text-xs text-ink-muted">View Profile</p>
							</div>
						</Link>
						<LinkButton href={pageRoutes.dashboardRoutes.NEW_GROUP} className="flex w-full gap-3">
							<span>Create Group</span>
							<HiOutlinePlusSmall className="scale-[1.8]" />
						</LinkButton>
					</div>
				</div>
			</aside>

			<aside className="fixed inset-x-0 bottom-0 z-50 bg-white lg:hidden">
				<nav className="custom-container py-3.5 sm:py-5" aria-label="Main">
					<ul className="flex items-center justify-between">
						{navItems.map((item) => {
							const { href, label, Icon } = item;
							const active = isNavActive(pathname, item);
							return (
								<li key={href}>
									<Link href={href} className="flex items-center space-y-1 max-lg:flex-col" aria-current={active ? "page" : undefined}>
										<Icon active={active} />
										<span className={`text-[10px] font-medium transition-colors sm:text-xs ${active ? "text-primary" : "text-neutral-light-hover"}`}>{label}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>
			</aside>
		</>
	);
}
