"use client";

import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import { IoIosArrowRoundForward } from "react-icons/io";
import { IoHelpCircle, IoNavigateCircle, IoWallet } from "react-icons/io5";
import { SectionHeader } from "@/components/SectionHeader";
import { ActivityCard } from "@/features/activity/components/ActivityCard";
import { useActivity } from "@/features/activity/hooks";
import { GroupCard, GroupRow } from "@/features/groups/components/GroupCards";
import type { GroupSummaryDto } from "@/lib/api/dto";
import { pageRoutes } from "@/lib/routes";
import { LANDING_URL } from "@/lib/site";

/** "My Active Groups" (desktop) / "Your Circles" (mobile): forming and running groups. */
export function MyActiveGroups({ groups, loading }: { groups: GroupSummaryDto[]; loading: boolean }) {
	return (
		<section>
			<SectionHeader
				title={
					<>
						<span className="md:hidden">Your Circles</span>
						<span className="max-md:hidden">My Active Groups{groups.length > 0 ? ` (${groups.length})` : ""}</span>
					</>
				}
				href={pageRoutes.dashboardRoutes.GROUPS}
			/>
			{loading ? (
				<div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:gap-4">
					{[0, 1].map((i) => (
						<div key={i} className="h-24 animate-pulse rounded-xl bg-panel md:h-80 md:rounded-[20px]" />
					))}
				</div>
			) : groups.length === 0 ? (
				<div className="mt-4 rounded-xl bg-panel px-5 py-6 text-sm md:mt-6 md:rounded-[20px]">
					<p>You&apos;re not in any active groups yet.</p>
					<Link href={pageRoutes.dashboardRoutes.NEW_GROUP} className="mt-2 inline-flex items-center text-primary">
						Start a group <IoIosArrowRoundForward className="text-xl" />
					</Link>
				</div>
			) : (
				<>
					<div className="mt-4 space-y-3 md:hidden">
						{groups.slice(0, 3).map((group, index) => (
							<GroupRow key={group.id} group={group} index={index} />
						))}
					</div>
					<div className="mt-6 grid grid-cols-2 gap-4 max-md:hidden">
						{groups.slice(0, 4).map((group) => (
							<GroupCard key={group.id} group={group} />
						))}
					</div>
				</>
			)}
		</section>
	);
}

/** The two latest activity rows; the rest is a tap away. */
export function RecentActivities() {
	const { data, isLoading } = useActivity({ limit: 2 });
	const rows = data?.results ?? [];
	return (
		<section>
			<SectionHeader title="Recent Activity" href={pageRoutes.dashboardRoutes.ACTIVITY} />
			{isLoading ? (
				<div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:gap-4">
					{[0, 1].map((i) => (
						<div key={i} className="h-32 animate-pulse rounded-xl bg-panel" />
					))}
				</div>
			) : rows.length === 0 ? (
				<p className="mt-4 text-sm text-neutral-900">No activity yet.</p>
			) : (
				<div className="mt-4 grid gap-3 md:mt-6 md:grid-cols-2 md:gap-4">
					{rows.map((row) => (
						<ActivityCard key={row.id} activity={row} />
					))}
				</div>
			)}
		</section>
	);
}

const TILES = [
	{ label: "Start New Group", icon: <FiPlus className="text-3xl" />, href: pageRoutes.dashboardRoutes.NEW_GROUP, external: false },
	{ label: "Browse Pool", icon: <IoNavigateCircle className="text-3xl" />, href: pageRoutes.dashboardRoutes.DISCOVER, external: false },
	{ label: "Savings History", icon: <IoWallet className="text-2xl" />, href: pageRoutes.dashboardRoutes.ACTIVITY, external: false },
	{ label: "How it works", icon: <IoHelpCircle className="text-3xl" />, href: LANDING_URL, external: true },
];

/** "Explore Communities" — quick action tiles at the bottom of the dashboard. */
export function ExploreCommunities() {
	const tile =
		"flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-neutral-light-active px-3 py-7 text-center transition-colors hover:border-primary hover:bg-primary-light/40 md:py-9";
	return (
		<section>
			<SectionHeader title="Explore Communities" />
			<div className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-4 md:gap-4">
				{TILES.map(({ label, icon, href, external }) => {
					const body = (
						<>
							<span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">{icon}</span>
							<span className="text-sm md:text-base">{label}</span>
						</>
					);
					return external ? (
						<a key={label} href={href} className={tile}>
							{body}
						</a>
					) : (
						<Link key={label} href={href} className={tile}>
							{body}
						</Link>
					);
				})}
			</div>
		</section>
	);
}
