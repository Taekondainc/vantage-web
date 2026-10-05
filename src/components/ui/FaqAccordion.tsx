import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export function FaqAccordion({
  items,
}: {
  items: { q: string; a: string }[];
}) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-border rounded-[12px] border border-border bg-surface">
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`item-${i}`} className="px-4 md:px-5">
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold text-fg outline-none">
              {item.q}
              <ChevronDown
                size={18}
                className="shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-out data-[state=open]:animate-in">
            <p className={cn("pb-4 text-[15px] leading-relaxed text-muted")}>{item.a}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
