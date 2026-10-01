/** No cookies, app session storage or backend return-state records are read/written. */
export const captureBranchDeskReturn = (_userId: string, _branchId: string, destination: string) => destination;
export const resolveBranchDeskReturnForCurrentSession = (..._args: unknown[]): { token: string } | null => null;
export const restoreBranchDeskScroll = (_state: unknown) => {};