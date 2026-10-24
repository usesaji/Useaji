"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { HiArrowLongLeft, HiMinus, HiPlus } from "react-icons/hi2";
import { Label } from "@repo/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import { cn } from "@repo/ui/lib/utils";

/** Form pieces of the group screens (create wizard, approval rules). */

/** Back arrow, "Step N" and the progress segments on one row. 1-indexed. */
export function StepHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
	return (
		<div className="flex items-center gap-4">
			<button type="button" onClick={onBack} className="flex shrink-0 items-center gap-2.5 text-sm md:text-base">
				<HiArrowLongLeft className="text-2xl" />
				<span>Step {step}</span>
			</button>
			<div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
				{Array.from({ length: total }).map((_, i) => (
					<div key={i} className={cn("h-1 flex-1 rounded-full md:h-1.5", i < step ? "bg-primary" : "bg-primary-light")} />
				))}
			</div>
		</div>
	);
}

/** Rounded text input with an optional unit before or after the value. */
export function PillInput({
	name,
	label,
	value,
	onChange,
	onBlur,
	placeholder,
	prefix,
	suffix,
	error,
	hint,
	inputMode,
}: {
	name: string;
	label: string;
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur?: () => void;
	placeholder?: string;
	prefix?: string;
	suffix?: string;
	error?: string;
	hint?: string;
	inputMode?: "decimal" | "numeric" | "text";
}) {
	return (
		<div className="space-y-2">
			<label htmlFor={name} className="text-sm font-light">
				{label}
			</label>
			<div
				className={cn(
					"flex h-12 items-center gap-3 rounded-full border bg-white px-5 transition",
					error ? "border-error-400 text-error-400" : "border-neutral-light-active focus-within:border-primary focus-within:text-primary",
				)}
			>
				{prefix && <span className="text-sm font-medium">{prefix}</span>}
				<input
					id={name}
					name={name}
					value={value}
					onChange={onChange}
					onBlur={onBlur}
					placeholder={placeholder}
					inputMode={inputMode}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? `${name}-error` : undefined}
					className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-sm placeholder:text-neutral-light-active"
				/>
				{suffix && <span className="text-sm font-medium">{suffix}</span>}
			</div>
			{error ? (
				<p id={`${name}-error`} className="text-xs text-error-400" role="alert">
					{error}
				</p>
			) : (
				hint && <p className="text-[11px] font-light text-ink-muted">{hint}</p>
			)}
		</div>
	);
}

export function SelectField({ label, value, items, onChange }: { label: string; value: string; items: { value: string; label: string }[]; onChange: (v: string) => void }) {
	return (
		<div className="space-y-2">
			<Label className="text-sm font-light">{label}</Label>
			<Select items={items} value={value} onValueChange={onChange}>
				<SelectTrigger className="h-12 w-full rounded-[900px] border-neutral-light-active bg-white px-5">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="bg-white text-neutral-dark">
					<SelectGroup>
						{items.map((it) => (
							<SelectItem key={it.value} value={it.value}>
								{it.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}

/** Round icon option with a caption — frequency and payout-order pickers. */
export function ChoiceTile({ label, Icon, active, onClick }: { label: string; Icon: React.ComponentType; active: boolean; onClick: () => void }) {
	return (
		<button type="button" aria-pressed={active} onClick={onClick} className="flex w-14 flex-col items-center gap-2">
			<span
				className={cn(
					"flex h-12 w-12 items-center justify-center rounded-full text-lg transition md:h-14 md:w-14 md:text-xl",
					active ? "bg-primary text-white" : "bg-primary-light text-primary hover:bg-primary-light-hover",
				)}
			>
				<Icon />
			</span>
			<span className={cn("text-[11px]", active && "text-primary")}>{label}</span>
		</button>
	);
}

export function ToggleRow({ label, description, value, onChange }: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<p className="text-sm">{label}</p>
				<p className="text-[11px] font-light">{description}</p>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={value}
				aria-label={label}
				onClick={() => onChange(!value)}
				className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-primary" : "bg-neutral-light")}
			>
				<span className={cn("absolute top-0.5 h-5 w-5 rounded-full transition-all", value ? "left-5.5 bg-white" : "left-0.5 bg-neutral-dark")} />
			</button>
		</div>
	);
}

/** One of the two late-fee cards: the selected one is filled, the other muted, as in the design. */
export function LateFeeCard({
	label,
	selected,
	onSelect,
	prefix,
	suffix,
	value,
	onChange,
	onBlur,
	art,
}: {
	label: string;
	selected: boolean;
	onSelect: () => void;
	prefix?: string;
	suffix?: string;
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onBlur: () => void;
	art?: string;
}) {
	const [showArt, setShowArt] = useState(true);
	return (
		<div
			onClick={onSelect}
			className={cn(
				"relative cursor-pointer overflow-hidden rounded-[10px] px-4 py-4 transition md:px-5",
				selected ? "bg-primary text-white" : "bg-primary-light text-neutral-dark hover:bg-primary-light-hover",
			)}
		>
			{art && showArt && <img src={art} alt="" aria-hidden onError={() => setShowArt(false)} className="pointer-events-none absolute right-0 -bottom-2 h-[90%]" />}
			<p className="relative text-[11px]">{label}</p>
			<label className="relative mt-1 flex items-baseline gap-1">
				<span className="sr-only">{label}</span>
				{prefix && <span className="text-lg md:text-xl">{prefix}</span>}
				<input
					value={value}
					onChange={onChange}
					onFocus={onSelect}
					onBlur={onBlur}
					inputMode="decimal"
					placeholder="0"
					className={cn("w-28 min-w-0 bg-transparent text-3xl outline-none md:w-36 md:text-[34px]", selected ? "placeholder:text-white/50" : "placeholder:text-neutral-dark/30")}
				/>
				{suffix && <span className="text-2xl md:text-3xl">{suffix}</span>}
			</label>
		</div>
	);
}

/** "− 3 days +" */
export function Stepper({ value, onChange, min = 0, max, unit }: { value: number; onChange: (n: number) => void; min?: number; max: number; unit: [string, string] }) {
	return (
		<div className="mt-2 flex items-center justify-between rounded-full bg-neutral-comment px-3 py-2">
			<button type="button" aria-label={`One ${unit[0]} less`} onClick={() => onChange(Math.max(min, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-white">
				<HiMinus />
			</button>
			<span className="text-sm" aria-live="polite">
				{value} {value === 1 ? unit[0] : unit[1]}
			</span>
			<button type="button" aria-label={`One ${unit[0]} more`} onClick={() => onChange(Math.min(max, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-lg hover:bg-white">
				<HiPlus />
			</button>
		</div>
	);
}
