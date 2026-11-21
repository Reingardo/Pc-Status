import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

/** Número que se desliza suavemente hacia su nuevo valor. */
export function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const spring = useSpring(value, { stiffness: 80, damping: 20 });
  const text = useTransform(spring, (v) => v.toFixed(digits));
  useEffect(() => spring.set(value), [spring, value]);
  return <motion.span>{text}</motion.span>;
}
