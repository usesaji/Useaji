"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HiOutlineShieldCheck } from "react-icons/hi2";
import { Button } from "@repo/ui/button";
import { InputField } from "@repo/ui/input-field";
import { Logo } from "@repo/ui/logo";
import { errorMessage, useSignIn } from "@/features/auth/hooks";

/** Admin sign-in: the app's login, refused for anyone without `role: admin`. */
export default function SignInPage() {
	return (
		<Suspense>
			<SignIn />
		</Suspense>
	);
}

function SignIn() {
	const next = useSearchParams().get("next");
	const signIn = useSignIn(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	return (
		<div className="flex min-h-screen items-center justify-center bg-primary-light px-4">
			<div className="animate-rise w-full max-w-md rounded-[30px] bg-white px-6 py-10 shadow-xl md:px-10">
				<div className="flex items-center gap-2">
					<Logo />
					<span className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] text-primary">Admin</span>
				</div>
				<h1 className="mt-8 text-[28px]">Console sign in</h1>
				<p className="text-sm font-light text-ink-muted">Admins only. Use your Saji account.</p>
				<form
					noValidate
					onSubmit={(e) => {
						e.preventDefault();
						signIn.mutate({ email, password });
					}}
					className="mt-6 space-y-5"
				>
					<InputField
						name="email"
						label="Email"
						type="email"
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email address"
					/>
					<InputField
						name="password"
						label="Password"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Password"
					/>
					{signIn.error && (
						<p role="alert" className="animate-drop rounded-xl bg-accent-light px-4 py-3 text-sm text-accent">
							{errorMessage(signIn.error)}
						</p>
					)}
					<Button type="submit" isLoading={signIn.isPending} disabled={!email || !password} className="w-full">
						Sign In
					</Button>
				</form>
				<p className="mt-6 flex items-center gap-2 text-xs font-light text-ink-muted">
					<HiOutlineShieldCheck className="text-base text-primary" /> Every sign-in is recorded in the audit log.
				</p>
			</div>
		</div>
	);
}
