import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@repo/ui/sonner";
import { cn } from "@repo/ui/lib/utils";
import { ReactQueryProvider } from "@/components/providers/ReactQueryProvider";
import { MockPanel } from "@/components/MockPanel";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL, THEME_COLOR } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

/**
 * App metadata. Pages set `title` and get "%s | Saji". The app sits behind sign-in, so robots.ts
 * keeps it out of search; links shared from it still get the social card.
 */
export const metadata: Metadata = {
	metadataBase: SITE_URL,
	title: { default: TITLE, template: `%s | ${SITE_NAME}` },
	description: SITE_DESCRIPTION,
	applicationName: SITE_NAME,
	authors: [{ name: SITE_NAME }],
	creator: SITE_NAME,
	// Amounts, dates and wallet addresses must not turn into tap-to-call or map links.
	formatDetection: { telephone: false, email: false, address: false, date: false },
	robots: { index: false, follow: false },
	openGraph: {
		type: "website",
		siteName: SITE_NAME,
		title: TITLE,
		description: SITE_DESCRIPTION,
		images: [{ url: "/images/link-preview.png", width: 1200, height: 630, alt: SITE_NAME }],
	},
	twitter: { card: "summary_large_image", title: TITLE, description: SITE_DESCRIPTION, images: ["/images/link-preview.png"] },
	icons: { icon: "/favicon.ico", shortcut: "/images/logos/favicon-16x16.png", apple: "/images/logos/apple-touch-icon.png" },
};

export const viewport: Viewport = {
	themeColor: THEME_COLOR,
	// Shrink the layout viewport when the keyboard opens instead of covering inputs.
	interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		// suppressHydrationWarning: browser extensions inject attributes on <html>/<body> before React hydrates.
		<html lang="en" className={cn("antialiased", dmSans.variable)} suppressHydrationWarning>
			<body className="min-h-full" suppressHydrationWarning>
				<ReactQueryProvider>
					{children}
					<MockPanel />
				</ReactQueryProvider>
				<Toaster />
				<Analytics />
			</body>
		</html>
	);
}
