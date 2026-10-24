import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { cn } from "@repo/ui/lib/utils";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
	metadataBase: SITE_URL,
	title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
	description: SITE_DESCRIPTION,
	keywords: ["Saji", "savings platform", "group savings", "ajo", "esusu", "thrift savings", "community savings", "rotational savings", "Stellar", "USDC"],
	authors: [{ name: SITE_NAME }],
	creator: SITE_NAME,
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: SITE_NAME,
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		images: [{ url: "/images/link-preview.png", width: 1200, height: 630, alt: SITE_NAME }],
	},
	twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/images/link-preview.png"] },
	robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
	icons: { icon: "/favicon.ico", shortcut: "/images/logos/favicon-16x16.png", apple: "/images/logos/apple-touch-icon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={cn("antialiased", dmSans.variable)} suppressHydrationWarning>
			<head>
				{/* Without JS nothing reveals the `data-reveal` sections; show them as they are. */}
				<noscript>
					<style>{"[data-reveal]{opacity:1;transform:none}"}</style>
				</noscript>
			</head>
			<body className="min-h-full" suppressHydrationWarning>
				{children}
				<Analytics />
			</body>
		</html>
	);
}
