"use client";

import { useEffect } from "react";
import { Logo } from "@repo/ui/logo";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);
	return (
		<div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
			<Logo className="mb-8" />
			<h1 className="text-xl font-semibold md:text-3xl">Something Went Wrong</h1>
			<p className="mt-3 max-w-sm text-sm font-light text-ink-muted">This page hit an unexpected error.</p>
			<button type="button" onClick={retry} className="mt-8 rounded-full bg-primary px-6 py-3 text-sm text-white">
				Try Again
			</button>
		</div>
	);
}
