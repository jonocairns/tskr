"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export const PageTransition = ({ children }: { children: React.ReactNode }) => {
	const pathname = usePathname();
	const prefersReducedMotion = useReducedMotion();
	const duration = prefersReducedMotion ? 0 : 0.09;

	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={pathname}
				initial={{ opacity: 0, filter: "blur(5px)" }}
				animate={{ opacity: 1, filter: "blur(0px)" }}
				transition={{ duration, ease: "easeOut" }}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
};
