import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME, THEME_COLOR, withBasePath } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: SITE_NAME,
		short_name: SITE_NAME,
		description: SITE_DESCRIPTION,
		start_url: withBasePath("/overview"),
		scope: withBasePath("/"),
		display: "standalone",
		background_color: "#ffffff",
		theme_color: THEME_COLOR,
		icons: [
			{ src: withBasePath("/images/logos/android-chrome-192x192.png"), sizes: "192x192", type: "image/png" },
			{ src: withBasePath("/images/logos/android-chrome-512x512.png"), sizes: "512x512", type: "image/png" },
		],
	};
}
