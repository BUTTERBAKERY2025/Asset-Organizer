import * as React from "react"

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS
export type DeviceType = "mobile" | "tablet" | "laptop" | "desktop"

const MOBILE_BREAKPOINT = BREAKPOINTS.md
const TABLET_BREAKPOINT = BREAKPOINTS.lg
const DESKTOP_BREAKPOINT = BREAKPOINTS.xl

function subscribe(query: string, cb: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener("change", cb)
  return () => mql.removeEventListener("change", cb)
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  React.useEffect(() => {
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onChange()
    return subscribe(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`, onChange)
  }, [])
  return isMobile
}

/** Tablet/iPad portrait range: 768px – 1023px */
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    const w = window.innerWidth
    return w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT
  })
  React.useEffect(() => {
    const onChange = () => {
      const w = window.innerWidth
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT)
    }
    onChange()
    return subscribe(
      `(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`,
      onChange
    )
  }, [])
  return isTablet
}

/** Returns true on mobile + tablet (anything below the persistent-sidebar breakpoint). */
export function useIsCompact() {
  const [isCompact, setIsCompact] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < TABLET_BREAKPOINT : false
  )
  React.useEffect(() => {
    const onChange = () => setIsCompact(window.innerWidth < TABLET_BREAKPOINT)
    onChange()
    return subscribe(`(max-width: ${TABLET_BREAKPOINT - 1}px)`, onChange)
  }, [])
  return isCompact
}

export function useDeviceType(): DeviceType {
  const [device, setDevice] = React.useState<DeviceType>(() => {
    if (typeof window === "undefined") return "desktop"
    const w = window.innerWidth
    if (w < MOBILE_BREAKPOINT) return "mobile"
    if (w < TABLET_BREAKPOINT) return "tablet"
    if (w < DESKTOP_BREAKPOINT) return "laptop"
    return "desktop"
  })
  React.useEffect(() => {
    const compute = () => {
      const w = window.innerWidth
      if (w < MOBILE_BREAKPOINT) return "mobile"
      if (w < TABLET_BREAKPOINT) return "tablet"
      if (w < DESKTOP_BREAKPOINT) return "laptop"
      return "desktop"
    }
    const onChange = () => setDevice(compute())
    onChange()
    window.addEventListener("resize", onChange)
    return () => window.removeEventListener("resize", onChange)
  }, [])
  return device
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  )
  React.useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])
  return matches
}
