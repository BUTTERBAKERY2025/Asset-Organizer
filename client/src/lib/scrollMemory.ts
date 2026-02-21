const scrollPositions = new Map<string, number>();

export function saveScrollPosition(route: string, position: number) {
  scrollPositions.set(route, position);
}

export function getScrollPosition(route: string): number {
  return scrollPositions.get(route) || 0;
}
