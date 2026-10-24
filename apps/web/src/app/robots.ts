import type { MetadataRoute } from "next";

/** The app sits behind sign-in: keep every page out of search (the landing site is the public face). */
export default function robots(): MetadataRoute.Robots {
	return { rules: { userAgent: "*", disallow: "/" } };
}
