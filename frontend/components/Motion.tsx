"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import { usePathname } from "next/navigation";

// Shared Framer Motion helpers — one place for the whole app's motion
// language: soft fade-up entrances, staggered groups, hover lift,
// ambient drifting glow orbs, and count-up numbers.

// --- Variants ---------------------------------------------------------------

export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

// --- Group + item -----------------------------------------------------------

/** Parent that staggers its <Item> children on mount. */
export function Stagger({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" style={style}>
      {children}
    </motion.div>
  );
}

/** One staggered child — fades up when its <Stagger> parent mounts. */
export function Item({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <motion.div variants={fadeUp} style={style}>
      {children}
    </motion.div>
  );
}

// --- Page transition ---------------------------------------------------------

/** Fade + slide between dashboard pages (keyed on the route). */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// --- Hover lift ---------------------------------------------------------------

/** Gentle lift on hover + press on tap, for cards and buttons. */
export function Lift({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// --- Count-up number ----------------------------------------------------------

/** Counts 0 -> value on mount (dashboard stat cards). */
export function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);
  return <>{display}</>;
}

// --- Ambient background orbs --------------------------------------------------

const ORBS = [
  {
    top: "-12%",
    left: "-6%",
    size: 480,
    background:
      "radial-gradient(circle, rgba(99,102,241,0.75) 0%, rgba(99,102,241,0) 65%)",
    opacity: 1,
    delay: 0,
  },
  {
    bottom: "-18%",
    right: "6%",
    size: 540,
    background:
      "radial-gradient(circle, rgba(217,70,239,0.65) 0%, rgba(217,70,239,0) 65%)",
    opacity: 1,
    delay: 2.5,
  },
  {
    top: "32%",
    right: "-10%",
    size: 340,
    background:
      "radial-gradient(circle, rgba(34,211,238,0.55) 0%, rgba(34,211,238,0) 65%)",
    opacity: 1,
    delay: 5,
  },
  {
    bottom: "8%",
    left: "28%",
    size: 280,
    background:
      "radial-gradient(circle, rgba(139,92,246,0.6) 0%, rgba(139,92,246,0) 65%)",
    opacity: 1,
    delay: 1.2,
  },
];

/**
 * Drifting neon glow orbs, absolutely positioned behind the content.
 * `subtle` turns the opacity way down for the app shell, where the orbs
 * are ambient background only; full strength on the auth pages.
 */
export function FloatingOrbs({ subtle = false }: { subtle?: boolean }) {
  return (
    <>
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            top: orb.top,
            bottom: orb.bottom,
            left: orb.left,
            right: orb.right,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: orb.background,
            filter: "blur(70px)",
            pointerEvents: "none",
            opacity: subtle ? 0.35 : 1,
          }}
          animate={{ x: [0, 24, 0], y: [0, -28, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
        />
      ))}
    </>
  );
}
