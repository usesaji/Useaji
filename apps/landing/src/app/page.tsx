import { About } from "@/features/landing/components/About";
import { Cta } from "@/features/landing/components/Cta";
import { Faq } from "@/features/landing/components/Faq";
import { Footer } from "@/features/landing/components/Footer";
import { Header } from "@/features/landing/components/Header";
import { Hero } from "@/features/landing/components/Hero";
import { RevealObserver } from "@repo/ui/reveal-observer";

export default function Home() {
	return (
		<div className="pt-24 sm:pt-32">
			<Header />
			<Hero />
			<About />
			<Faq />
			<Cta />
			<Footer />
			<RevealObserver />
		</div>
	);
}
