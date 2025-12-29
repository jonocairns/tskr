"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export const PageTransition = ({ children }: { children: React.ReactNode }) => {
	const pathname = usePathname();
	const prefersReducedMotion = useReducedMotion();
	const distance = prefersReducedMotion ? 0 : 8;
	const duration = prefersReducedMotion ? 0.01 : 0.1;

	return (
		<motion.div
			key={pathname}
			initial={{ opacity: 0, y: distance }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration, ease: "easeOut" }}
		>
			{children}
		</motion.div>
	);
};
