"use client";

import { useState } from "react";
import { PiGaugeLight } from "react-icons/pi";
import { InputField } from "@repo/ui/input-field";
import { Switch } from "@repo/ui/switch";
import { PageHeader } from "@/components/PageHeader";
import { useSecurity, useSetPassword, useUpdateSecurity } from "@/features/account/hooks";
import { pageRoutes } from "@/lib/routes";

/**
 * Password & Security: set or change the password (`PUT /users/me/password`, which signs out every
 * other session; a Google-only account confirms with Google instead of a current password) and the
 * login lockout (`GET/PATCH /users/me/security`).
 */
export default function SecurityPage() {
	const security = useSecurity();
	const update = useUpdateSecurity();
	const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
	const setPassword = useSetPassword(() => setPwd({ current: "", next: "", confirm: "" }));

	const hasPassword = security.data?.hasPassword ?? true;
	const mismatch = pwd.confirm && pwd.next !== pwd.confirm ? "The passwords don't match." : null;
	const canSubmit = pwd.next.length >= 8 && pwd.next === pwd.confirm && (!hasPassword || pwd.current.length > 0);
	const set = (key: keyof typeof pwd) => (e: React.ChangeEvent<HTMLInputElement>) => setPwd((p) => ({ ...p, [key]: e.target.value }));

	return (
		<div className="w-full space-y-6 pb-10 md:space-y-8">
			<PageHeader title="Password & Security" back backHref={pageRoutes.dashboardRoutes.ME} />
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<form
					noValidate
					onSubmit={(e) => {
						e.preventDefault();
						setPassword.mutate({ newPassword: pwd.next, currentPassword: hasPassword ? pwd.current : undefined });
					}}
					className="space-y-5 rounded-[20px] bg-panel p-6 md:p-7"
				>
					<h3 className="text-lg md:text-xl">{hasPassword ? "Change Password" : "Set a Password"}</h3>
					{!hasPassword && <p className="-mt-3 text-xs font-light">You sign in with Google. Set a password to sign in with your email too.</p>}
					{hasPassword && <InputField name="current_password" label="Current Password" type="password" autoComplete="current-password" value={pwd.current} onChange={set("current")} />}
					<InputField name="new_password" label="New Password" type="password" autoComplete="new-password" description="At least 8 characters." value={pwd.next} onChange={set("next")} />
					<InputField name="confirm_password" label="Confirm New Password" type="password" autoComplete="new-password" value={pwd.confirm} onChange={set("confirm")} error={mismatch} />
					<button
						type="submit"
						disabled={!canSubmit || setPassword.isPending}
						className="h-12 w-full rounded-full bg-primary-dark text-sm text-white transition hover:bg-primary-dark-hover disabled:cursor-not-allowed disabled:bg-neutral-light-hover disabled:text-neutral-light-active md:text-base"
					>
						{setPassword.isPending ? "Saving…" : hasPassword ? "Update Password" : "Set Password"}
					</button>
				</form>

				<div className="space-y-4">
					<section className="rounded-[20px] bg-panel px-6 py-2 md:px-7">
						<h3 className="pt-4 text-lg md:text-xl">Security Settings</h3>
						<ToggleRow
							label="Lock after failed logins"
							description={
								security.data
									? `Lock the account for ${security.data.lockoutMinutes} minutes after ${security.data.lockoutMaxFailures} wrong passwords.`
									: "Lock the account after repeated wrong passwords."
							}
							checked={security.data?.loginLockout ?? false}
							disabled={!security.data || update.isPending}
							onChange={(on) => update.mutate({ loginLockout: on })}
						/>
					</section>
					<div className="flex items-start gap-3.5 rounded-[20px] bg-primary-light p-5">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-primary">
							<PiGaugeLight />
						</span>
						<div>
							<h4 className="text-sm font-semibold text-primary-darker">Is my information safe?</h4>
							<p className="mt-1 text-xs leading-relaxed font-light text-primary-dark">
								Yes. Saji never holds your wallet&apos;s keys, and your details are only used to run your account — never shared.
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
	return (
		<div className="flex items-center justify-between gap-4 border-b border-neutral-light py-4 last:border-b-0">
			<div className="min-w-0">
				<p className="text-sm font-medium text-neutral-dark">{label}</p>
				<p className="mt-1 text-xs leading-relaxed font-light text-neutral-light-active">{description}</p>
			</div>
			<Switch checked={checked} onChange={onChange} disabled={disabled} />
		</div>
	);
}
