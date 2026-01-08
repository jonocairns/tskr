import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

export const PageTransition = ({ children }: { children: React.ReactNode }) => {
	const locationKey = useRouterState({ select: (s) => s.location.href });
	const prefersReducedMotion = useReducedMotion();
	const duration = prefersReducedMotion ? 0 : 0.1;

	return (
		<AnimatePresence mode="wait">
			<motion.div
				key={locationKey}
				initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 8 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -8 }}
				transition={{ duration, ease: "easeOut" }}
			>
				{children}
			</motion.div>
		</AnimatePresence>
	);
};
