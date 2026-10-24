"use client";

import Link from "next/link";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { IoEyeOffOutline, IoEyeOutline } from "react-icons/io5";
import { useOverview } from "@/features/groups/hooks";
import { Money } from "@/components/Money";
import { pageRoutes } from "@/lib/routes";

/**
 * The three headline tiles on the Groups page (`GET /groups/overview`): Total Saved, Total Pending,
 * Active Goals. Swipeable on mobile, a three-column row from md.
 */
export function GroupStats() {
	const { data, isLoading } = useOverview();
	const stats = [
		{
			title: "Total Saved",
			value: isLoading ? "…" : <Money amount={data?.totalSaved} asset={data?.asset} />,
			color: "bg-primary",
			plus: "bg-primary-dark",
			action: { href: pageRoutes.dashboardRoutes.WALLET, label: "Open your wallet" },
			hideable: true,
		},
		{
			title: "Total Pending",
			// Null until the API reads round dues from the chain.
			value: isLoading ? "…" : <Money amount={data?.totalPending} asset={data?.asset} />,
			color: "bg-accent",
			plus: "bg-accent-dark",
			action: { href: pageRoutes.dashboardRoutes.GROUPS, label: "See what's due" },
			hideable: true,
		},
		{
			title: "Active Goals",
			value: isLoading ? "…" : `${data?.activeGroups ?? 0} Group${data?.activeGroups === 1 ? "" : "s"}`,
			color: "bg-secondary-dark",
			plus: "bg-secondary-dark-active",
			action: { href: pageRoutes.dashboardRoutes.NEW_GROUP, label: "Create a group" },
			hideable: false,
		},
	];

	return (
		<section className="hide-scroll -mx-3 flex snap-x scroll-px-3 gap-3 overflow-x-auto px-3 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0">
			{stats.map((s, i) => (
				<StatsCard key={s.title} index={i} {...s} />
			))}
		</section>
	);
}

function StatsCard({
	title,
	value,
	color,
	plus,
	action,
	hideable,
	index,
}: {
	title: string;
	value: React.ReactNode;
	index: number;
	color: string;
	plus: string;
	action: { href: string; label: string };
	hideable: boolean;
}) {
	const [visible, setVisible] = useState(true);
	return (
		<div style={{ "--i": index } as React.CSSProperties} className={`${color} animate-rise relative w-[46%] min-w-40 shrink-0 snap-start rounded-[14px] px-4 py-4 text-white md:w-auto md:min-w-0 md:rounded-[10px] md:px-8 md:py-6`}>
			<Link
				href={action.href}
				aria-label={action.label}
				title={action.label}
				className={`${plus} absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-xs transition hover:scale-110 md:top-4 md:right-5`}
			>
				<FiPlus />
			</Link>
			<h5 className="pr-8 text-sm font-light md:text-lg">{title}</h5>
			<div className="mt-1 flex min-w-0 items-center gap-3">
				<p className="truncate text-2xl md:text-[28px] xl:text-[36px]">{hideable && !visible ? "••••••" : value}</p>
				{hideable && (
					<button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? `Hide ${title}` : `Show ${title}`} className="shrink-0 text-xl md:text-2xl">
						{visible ? <IoEyeOffOutline /> : <IoEyeOutline />}
					</button>
				)}
			</div>
		</div>
	);
}
