import { useEffect, useRef } from "react";
import { ChevronDown, Truck, Receipt, UsersRound, Wrench } from "lucide-react";
import { PlatformAppIcon, type SemanticColor } from "@/components/platform-app-icon";
import { OperationCardView, SECTIONS, groupCards, type OperationCard, type SectionMeta } from "./presentation";

type WorkGroup = SectionMeta & { color: SemanticColor };

export const WORK_GROUPS: readonly WorkGroup[] = [
  { ...SECTIONS[0], label: "التوريد والاستلام", hint: "طلبات المطبخ والمستودع والمشتريات", icon: Truck, color: "inventory", cardIds: ["kitchen", "warehouse", "purchasing"] },
  { ...SECTIONS[1], label: "المبيعات وإغلاق اليوم", hint: "اليوميات والمبيعات والأهداف والإغلاق", icon: Receipt, color: "money", cardIds: ["cashier", "sales", "targets", "closing"] },
  { ...SECTIONS[3], label: "الموظفون والوردية", hint: "الحضور والفريق والوثائق والسلف", icon: UsersRound, color: "people", cardIds: ["attendance", "employees", "documents", "advances"] },
  { ...SECTIONS[2], label: "متابعة الفرع", hint: "الشكاوى والصيانة والهدر", icon: Wrench, color: "projects", cardIds: ["complaints", "maintenance", "waste"] },
];

export function groupWorkPages(cards: OperationCard[]) {
  return groupCards(cards, WORK_GROUPS);
}

function WorkGroupDisclosure({ section, cards, expandedCardId, onToggle, onOpen, onRefresh }: {
  section: SectionMeta; cards: OperationCard[]; expandedCardId: string | null;
  onToggle: (id: string) => void; onOpen: (href: string) => void; onRefresh: () => void;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const containsExpanded = cards.some(card => card.id === expandedCardId);
  useEffect(() => {
    // Keep controlled metric expansion visible after a return/restore. Native
    // disclosure state remains user-owned; toggling a group never navigates.
    if (containsExpanded && disclosure.current) disclosure.current.open = true;
  }, [containsExpanded, expandedCardId]);
  const color = WORK_GROUPS.find(group => group.id === section.id)!.color;
  return <details ref={disclosure} className="branch-desk-disclosure branch-ops-work-group" data-testid={`branch-operations-section-${section.id}`}>
    <summary className="branch-ops-group-summary" id={`branch-ops-${section.id}`}>
      <PlatformAppIcon icon={section.icon} color={color} />
      <span className="branch-ops-group-copy"><span className="branch-ops-group-title">{section.label}</span><span className="branch-ops-group-hint">{section.hint}</span></span>
      <span className="branch-ops-group-count" aria-label={`${cards.length} صفحات مسموحة`}>{cards.length.toLocaleString("en-US")} صفحات</span>
      <ChevronDown className="branch-ops-group-chevron" aria-hidden="true" />
    </summary>
    <div className="branch-ops-group-rows">{cards.map(card => <OperationCardView
      key={card.id} card={card} section={section} variant="row"
      onOpen={onOpen} onRefresh={onRefresh} expanded={expandedCardId === card.id}
      onToggle={() => onToggle(card.id)}
    />)}</div>
  </details>;
}

export function WorkGroups({ cards, expandedCardId, onToggle, onOpen, onRefresh }: {
  cards: OperationCard[]; expandedCardId: string | null;
  onToggle: (id: string) => void; onOpen: (href: string) => void; onRefresh: () => void;
}) {
  return <div className="branch-ops-work-groups">{groupWorkPages(cards).map(({ section, cards: items }) => <WorkGroupDisclosure
    key={section.id} section={section} cards={items} expandedCardId={expandedCardId}
    onToggle={onToggle} onOpen={onOpen} onRefresh={onRefresh}
  />)}</div>;
}