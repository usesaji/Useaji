"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const SLIDES = [
	{ img: "/images/auth/esusu.svg", title: "Esusu evolved.", text: "The traditional way, with a digital guarantee." },
	{ img: "/images/auth/group-savings.svg", title: "Save with your people.", text: "Your group. Your rules. Everyone accountable." },
	{ img: "/images/auth/hands-n-money.svg", title: "Your Ajo, now on-chain.", text: "Save together. Get paid automatically." },
];

/** The sign-up illustrations, cross-fading every 3 s. */
export function PicSlide() {
	const [current, setCurrent] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setCurrent((prev) => (prev + 1) % SLIDES.length), 3000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="relative h-70 overflow-hidden sm:h-105 lg:h-130">
			{SLIDES.map((slide, index) => (
				<div
					key={slide.img}
					aria-hidden={current !== index}
					className={`absolute inset-0 flex flex-col transition-opacity duration-1000 ${current === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
				>
					<div className="mb-8 font-light text-black md:text-center lg:order-2 lg:mt-5">
						<h2 className="text-[28px] lg:text-[36px]">{slide.title}</h2>
						<p className="text-sm lg:text-base">{slide.text}</p>
					</div>
					<div className="relative flex-1">
						<Image src={slide.img} alt="" loading="eager" fill className="object-contain" />
					</div>
				</div>
			))}
		</div>
	);
}
