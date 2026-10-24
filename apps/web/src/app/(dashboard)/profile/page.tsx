"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { HiChevronRight, HiOutlineArrowRightOnRectangle, HiOutlineDocumentText, HiOutlineShieldCheck, HiOutlineUser, HiOutlineWallet } from "react-icons/hi2";
import { ImageUpload } from "@/components/ImageUpload";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { useRemoveAvatar, useUploadAvatar } from "@/features/account/hooks";
import { useAccount, useLogout } from "@/features/auth/hooks";
import { initials, labelize, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";
import { shortAddress } from "@/lib/stellar/config";

const MENU = [
	{ label: "Personal Info", description: "Name, tag, date of birth and address", href: pageRoutes.dashboardRoutes.PROFILE_PERSONAL_INFO, Icon: HiOutlineUser },
	{ label: "Password & Security", description: "Password and login lockout", href: pageRoutes.dashboardRoutes.PROFILE_SECURITY, Icon: HiOutlineShieldCheck },
	{ label: "Payout Addresses", description: "Where your payouts are sent", href: pageRoutes.dashboardRoutes.WITHDRAW_INFO, Icon: HiOutlineWallet },
	{ label: "Generate Statement", description: "Download your transaction history", href: pageRoutes.dashboardRoutes.PROFILE_STATEMENT, Icon: HiOutlineDocumentText },
];

/** My Account (`GET /users/me`). */
export default function ProfilePage() {
	const { data, isLoading, error, refetch } = useAccount();
	const upload = useUploadAvatar();
	const remove = useRemoveAvatar();
	const logout = useLogout();

	if (!data) {
		return (
			<div className="w-full space-y-6">
				<PageHeader title="My Account" />
				<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} skeletonClassName="h-56 bg-primary-light" />
			</div>
		);
	}

	const p = data.profile;
	const name = p ? `${p.firstName} ${p.lastName}` : data.email;
	const details = [
		{ label: "Email", value: data.email },
		{ label: "Date of Birth", value: p?.dateOfBirth ? longDate(`${p.dateOfBirth}T12:00:00Z`) : "Not set" },
		{ label: "Gender", value: p?.gender ? labelize(p.gender) : "Not set" },
		{ label: "Address", value: p?.address ?? "Not set" },
		{ label: "Sign-in", value: data.signInMethods.length > 1 ? "Google & password" : data.signInMethods[0] === "google" ? "Google" : "Email & password" },
		{ label: "Member since", value: longDate(data.createdAt) },
	];

	return (
		<div className="w-full space-y-6 pb-10 md:space-y-8">
			<PageHeader title="My Account" />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
				<div className="space-y-4">
					<section className="relative overflow-hidden rounded-[20px] bg-primary px-6 py-7 text-white md:px-8">
						<img src="/images/wallet-vector.svg" alt="" aria-hidden className="pointer-events-none absolute -right-6 -bottom-6 opacity-70" />
						<div className="relative flex items-center gap-4">
							<ImageUpload
								variant="avatar"
								src={data.avatarUrl}
								placeholder={<span className="flex h-full w-full items-center justify-center bg-white text-xl font-medium text-primary">{initials(name)}</span>}
								alt={name}
								onUpload={(file) => upload.mutateAsync(file)}
							/>
							<div className="min-w-0">
								<p className="truncate text-xl md:text-2xl">{name}</p>
								{p?.tag && <p className="text-sm text-white/80">@{p.tag}</p>}
								{data.avatarUrl && (
									<button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="mt-1 text-xs text-white/80 underline">
										Remove picture
									</button>
								)}
							</div>
						</div>
						<div className="relative mt-6 flex flex-wrap items-center gap-2 text-xs">
							{data.wallet ? (
								<span className="rounded-full bg-primary-dark px-3 py-1.5">Wallet linked · {shortAddress(data.wallet.publicKey)}</span>
							) : (
								<Link href={pageRoutes.dashboardRoutes.WALLET} className="rounded-full bg-white px-3 py-1.5 text-primary">
									Link a wallet
								</Link>
							)}
						</div>
					</section>
					<section className="rounded-[20px] bg-panel px-6 py-2">
						{details.map((row) => (
							<div key={row.label} className="flex items-start justify-between gap-4 border-b border-neutral-light py-3.5 last:border-0">
								<span className="text-sm font-light">{row.label}</span>
								<span className="text-right text-sm break-all">{row.value}</span>
							</div>
						))}
					</section>
				</div>
				<section className="space-y-3">
					{MENU.map(({ label, description, href, Icon }) => (
						<Link key={href} href={href} className="flex items-center gap-4 rounded-[20px] bg-panel px-5 py-4 transition hover:bg-[#f2f2f2] md:px-6 md:py-5">
							<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-xl text-primary">
								<Icon />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block text-sm md:text-base">{label}</span>
								<span className="block truncate text-xs font-light">{description}</span>
							</span>
							<HiChevronRight className="shrink-0 text-xl text-neutral-900" />
						</Link>
					))}
					<button type="button" onClick={logout} className="flex w-full items-center gap-4 rounded-[20px] bg-panel px-5 py-4 text-left transition hover:bg-accent-light md:px-6 md:py-5">
						<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-light text-xl text-accent">
							<HiOutlineArrowRightOnRectangle />
						</span>
						<span className="flex-1 text-sm text-accent md:text-base">Log Out</span>
					</button>
				</section>
			</div>
		</div>
	);
}
