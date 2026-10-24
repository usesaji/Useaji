"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	HiOutlineArrowRightOnRectangle,
	HiOutlineHeart,
	HiOutlineQueueList,
	HiOutlineSquares2X2,
	HiOutlineUsers,
} from "react-icons/hi2";
import { Avatar } from "@repo/ui/avatar";
import { cn } from "@repo/ui/lib/utils";
import { Logo } from "@repo/ui/logo";
import { useMe, useSignOut } from "@/features/auth/hooks";
import { useHealth } from "@/features/admin/hooks";

const NAV = [
	{ label: "Overview", href: "/", Icon: HiOutlineSquares2X2 },
	{ label: "Users", href: "/users", Icon: HiOutlineUsers },
	{ label: "Audit log", href: "/audit", Icon: HiOutlineQueueList },
	{ label: "Health", href: "/health", Icon: HiOutlineHeart },
];

const isActive = (href: string, pathname: string) =>
	href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

/** The console frame: Saji's sidebar on desktop, a tab row on phones, and the signed-in admin. */
export function AdminShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { data: me } = useMe();
	const signOut = useSignOut();
	const health = useHealth();
	const healthy = health.data?.status === "ok";

	return (
		<div className="min-h-screen bg-white lg:flex">
			<aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-neutral-light-hover pt-10 pb-8 lg:flex">
				<Link href="/" className="flex items-center gap-2 px-7.5" aria-label="Saji admin">
					<Logo />
					<span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] text-primary">Admin</span>
				</Link>
				<nav aria-label="Console" className="mt-14 flex flex-col gap-8 pl-7.5">
					{NAV.map(({ label, href, Icon }) => {
						const active = isActive(href, pathname);
						return (
							<Link key={href} href={href} aria-current={active ? "page" : undefined} className="group flex items-center">
								<span
									className={cn(
										"mr-4 h-7 w-1.25 rounded-full transition-colors",
										active ? "bg-primary" : "bg-transparent group-hover:bg-primary-light",
									)}
								/>
								<Icon
									className={cn(
										"text-2xl transition-colors",
										active ? "text-primary" : "text-neutral-light-active group-hover:text-neutral",
									)}
								/>
								<span
									className={cn(
										"ml-4 text-lg transition-colors",
										active ? "text-neutral-dark" : "text-neutral-light-active group-hover:text-neutral-dark",
									)}
								>
									{label}
								</span>
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto space-y-3 px-6">
					<Link href="/health" className="flex items-center gap-2 rounded-xl bg-panel px-3.5 py-2.5 text-xs">
						<span className="relative flex size-2.5">
							{health.data && (
								<span
									className={cn(
										"absolute inline-flex size-full rounded-full",
										healthy ? "animate-ping-soft bg-success-300" : "bg-accent",
									)}
								/>
							)}
							<span
								className={cn(
									"relative inline-flex size-2.5 rounded-full",
									!health.data ? "bg-neutral-700" : healthy ? "bg-success-400" : "bg-accent",
								)}
							/>
						</span>
						{!health.data ? "Checking the API…" : healthy ? "API healthy" : "API degraded"}
					</Link>
					<div className="flex items-center gap-3 rounded-[8.5px] bg-panel px-3.5 py-2.5">
						<Avatar initials={(me?.email ?? "?").slice(0, 2).toUpperCase()} label={me?.email} className="size-10" />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium">{me?.email}</p>
							<p className="text-[11px] text-ink-muted">Administrator</p>
						</div>
						<button
							type="button"
							onClick={() => void signOut()}
							aria-label="Sign out"
							title="Sign out"
							className="text-xl text-ink-muted hover:text-accent"
						>
							<HiOutlineArrowRightOnRectangle />
						</button>
					</div>
				</div>
			</aside>

			<div className="min-w-0 flex-1">
				<header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-neutral-light bg-white/90 px-4 py-4 backdrop-blur lg:hidden">
					<Link href="/" className="flex items-center gap-2" aria-label="Saji admin">
						<Logo className="h-6" />
						<span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] text-primary">Admin</span>
					</Link>
					<button type="button" onClick={() => void signOut()} className="flex items-center gap-1 text-xs text-ink-muted">
						<HiOutlineArrowRightOnRectangle className="text-base" /> Sign out
					</button>
				</header>
				<nav aria-label="Console" className="hide-scroll flex gap-2 overflow-x-auto px-4 pt-4 lg:hidden">
					{NAV.map(({ label, href, Icon }) => (
						<Link
							key={href}
							href={href}
							className={cn(
								"flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:px-4 sm:text-sm",
								isActive(href, pathname) ? "bg-primary text-white" : "bg-neutral-comment",
							)}
						>
							<Icon className="max-sm:hidden" /> {label}
						</Link>
					))}
				</nav>
				<main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-12">
					{children}
				</main>
			</div>
		</div>
	);
}
