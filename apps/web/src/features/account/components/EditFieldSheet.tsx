"use client";

import { useState } from "react";
import { Button } from "@repo/ui/button";
import { InputField } from "@repo/ui/input-field";
import { ResponsiveModal, ResponsiveModalTitle } from "@repo/ui/responsive-modal";

export interface EditingField {
	key: string;
	label: string;
	/** An input type, or "select" to choose from `options`. */
	inputType: string;
	value: string;
	options?: { value: string; label: string }[];
}

/** A bottom sheet (phones) / dialog (desktop) editing one profile field. `onSave` resolves an error message or null. */
export function EditFieldSheet({ field, onDiscard, onSave }: { field: EditingField | null; onDiscard: () => void; onSave: (key: string, value: string) => Promise<string | null> }) {
	// Keeps rendering the last field while the sheet animates closed (`field` is null at once).
	const [shown, setShown] = useState<EditingField | null>(field);
	if (field !== null && field !== shown) setShown(field);

	return (
		<ResponsiveModal open={field !== null} onOpenChange={(open) => !open && onDiscard()}>
			{shown && <EditFieldForm key={shown.key} field={shown} onDiscard={onDiscard} onSave={onSave} />}
		</ResponsiveModal>
	);
}

function EditFieldForm({ field, onDiscard, onSave }: { field: EditingField; onDiscard: () => void; onSave: (key: string, value: string) => Promise<string | null> }) {
	const [value, setValue] = useState(field.value);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async () => {
		setSaving(true);
		setError(null);
		const problem = await onSave(field.key, value.trim());
		setSaving(false);
		if (problem) setError(problem);
	};

	return (
		<div className="mx-auto w-full max-w-md">
			<ResponsiveModalTitle className="mb-3 text-left text-sm font-medium text-neutral-dark">{field.label}</ResponsiveModalTitle>
			{field.inputType === "select" && field.options ? (
				<>
					<select
						name={field.key}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						aria-label={field.label}
						className="h-12 w-full rounded-full border border-neutral-light-hover bg-white px-5 text-base outline-none focus:border-primary"
					>
						<option value="">Not set</option>
						{field.options.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
					{error && (
						<p className="mt-1.5 text-xs text-error-500" role="alert">
							{error}
						</p>
					)}
				</>
			) : (
				<InputField name={field.key} type={field.inputType} value={value} onChange={(e) => setValue(e.target.value)} error={error} aria-label={field.label} />
			)}
			<div className="mt-6 flex w-full items-center gap-3">
				<button type="button" onClick={onDiscard} disabled={saving} className="h-12 flex-1 rounded-full bg-neutral-comment text-sm font-semibold text-neutral-dark disabled:opacity-60">
					Discard
				</button>
				<Button type="button" onClick={save} isLoading={saving} className="flex-1">
					Save &amp; Continue
				</Button>
			</div>
		</div>
	);
}
