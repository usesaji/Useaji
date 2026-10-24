import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Toaster } from "@repo/ui/sonner";
import { cn } from "@repo/ui/lib/utils";
import { MockPanel } from "@/components/MockPanel";
import { Providers } from "@/components/Providers";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
	title: { default: "Saji Admin", template: "%s | Saji Admin" },
	description: "Saji's admin console.",
	robots: { index: false, follow: false },
	icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={cn("antialiased", dmSans.variable)} suppressHydrationWarning>
			<body className="min-h-full" suppressHydrationWarning>
				<Providers>
					{children}
					<MockPanel />
				</Providers>
				<Toaster />
			</body>
		</html>
	);
}
