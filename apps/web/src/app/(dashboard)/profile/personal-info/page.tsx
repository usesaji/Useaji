"use client";

import { useState } from "react";
import { HiOutlinePencil, HiOutlinePlus } from "react-icons/hi2";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@repo/ui/query-state";
import { EditFieldSheet, type EditingField } from "@/features/account/components/EditFieldSheet";
import { useAccount, useSaveProfile } from "@/features/account/hooks";
import { errorMessage } from "@/features/auth/hooks";
import type { ProfileDto, UpdateProfileDto } from "@/lib/api/dto";
import { labelize, longDate } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

type FieldKey = "firstName" | "lastName" | "tag" | "dateOfBirth" | "gender" | "address";

const GENDERS = [
	{ value: "female", label: "Female" },
	{ value: "male", label: "Male" },
	{ value: "other", label: "Other" },
	{ value: "prefer_not_to_say", label: "Prefer not to say" },
];

const FIELDS: Record<FieldKey, Omit<EditingField, "key" | "value"> & { required?: boolean }> = {
	firstName: { label: "First Name", inputType: "text", required: true },
	lastName: { label: "Last Name", inputType: "text", required: true },
	tag: { label: "Personal Tag", inputType: "text", required: true },
	dateOfBirth: { label: "Date of Birth", inputType: "date" },
	gender: { label: "Gender", inputType: "select", options: GENDERS },
	address: { label: "Address", inputType: "text" },
};

function display(key: FieldKey, p: ProfileDto): string | null {
	switch (key) {
		case "tag":
			return p.tag ? `@${p.tag}` : null;
		case "gender":
			return p.gender ? labelize(p.gender) : null;
		case "dateOfBirth":
			return p.dateOfBirth ? longDate(`${p.dateOfBirth}T12:00:00Z`) : null;
		default:
			return p[key] || null;
	}
}

/**
 * Personal Info: one row per field, each edited in its own sheet. `PUT /users/me/profile` replaces
 * every field (omitted optional ones are cleared), so each save sends the whole profile.
 */
export default function PersonalInfoPage() {
	const { data, isLoading, error, refetch } = useAccount();
	const save = useSaveProfile({ quiet: true });
	const [editing, setEditing] = useState<EditingField | null>(null);
	const p = data?.profile;

	const edit = (key: FieldKey) => p && setEditing({ key, ...FIELDS[key], value: String(p[key] ?? "") });

	const onSave = async (fieldKey: string, raw: string): Promise<string | null> => {
		if (!p) return "Your profile hasn't loaded.";
		const key = fieldKey as FieldKey;
		const value = key === "tag" ? raw.replace(/^@/, "").toLowerCase() : raw;
		if (FIELDS[key].required && !value) return `${FIELDS[key].label} can't be empty.`;
		if (key === "tag" && !/^[a-z0-9_]{3,20}$/.test(value)) return "3–20 letters, numbers or _.";
		const next: UpdateProfileDto = {
			firstName: p.firstName,
			lastName: p.lastName,
			tag: p.tag,
			...(p.gender ? { gender: p.gender } : {}),
			...(p.dateOfBirth ? { dateOfBirth: p.dateOfBirth } : {}),
			...(p.address ? { address: p.address } : {}),
			[key]: value || undefined,
		};
		try {
			await save.mutateAsync(next);
			setEditing(null);
			return null;
		} catch (err) {
			return errorMessage(err);
		}
	};

	const row = (label: string, key: FieldKey | null, value: string | null) => (
		<div className="flex items-center justify-between gap-4 py-3.5">
			<div className="min-w-0">
				<p className="text-[11px] font-light">{label}</p>
				<p className={`mt-0.5 truncate text-sm md:text-base ${value ? "text-neutral-dark" : "text-neutral-light-active"}`}>{value || "Not set"}</p>
			</div>
			{key && (
				<button type="button" onClick={() => edit(key)} className="flex shrink-0 items-center gap-1 text-sm text-primary hover:text-primary-hover">
					{value ? (
						<>
							Edit <HiOutlinePencil className="text-xs" />
						</>
					) : (
						<>
							Add <HiOutlinePlus className="text-xs" />
						</>
					)}
				</button>
			)}
		</div>
	);

	return (
		<div className="w-full max-w-2xl space-y-6 pb-10">
			<PageHeader title="Personal Info" back backHref={pageRoutes.dashboardRoutes.ME} />
			<QueryState isLoading={isLoading} error={error} onRetry={() => void refetch()} skeletonClassName="h-80" />
			{data && p && (
				<>
					<Group title="Profile Info">
						{row("First Name", "firstName", display("firstName", p))}
						{row("Last Name", "lastName", display("lastName", p))}
						{/* The API has no way to change the sign-in email. */}
						{row("Email Address", null, data.email)}
						{row("Personal Tag", "tag", display("tag", p))}
					</Group>
					<Group title="Additional Info">
						{row("Date of Birth", "dateOfBirth", display("dateOfBirth", p))}
						{row("Gender", "gender", display("gender", p))}
						{row("Address", "address", display("address", p))}
					</Group>
				</>
			)}
			<EditFieldSheet field={editing} onDiscard={() => setEditing(null)} onSave={onSave} />
		</div>
	);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-[20px] bg-panel px-6 pt-4 pb-1">
			<h3 className="border-b border-neutral-light pb-2.5 text-xs font-light">{title}</h3>
			<div className="divide-y divide-neutral-light">{children}</div>
		</section>
	);
}
