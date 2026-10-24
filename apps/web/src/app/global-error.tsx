"use client";

import { DM_Sans } from "next/font/google";
import { useEffect } from "react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { cn } from "@repo/ui/lib/utils";
import { ErrorState } from "@/components/ErrorState";
import { LANDING_URL } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<html lang="en" className={cn("antialiased", dmSans.variable)}>
			<body className="min-h-full">
				<ErrorState
					icon={<HiOutlineExclamationTriangle />}
					code="ERROR"
					heading="Something Went Wrong"
					description="A critical error occurred and the app couldn't load. Please try again."
					primaryAction={{ label: "Try Again", onClick: retry }}
					secondaryAction={{ label: "Visit Homepage", href: LANDING_URL }}
				/>
			</body>
		</html>
	);
}
