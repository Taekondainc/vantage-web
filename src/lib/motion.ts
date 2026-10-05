export const easeOut = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
} as const;

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
} as const;

export const hoverLift = { y: -4 } as const;
export const tapScale = { scale: 0.98 } as const;
