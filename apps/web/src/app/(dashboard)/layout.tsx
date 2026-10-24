import { Header } from "@/components/layouts/Header";
import { Navbar } from "@/components/layouts/Navbar";
import { RequireSession } from "@/features/auth/components/RequireSession";
import { ReauthDialog } from "@/features/auth/reauth";

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<RequireSession>
			<div className="lg:flex lg:max-h-screen lg:overflow-hidden">
				<div className="max-w-65 lg:flex-4/12 xl:max-w-70">
					<Navbar />
				</div>
				{/* min-w-0: a flex item otherwise grows to its widest child, so a horizontal scroller
				    (a card carousel) would push the whole column past the edge of the screen. */}
				<div className="min-w-0 lg:flex-9/12">
					<Header />
					<main id="main" className="dashboard-custom-container hide-scroll overflow-y-auto bg-white pt-24 md:pt-26 lg:max-h-screen lg:pt-5">
						<div className="min-h-screen pb-32 lg:pb-60">{children}</div>
					</main>
				</div>
			</div>
			<ReauthDialog />
		</RequireSession>
	);
}
