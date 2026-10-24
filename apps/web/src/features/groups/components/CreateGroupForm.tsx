"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BsCalendar2DayFill, BsCalendar2MonthFill, BsCalendar2RangeFill, BsCalendar2WeekFill } from "react-icons/bs";
import { FaCheckToSlot, FaGear, FaHandPointer, FaShuffle } from "react-icons/fa6";
import { HiArrowLongLeft, HiCheck, HiInformationCircle, HiOutlineClipboardDocument, HiOutlineScale, HiOutlineUserPlus, HiPlus } from "react-icons/hi2";
import { IoClose } from "react-icons/io5";
import { MdAddPhotoAlternate, MdEditCalendar } from "react-icons/md";
import { PiWarningCircleFill } from "react-icons/pi";
import { RiCalendarFill, RiGroupFill, RiMoneyDollarCircleFill, RiPercentFill, RiShuffleFill } from "react-icons/ri";
import { Label } from "@repo/ui/label";
import { toast } from "@repo/ui/sonner";
import { Avatar } from "@repo/ui/avatar";
import { ApprovalRules, DEFAULT_RULES, rulesError } from "@/features/governance/components/ApprovalRules";
import { setGovernance } from "@/features/governance/api";
import { ChoiceTile, LateFeeCard, PillInput, SelectField, StepHeader, Stepper, ToggleRow } from "@/features/groups/components/form-parts";
import { useAccount } from "@/features/auth/hooks";
import { useCreateGroup, useUpdateGroup } from "@/features/groups/hooks";
import { ApiError } from "@/lib/api/client";
import type { CreateGroupInput, Frequency, GovernanceSettingsDto, GroupDetailDto, MissedGracePolicy, PayoutOrder, UpdateGroupDto } from "@/lib/api/dto";
import { frequencyLabel, initials, labelize } from "@/lib/format";
import { pageRoutes } from "@/lib/routes";

/** The API's frequencies (`CreateGroupDto.frequency`). Custom = every N days (1–365). */
const FREQUENCIES: { value: Frequency; label: string; Icon: React.ComponentType }[] = [
	{ value: "daily", label: "Daily", Icon: BsCalendar2DayFill },
	{ value: "weekly", label: "Weekly", Icon: BsCalendar2WeekFill },
	{ value: "biweekly", label: "Bi Weekly", Icon: BsCalendar2RangeFill },
	{ value: "monthly", label: "Monthly", Icon: BsCalendar2MonthFill },
	{ value: "custom", label: "Custom", Icon: MdEditCalendar },
];

const FREQUENCY_PHRASE: Record<Exclude<Frequency, "custom">, string> = {
	daily: "every day",
	weekly: "every week",
	biweekly: "every two weeks",
	monthly: "every month",
};

const PAYOUT_TILES: { value: PayoutOrder; label: string; Icon: React.ComponentType; hint: string }[] = [
	{ value: "random", label: "Random", Icon: FaShuffle, hint: "Shuffled when the cycle starts." },
	{ value: "manual", label: "Manual", Icon: FaHandPointer, hint: "You set the order before starting." },
	{ value: "vote", label: "Vote", Icon: FaCheckToSlot, hint: "Join order; members can change it by proposal." },
	{ value: "custom", label: "Custom", Icon: FaGear, hint: "You set the order before starting." },
];

const GRACE_POLICIES: { value: MissedGracePolicy; label: string }[] = [
	{ value: "charge_late_fee", label: "Charge the late fee" },
	{ value: "start_recovery", label: "Start a group recovery vote" },
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** A positive decimal with at most 7 places — what Stellar can represent. */
const AMOUNT = /^\d+(\.\d{1,7})?$/;
const ASSET = "USDC";

type FormState = {
	name: string;
	contributionAmount: string;
	targetAmount: string;
	frequency: Frequency;
	customDays: string;
	payoutOrder: PayoutOrder;
	missedGracePolicy: MissedGracePolicy;
	serviceCharge: string;
	lateFeeMode: "fixed" | "percent";
	lateFixed: string;
	latePercent: string;
	graceDays: number;
	publicDiscovery: boolean;
	contributionPrivacy: boolean;
	autoApproval: boolean;
};

const initial: FormState = {
	name: "",
	contributionAmount: "",
	targetAmount: "",
	frequency: "monthly",
	customDays: "",
	payoutOrder: "manual",
	missedGracePolicy: "start_recovery",
	serviceCharge: "0",
	lateFeeMode: "fixed",
	lateFixed: "",
	latePercent: "",
	graceDays: 3,
	publicDiscovery: false,
	contributionPrivacy: false,
	autoApproval: false,
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 7 });

/** The late fee as an amount of USDC, whichever way it was entered. */
function lateFeeAmount(form: FormState) {
	const contribution = Number(form.contributionAmount) || 0;
	return form.lateFeeMode === "fixed" ? Number(form.lateFixed) || 0 : (contribution * (Number(form.latePercent) || 0)) / 100;
}

function lateFeeLabel(form: FormState) {
	const fee = lateFeeAmount(form);
	if (fee <= 0) return "None";
	const contribution = Number(form.contributionAmount) || 0;
	return `${fmt(fee)} ${ASSET} (${fmt(contribution ? (fee / contribution) * 100 : 0)}%)`;
}

/** Step-1 problems, keyed by the API's field names. */
function basicsErrors(form: FormState) {
	const errors: Record<string, string> = {};
	const name = form.name.trim();
	if (name.length < 3 || name.length > 60) errors.name = "Use 3 to 60 characters.";
	for (const [key, label] of [
		["contributionAmount", "each member's contribution"],
		["targetAmount", "the group's target"],
	] as const) {
		const value = form[key].trim();
		if (!value) errors[key] = `Enter ${label}.`;
		else if (!AMOUNT.test(value) || Number(value) <= 0) errors[key] = "Enter an amount above 0, with at most 7 decimal places.";
	}
	if (form.frequency === "custom") {
		const days = Number(form.customDays);
		if (!Number.isInteger(days) || days < 1 || days > 365) errors.customIntervalDays = "Enter a whole number of days, 1 to 365.";
	}
	return errors;
}

/** Step-2 problems, keyed by the API's field names. */
function rulesErrors(form: FormState, rules: GovernanceSettingsDto) {
	const errors: Record<string, string> = {};
	const contribution = Number(form.contributionAmount) || 0;
	const raw = form.lateFeeMode === "fixed" ? form.lateFixed : form.latePercent;
	if (raw.trim() && (!AMOUNT.test(raw.trim()) || Number(raw) < 0)) errors.lateFee = "Enter a number, or leave it empty for no late fee.";
	else if (lateFeeAmount(form) > contribution * 0.1 + 1e-9) errors.lateFee = `Late fees are capped at 10% of the contribution (${fmt(contribution / 10)} ${ASSET}).`;
	if (!/^\d{1,3}(\.\d{1,2})?$/.test(form.serviceCharge.trim() || "0") || Number(form.serviceCharge) > 100) errors.serviceChargePercent = "Enter a percentage from 0 to 100.";
	const rule = rulesError(rules);
	if (rule) errors.threshold = rule;
	return errors;
}

/** Which step holds a field the API rejected. */
const STEP_OF_FIELD = (field: string) => (/name|Amount|customIntervalDays|frequency/.test(field) ? 1 : 2);

/** A forming group's settings as the form's state (editing). */
function fromGroup(g: GroupDetailDto): FormState {
	return {
		name: g.name,
		contributionAmount: g.contributionAmount,
		targetAmount: g.targetAmount,
		frequency: g.frequency,
		customDays: g.customIntervalDays ? String(g.customIntervalDays) : "",
		payoutOrder: g.payoutOrder,
		missedGracePolicy: g.missedGracePolicy,
		serviceCharge: g.serviceChargePercent,
		lateFeeMode: g.lateFee?.kind === "percent" ? "percent" : "fixed",
		lateFixed: g.lateFee?.kind === "fixed" ? g.lateFee.value : "",
		latePercent: g.lateFee?.kind === "percent" ? g.lateFee.value : "",
		graceDays: g.gracePeriodDays,
		publicDiscovery: g.publicDiscovery,
		contributionPrivacy: g.contributionPrivacy,
		autoApproval: g.autoApproval,
	};
}

/**
 * `PATCH /groups/{id}` takes only what changed. A late fee is fixed or a percentage (sending one
 * replaces the other); `"0"` in either removes it.
 */
function changes(form: FormState, g: GroupDetailDto): UpdateGroupDto {
	const out: UpdateGroupDto = {};
	const name = form.name.trim();
	if (name !== g.name) out.name = name;
	if (Number(form.contributionAmount) !== Number(g.contributionAmount)) out.contributionAmount = form.contributionAmount.trim();
	if (Number(form.targetAmount) !== Number(g.targetAmount)) out.targetAmount = form.targetAmount.trim();
	const days = Number(form.customDays);
	if (form.frequency !== g.frequency || (form.frequency === "custom" && days !== g.customIntervalDays)) {
		out.frequency = form.frequency;
		if (form.frequency === "custom") out.customIntervalDays = days;
	}
	if (form.payoutOrder !== g.payoutOrder) out.payoutOrder = form.payoutOrder;
	if (form.missedGracePolicy !== g.missedGracePolicy) out.missedGracePolicy = form.missedGracePolicy;
	if (form.graceDays !== g.gracePeriodDays) out.gracePeriodDays = form.graceDays;
	if (form.publicDiscovery !== g.publicDiscovery) out.publicDiscovery = form.publicDiscovery;
	if (form.contributionPrivacy !== g.contributionPrivacy) out.contributionPrivacy = form.contributionPrivacy;
	if (form.autoApproval !== g.autoApproval) out.autoApproval = form.autoApproval;
	if (Number(form.serviceCharge || 0) !== Number(g.serviceChargePercent)) out.serviceChargePercent = form.serviceCharge.trim() || "0";
	const fee = (form.lateFeeMode === "fixed" ? form.lateFixed : form.latePercent).trim();
	if (!fee || Number(fee) <= 0) {
		if (g.lateFee) out.lateFeePercent = "0";
	} else if (!g.lateFee || g.lateFee.kind !== form.lateFeeMode || Number(g.lateFee.value) !== Number(fee)) {
		if (form.lateFeeMode === "fixed") out.lateFeeFixed = fee;
		else out.lateFeePercent = fee;
	}
	return out;
}

/**
 * Create a group in three steps (basics, rules, review). With `editing`, the same steps edit a
 * forming group: they start from its settings and approval rules, and save only what changed.
 */
export function CreateGroupForm({ editing }: { editing?: { group: GroupDetailDto; rules: GovernanceSettingsDto } } = {}) {
	const router = useRouter();
	const { data: account } = useAccount();
	const create = useCreateGroup();
	const update = useUpdateGroup(editing?.group.id ?? "");
	const exitHref = editing ? pageRoutes.dashboardRoutes.GROUP(editing.group.id) : pageRoutes.dashboardRoutes.GROUPS;

	const [step, setStep] = useState(1); // 1..3, 4 = success
	const [form, setForm] = useState<FormState>(() => (editing ? fromGroup(editing.group) : initial));
	const [rules, setRules] = useState<GovernanceSettingsDto>(editing?.rules ?? DEFAULT_RULES);
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
	const [showNameHint, setShowNameHint] = useState(true);
	const [showSettingsNote, setShowSettingsNote] = useState(true);
	const [created, setCreated] = useState<GroupDetailDto | null>(null);

	// Release the photo preview's object URL when it's replaced or unmounted.
	const photoUrl = photo?.url;
	useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

	const errors = { ...basicsErrors(form), ...rulesErrors(form, rules) };
	const fieldError = (key: string) => (touched[key] ? errors[key] : undefined);
	const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
	const setValue =
		<K extends keyof FormState>(key: K) =>
		(v: FormState[K]) =>
			setForm((f) => ({ ...f, [key]: v }));
	const touch = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));

	const back = () => (step === 1 ? router.push(exitHref) : setStep((s) => s - 1));
	const discard = () => router.push(exitHref);

	const pickPhoto = (file: File) => {
		if (!PHOTO_TYPES.includes(file.type)) return toast.error("Unsupported file", { description: "Use a JPG, PNG, or WebP image." });
		if (file.size > MAX_PHOTO_BYTES) return toast.error("File too large", { description: "The image must be 5 MB or smaller." });
		setPhoto({ file, url: URL.createObjectURL(file) });
	};

	const customDays = Number(form.customDays);
	const cyclePhrase =
		form.frequency === "custom" ? (customDays > 0 ? `every ${customDays} day${customDays === 1 ? "" : "s"}` : "on your custom cycle") : FREQUENCY_PHRASE[form.frequency];

	const submit = () => {
		const fee = form.lateFeeMode === "fixed" ? form.lateFixed.trim() : form.latePercent.trim();
		const input: CreateGroupInput = {
			name: form.name.trim(),
			asset: ASSET,
			frequency: form.frequency,
			customIntervalDays: form.frequency === "custom" ? customDays : undefined,
			targetAmount: form.targetAmount.trim(),
			contributionAmount: form.contributionAmount.trim(),
			payoutOrder: form.payoutOrder,
			missedGracePolicy: form.missedGracePolicy,
			...(fee && Number(fee) > 0 ? (form.lateFeeMode === "fixed" ? { lateFeeFixed: fee } : { lateFeePercent: fee }) : {}),
			gracePeriodDays: form.graceDays,
			publicDiscovery: form.publicDiscovery,
			contributionPrivacy: form.contributionPrivacy,
			autoApproval: form.autoApproval,
			serviceChargePercent: form.serviceCharge.trim() || "0",
			coverPhoto: photo?.file ?? null,
		};
		create.mutate(input, {
			onSuccess: async (group) => {
				// Approval rules aren't part of POST /groups: set them right after, while the group is forming.
				const changed = JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);
				if (changed) {
					await setGovernance(group.id, rules).catch(() =>
						toast.warning("Approval rules not saved", { description: "Your group was created. Set the rules from its page before you start." }),
					);
				}
				setCreated(group);
				setStep(4);
			},
			onError: (error) => {
				if (error instanceof ApiError && Array.isArray(error.details)) {
					const fields = (error.details as string[]).map((d) => d.split(" ")[0] ?? "");
					setStep(fields.some((f) => STEP_OF_FIELD(f) === 1) ? 1 : 2);
				}
			},
		});
	};

	const saveEdit = async () => {
		if (!editing) return;
		const { group } = editing;
		const diff = changes(form, group);
		const rulesChanged = JSON.stringify(rules) !== JSON.stringify(editing.rules);
		try {
			if (Object.keys(diff).length > 0) await update.mutateAsync(diff);
			if (rulesChanged) await setGovernance(group.id, rules);
			toast.success(Object.keys(diff).length > 0 || rulesChanged ? "Group updated" : "Nothing changed");
			router.push(pageRoutes.dashboardRoutes.GROUP(group.id));
		} catch (error) {
			if (error instanceof ApiError && Array.isArray(error.details)) {
				const fields = (error.details as string[]).map((d) => d.split(" ")[0] ?? "");
				setStep(fields.some((f) => STEP_OF_FIELD(f) === 1) ? 1 : 2);
			}
		}
	};

	if (step === 4 && created) return <SuccessScreen group={created} />;

	// ------------------------------------------------------------------ STEP 3 — Review
	if (step === 3) {
		const target = Number(form.targetAmount);
		const rows: { Icon: React.ComponentType<{ className?: string }>; label: string; value: string; danger?: boolean }[] = [
			{ Icon: RiGroupFill, label: "Group Type", value: `Rotating · ${form.publicDiscovery ? "Public" : "Private"}` },
			{ Icon: RiShuffleFill, label: "Payout Order", value: labelize(form.payoutOrder) },
			{ Icon: RiCalendarFill, label: "Frequency", value: frequencyLabel(form.frequency, customDays) },
			{ Icon: RiMoneyDollarCircleFill, label: "Contribution", value: `${fmt(Number(form.contributionAmount))} ${ASSET}` },
			{ Icon: RiPercentFill, label: "Service Charge", value: `${fmt(Number(form.serviceCharge) || 0)}%` },
			{ Icon: HiOutlineScale, label: "Decisions pass at", value: rules.thresholdKind === "percent" ? `${rules.thresholdValue}% of members` : `${rules.thresholdValue} yes votes` },
			{ Icon: PiWarningCircleFill, label: "Late Penalty", value: `${lateFeeLabel(form)} after ${form.graceDays} days`, danger: true },
			{ Icon: PiWarningCircleFill, label: "After the grace period", value: GRACE_POLICIES.find((p) => p.value === form.missedGracePolicy)!.label, danger: true },
		];
		const name = account?.profile ? `${account.profile.firstName} ${account.profile.lastName}` : "You";

		return (
			<div className="w-full max-w-5xl">
				<div className="flex items-center gap-3">
					<button type="button" onClick={back} aria-label="Back to Group Rules">
						<HiArrowLongLeft className="text-2xl" />
					</button>
					<h2 className="truncate text-2xl md:text-[28px]">{form.name.trim()}</h2>
				</div>
				<img src={photo?.url ?? editing?.group.coverUrl ?? "/images/group-placeholder.png"} alt="" className="mt-4 h-40 w-full rounded-[14px] object-cover md:h-56" />
				<div className="mt-3 grid grid-cols-2 gap-3">
					<div className="rounded-[10px] bg-neutral-comment px-4 py-4 md:px-5">
						<p className="text-xs">Target Goal</p>
						<p className="mt-1 truncate text-2xl md:text-[34px]">
							{target > 0 ? `${new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(target)} ${ASSET}` : "—"}
						</p>
					</div>
					<div className="rounded-[10px] bg-neutral-comment px-4 py-4 md:px-5">
						<p className="text-xs">{editing ? `${editing.group.memberCount} Member${editing.group.memberCount === 1 ? "" : "s"}` : "1 Member"}</p>
						<div className="mt-2 flex items-center">
							<Avatar src={account?.avatarUrl} initials={initials(name)} label={name} className="h-9 w-9 border-2 border-white" />
							<span aria-hidden className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-neutral-dark text-white">
								<HiPlus />
							</span>
						</div>
					</div>
				</div>
				<p className="mt-6 text-sm">Group Settings</p>
				<div className="mt-2">
					{rows.map(({ Icon, label, value, danger }) => (
						<div key={label} className="flex items-center justify-between gap-4 border-b border-neutral-light py-3 text-sm">
							<span className="flex items-center gap-2">
								<Icon className={`text-base ${danger ? "text-error-400" : "text-primary"}`} />
								{label}
							</span>
							<span className={`text-right ${danger ? "text-error-400" : ""}`}>{value}</span>
						</div>
					))}
				</div>
				<div className={editing ? "hidden" : "mt-6 rounded-[14px] bg-neutral-comment px-5 py-5"}>
					<p className="text-sm">Invite your members</p>
					<p className="mt-1 max-w-xl text-xs font-light">Your invitation link is ready as soon as the group is created. Members who use it are added once you approve them.</p>
				</div>
				<button
					type="button"
					onClick={editing ? () => void saveEdit() : submit}
					disabled={create.isPending || update.isPending}
					className="mt-8 h-12 w-48 rounded-full bg-primary-dark text-sm text-white transition hover:bg-primary-dark-hover disabled:cursor-wait disabled:opacity-80 md:h-14 md:text-base"
				>
					{editing ? (update.isPending ? "Saving…" : "Save Changes") : create.isPending ? "Creating…" : "Create Group"}
				</button>
			</div>
		);
	}

	// ------------------------------------------------------------------ STEP 2 — Group Rules
	if (step === 2) {
		const fee = lateFeeAmount(form);
		const canContinue = Object.keys(rulesErrors(form, rules)).length === 0;
		return (
			<div className="w-full max-w-5xl">
				<StepHeader step={2} total={3} onBack={back} />

				<p className="mt-8 text-xs">Late Fees</p>
				<div className="mt-3 grid gap-3 sm:grid-cols-2">
					<LateFeeCard
						label="Fixed Amount"
						selected={form.lateFeeMode === "fixed"}
						onSelect={() => setValue("lateFeeMode")("fixed")}
						prefix={ASSET}
						value={form.lateFixed}
						onChange={set("lateFixed")}
						onBlur={touch("lateFee")}
						art="/images/late_fee.svg"
					/>
					<LateFeeCard
						label="Percentage of contribution"
						selected={form.lateFeeMode === "percent"}
						onSelect={() => setValue("lateFeeMode")("percent")}
						suffix="%"
						value={form.latePercent}
						onChange={set("latePercent")}
						onBlur={touch("lateFee")}
					/>
				</div>
				{fieldError("lateFee") ? (
					<p className="mt-2 text-xs text-error-400" role="alert">
						{fieldError("lateFee")}
					</p>
				) : (
					<p className="mt-2 text-xs font-light text-neutral-900">
						{fee > 0
							? `Paid on top of a contribution made after its deadline: ${fmt(fee)} ${ASSET}. Capped at 10% of the contribution.`
							: "Leave both empty for no late fee. Capped at 10% of the contribution."}
					</p>
				)}

				<div className="mt-8 grid gap-8 md:grid-cols-2">
					<div className="space-y-5">
						<div>
							<p className="text-sm font-light">Grace Period</p>
							<Stepper value={form.graceDays} max={30} unit={["day", "days"]} onChange={setValue("graceDays")} />
							<p className="mt-2 text-[11px] font-light text-ink-muted">
								{form.missedGracePolicy === "start_recovery"
									? "Not used while a missed contribution starts a recovery vote: that begins right at the deadline."
									: "Contributions are accepted (with the late fee) for this long after the deadline. After it, the group votes on recovery."}
							</p>
						</div>
						<SelectField label="When a member misses the grace period" value={form.missedGracePolicy} items={GRACE_POLICIES} onChange={(v) => setValue("missedGracePolicy")(v as MissedGracePolicy)} />
					</div>
					<div className="space-y-5">
						<ToggleRow label="Public Discovery" description="Allow non-members to find the group" value={form.publicDiscovery} onChange={setValue("publicDiscovery")} />
						<ToggleRow label="Contribution Privacy" description="Hide member balances from each other" value={form.contributionPrivacy} onChange={setValue("contributionPrivacy")} />
						<ToggleRow label="Auto Approval" description="Admit join requests without reviewing them" value={form.autoApproval} onChange={setValue("autoApproval")} />
					</div>
				</div>

				<div className="mt-8">
					<p className="text-sm font-light">Payout Order</p>
					<div className="mt-3 flex flex-wrap gap-5 md:gap-6">
						{PAYOUT_TILES.map(({ value, label, Icon }) => (
							<ChoiceTile key={value} label={label} Icon={Icon} active={form.payoutOrder === value} onClick={() => setValue("payoutOrder")(value)} />
						))}
					</div>
					<p className="mt-2 text-[11px] font-light text-ink-muted">{PAYOUT_TILES.find((t) => t.value === form.payoutOrder)!.hint}</p>
				</div>

				<div className="mt-8 grid gap-5 md:grid-cols-2">
					<PillInput
						name="serviceChargePercent"
						label="Service Charge"
						placeholder="0"
						suffix="%"
						inputMode="decimal"
						value={form.serviceCharge}
						onChange={set("serviceCharge")}
						onBlur={touch("serviceChargePercent")}
						error={fieldError("serviceChargePercent")}
						hint="Kept from each payout."
					/>
				</div>

				<div className="mt-8">
					<ApprovalRules value={rules} onChange={setRules} />
				</div>

				<div className="mt-10 flex gap-3">
					<button type="button" onClick={discard} className="h-12 flex-1 rounded-full bg-neutral-comment text-sm text-error-400 transition hover:bg-neutral-light md:h-14 md:text-base">
						{editing ? "Discard Changes" : "Discard Draft"}
					</button>
					<button
						type="button"
						disabled={!canContinue}
						onClick={() => setStep(3)}
						className="h-12 rounded-full bg-primary px-8 text-sm text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active md:h-14 md:px-12 md:text-base"
					>
						Save &amp; Continue
					</button>
				</div>

				<div className="relative mt-8 overflow-hidden rounded-[14px] bg-primary px-6 py-6 text-white">
					<img src="/images/trust_rules.svg" alt="" aria-hidden className="pointer-events-none absolute right-4 -bottom-1 h-[115%] max-sm:opacity-40" />
					<div className="relative max-w-sm">
						<p className="text-base md:text-lg">Trust Built on Rules</p>
						<p className="mt-1 text-xs font-light md:text-sm">Clear rules reduce friction and ensure everyone grows together in your community.</p>
					</div>
				</div>
			</div>
		);
	}

	// ------------------------------------------------------------------ STEP 1 — Basics
	const canContinue = Object.keys(basicsErrors(form)).length === 0;
	const amountLabel = AMOUNT.test(form.contributionAmount.trim()) ? `${fmt(Number(form.contributionAmount))} ${ASSET}` : null;
	return (
		<div className="w-full max-w-5xl">
			<StepHeader step={1} total={3} onBack={back} />
			{!editing && <PhotoPicker photo={photo} onPick={pickPhoto} onRemove={() => setPhoto(null)} />}

			<div className="mt-8 grid gap-x-6 gap-y-5 md:grid-cols-2">
				<div className="space-y-2.5">
					<PillInput name="name" label="Group Name" placeholder="e.g Summer Cabin Fund" value={form.name} onChange={set("name")} onBlur={touch("name")} error={fieldError("name")} />
					{showNameHint && (
						<span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-[11px] text-primary">
							<HiInformationCircle className="text-sm" />
							Choose a name that inspires your members
							<button type="button" onClick={() => setShowNameHint(false)} aria-label="Dismiss tip" className="ml-1">
								<IoClose />
							</button>
						</span>
					)}
				</div>
				<PillInput
					name="targetAmount"
					label="Target Amount"
					placeholder="0.00"
					prefix={ASSET}
					inputMode="decimal"
					value={form.targetAmount}
					onChange={set("targetAmount")}
					onBlur={touch("targetAmount")}
					error={fieldError("targetAmount")}
				/>
				<PillInput
					name="contributionAmount"
					label="Contribution per Member"
					placeholder="0.00"
					prefix={ASSET}
					inputMode="decimal"
					value={form.contributionAmount}
					onChange={set("contributionAmount")}
					onBlur={touch("contributionAmount")}
					error={fieldError("contributionAmount")}
				/>
				<div className="space-y-2">
					<Label className="text-sm font-light">Save in</Label>
					<p className="flex h-12 items-center rounded-full border border-neutral-light-active bg-white px-5 text-sm">USDC · Stellar Testnet</p>
				</div>
			</div>

			<div className="mt-8">
				<p className="text-sm font-light">Contribution Frequency</p>
				<div className="mt-3 flex flex-wrap gap-5 md:gap-6">
					{FREQUENCIES.map(({ value, label, Icon }) => (
						<ChoiceTile key={value} label={label} Icon={Icon} active={form.frequency === value} onClick={() => setValue("frequency")(value)} />
					))}
				</div>
				{form.frequency === "custom" && (
					<div className="mt-5 max-w-xs">
						<PillInput
							name="customIntervalDays"
							label="Days between rounds"
							placeholder="10"
							inputMode="numeric"
							suffix="days"
							value={form.customDays}
							onChange={set("customDays")}
							onBlur={touch("customIntervalDays")}
							error={fieldError("customIntervalDays")}
						/>
					</div>
				)}
			</div>

			<button
				type="button"
				disabled={!canContinue}
				onClick={() => setStep(2)}
				className="mt-12 h-12 w-40 rounded-full bg-primary-dark text-sm text-white transition hover:bg-primary-dark-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active md:h-14 md:w-48 md:text-base"
			>
				Continue
			</button>

			{showSettingsNote && (
				<div className="relative mt-10 rounded-[14px] bg-primary-light px-5 py-5 md:px-6">
					<button type="button" onClick={() => setShowSettingsNote(false)} aria-label="Dismiss" className="absolute top-4 right-4 text-lg text-primary">
						<IoClose />
					</button>
					<p className="pr-8 text-base md:text-lg">Community Settings</p>
					<p className="mt-1 max-w-xl text-xs md:text-sm">
						{amountLabel ? `Each member's contribution of ${amountLabel} will be due ${cyclePhrase}.` : `Members will contribute ${cyclePhrase}.`} Ensure you leave enough balance to
						avoid missed payment penalties.
					</p>
				</div>
			)}
		</div>
	);
}

function SuccessScreen({ group }: { group: GroupDetailDto }) {
	const [copied, setCopied] = useState(false);
	const url = group.invite?.url ?? null;

	const copy = async () => {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Couldn't copy", { description: "Select the link and copy it instead." });
		}
	};

	// The phone's share sheet where there is one (WhatsApp is how most groups form); else the clipboard.
	const invite = async () => {
		if (!url) return;
		if (typeof navigator.share === "function") {
			try {
				await navigator.share({ title: group.name, text: `Join my savings group "${group.name}" on Saji`, url });
				return;
			} catch {
				/* dismissed — fall through to copying */
			}
		}
		await copy();
		toast.success("Invite link copied", { description: "Paste it wherever your members are." });
	};

	return (
		<div className="mx-auto flex max-w-md flex-col items-center py-10 text-center md:py-16">
			<div className="animate-pop flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white md:h-28 md:w-28">
				<HiCheck className="text-5xl md:text-6xl" />
			</div>
			<h2 className="mt-8 text-2xl">Your Savings Group is Ready</h2>
			<p className="mt-2 text-xs font-light md:text-sm">
				Your group &quot;{group.name}&quot; has been created. Invite your community, approve who joins, then start the cycle.
			</p>
			{url && (
				<div className="mt-16 w-full text-left md:mt-24">
					<Label className="text-sm font-light">Group Invite Link</Label>
					<div className="mt-2 flex h-12 items-center gap-2 rounded-full border border-neutral-light-active bg-white pr-2 pl-5">
						<input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Group invite link" className="min-w-0 flex-1 truncate bg-transparent text-sm outline-none" />
						<button type="button" onClick={copy} aria-label="Copy invite link" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-primary hover:bg-primary-light">
							{copied ? <HiCheck /> : <HiOutlineClipboardDocument />}
						</button>
					</div>
					<p className="mt-2 text-[11px] font-light">Anyone with this link can request to join your group.</p>
				</div>
			)}
			{url && (
				<button type="button" onClick={invite} className="mt-10 flex h-12 w-56 items-center justify-center gap-2 rounded-full bg-primary text-sm text-white transition hover:bg-primary-hover">
					<HiOutlineUserPlus className="text-base" />
					Invite Members
				</button>
			)}
			<Link href={pageRoutes.dashboardRoutes.GROUP(group.id)} className="mt-5 text-sm text-primary underline-offset-4 hover:underline">
				Go to your group
			</Link>
		</div>
	);
}

/** "Set Group Photo" banner. The file goes up with the group (`coverPhoto`). */
function PhotoPicker({ photo, onPick, onRemove }: { photo: { url: string } | null; onPick: (file: File) => void; onRemove: () => void }) {
	const input = useRef<HTMLInputElement>(null);
	return (
		<div className="relative mt-8 overflow-hidden rounded-[14px] bg-primary text-white">
			{photo && (
				<>
					<img src={photo.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
					<div className="absolute inset-0 bg-black/40" />
				</>
			)}
			<div className="relative flex min-h-36 flex-col px-5 py-5 md:min-h-40 md:px-6">
				<p className="text-sm md:text-base">Set Group Photo</p>
				<div className="mt-3 flex flex-1 flex-col items-center justify-center gap-4">
					{!photo && <MdAddPhotoAlternate className="text-3xl" aria-hidden />}
					<div className="flex items-center gap-3">
						<button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-full bg-primary-dark px-6 py-2.5 text-xs transition hover:bg-primary-dark-hover md:text-sm">
							{photo ? "Change Photo" : "Browse Photos"} <HiPlus />
						</button>
						{photo && (
							<button type="button" onClick={onRemove} className="text-xs underline md:text-sm">
								Remove
							</button>
						)}
					</div>
				</div>
			</div>
			<input
				ref={input}
				type="file"
				accept={PHOTO_TYPES.join(",")}
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					e.target.value = ""; // allow re-picking the same file
					if (file) onPick(file);
				}}
			/>
		</div>
	);
}
