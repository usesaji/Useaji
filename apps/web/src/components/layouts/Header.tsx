"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CiSearch } from "react-icons/ci";
import { InputField } from "@repo/ui/input-field";
import { Avatar } from "@repo/ui/avatar";
import { NotificationBell } from "@/components/layouts/NotificationBell";
import { useAccount } from "@/features/auth/hooks";
import { initials } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { useNow } from "@/lib/use-now";

function greeting(now: number) {
	const h = new Date(now).getHours();
	if (h < 12) return "Good Morning";
	if (h < 17) return "Good Afternoon";
	return "Good Evening";
}

/** Greeting, search (groups), the bell and the avatar. */
export function Header() {
	const { data: account } = useAccount();
	const router = useRouter();
	const now = useNow(60_000);
	const [query, setQuery] = useState("");
	const firstName = account?.profile?.firstName;
	const name = account?.profile ? `${account.profile.firstName} ${account.profile.lastName}` : null;

	const onSearch = (event: React.FormEvent) => {
		event.preventDefault();
		const q = query.trim();
		if (q) router.push(pageRoutes.dashboardRoutes.SEARCH(q));
	};

	return (
		<header className="z-1001 bg-white max-lg:fixed max-lg:inset-x-0 max-lg:top-0">
			<div className="dashboard-custom-container flex items-center justify-between gap-10 py-6 lg:py-10">
				<div className="flex items-center gap-7.5 lg:w-full">
					<div className="flex max-lg:flex-col lg:gap-2">
						<span className="text-base whitespace-nowrap max-lg:font-medium md:text-xl">{firstName ? `Yo ${firstName}!` : "Welcome!"}</span>{" "}
						<span className="whitespace-nowrap max-md:-mt-0.5 max-sm:text-[10px] max-lg:text-sm lg:text-xl">{now ? greeting(now) : ""}</span>
					</div>
					<form onSubmit={onSearch} className="relative w-full max-w-120 min-w-100 max-md:hidden" role="search">
						<CiSearch className="absolute top-3 left-4 z-10 text-2xl text-neutral-light-active md:top-3.5" />
						<InputField
							name="search"
							aria-label="Search groups"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							className="w-full bg-neutral-comment pl-12"
							placeholder="Search groups.."
						/>
					</form>
				</div>
				<div className="flex items-center gap-3.5">
					<NotificationBell />
					<Link href={pageRoutes.dashboardRoutes.ME} aria-label="Your profile" className="rounded-full">
						<Avatar src={account?.avatarUrl} initials={initials(name)} label={name ?? undefined} className="h-10.75 w-10.75" textClassName="text-sm" />
					</Link>
				</div>
			</div>
		</header>
	);
}
