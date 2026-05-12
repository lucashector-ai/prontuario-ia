'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'

type Direction = 'up' | 'down' | 'left' | 'right'

type Props = HTMLMotionProps<'div'> & {
  from?: Direction
  distance?: number
  delay?: number
  duration?: number
}

function offset(dir: Direction, d: number) {
  switch (dir) {
    case 'up':    return { x: 0,  y: d }
    case 'down':  return { x: 0,  y: -d }
    case 'left':  return { x: d,  y: 0 }
    case 'right': return { x: -d, y: 0 }
  }
}

export function SlideIn({ from = 'up', distance = 20, delay = 0, duration = 0.4, children, ...rest }: Props) {
  const off = offset(from, distance)
  return (
    <motion.div
      initial={{ opacity: 0, ...off }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, duration, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
