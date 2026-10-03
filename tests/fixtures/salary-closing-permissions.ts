export function usePermissions() {
  const allow = () => true;
  return {
    canEdit: allow, canView: allow, canCreate: allow, canDelete: allow,
    canApprove: allow, canExport: allow, isAdmin: true, isLoading: false,
  };
}