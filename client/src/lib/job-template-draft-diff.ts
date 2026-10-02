import type { TemplateContent } from "@/hooks/use-job-template-drafts";

export function permissionDiff(before: TemplateContent, after: TemplateContent) {
  const flatten = (content: TemplateContent) => new Set(content.permissions.flatMap(
    permission => permission.actions.map(action => `${permission.module}:${action}`),
  ));
  const old = flatten(before);
  const next = flatten(after);
  return {
    added: Array.from(next).filter(permission => !old.has(permission)).sort(),
    removed: Array.from(old).filter(permission => !next.has(permission)).sort(),
  };
}