import {
  AlertTriangle,
  DollarSign,
  FileText,
  Search,
  Shield
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  HelpQuickLinks,
  HelpSupportOptions,
} from "@/components/patterns/help";
import { SectionIntro } from "@/components/patterns/section-intro";
import { Input } from "@/components/ui/input";

const quickLinks = [
  {
    icon: FileText,
    label: "Upload workspaces",
    description: "Start a workspace with contracts, briefs, or pasted emails.",
    accent: "text-[#1E6A4E]"
  },
  {
    icon: AlertTriangle,
    label: "Conflict warnings",
    description: "Understand category overlap, timing conflicts, and restrictions.",
    accent: "text-[#D76742]"
  },
  {
    icon: DollarSign,
    label: "Payment tracking",
    description: "Review payout terms, invoice status, and follow-up timing.",
    accent: "text-[#1E6A4E]"
  },
  {
    icon: Shield,
    label: "Privacy & security",
    description: "Review how uploaded partnership materials are stored and handled.",
    accent: "text-[#A56A2A]"
  }
];

const faqs = [
  {
    q: "What file formats do you support?",
    a: "You can upload PDFs, DOCX files, RTF, TXT, EML, MSG, PPT, PPTX, XLS, and XLSX files. You can also paste raw email threads, contract text, and brief content directly into a workspace."
  },
  {
    q: "Can I combine uploaded files and pasted text in one workspace?",
    a: "Yes. A workspace can include contracts, briefs, invoices, decks, and pasted email context together before analysis starts. The analysis queue then processes each workspace one at a time."
  },
  {
    q: "Does HelloBrand provide legal advice?",
    a: "No. HelloBrand helps you understand creator partnership terms, spot risks, and draft better responses, but it is not a law firm and does not replace legal counsel."
  },
  {
    q: "How do conflict warnings work?",
    a: "HelloBrand compares active partnerships across category, exclusivity language, timing windows, and competitor restrictions. Warnings appear on the dashboard, during intake review, and inside each partnership workspace."
  },
  {
    q: "What happens if contract processing fails?",
    a: "You can retry the intake, upload a cleaner source, or continue editing the normalized intake manually. The review screen keeps the extracted structure visible so you can recover without restarting everything."
  },
  {
    q: "How do payment reminders work?",
    a: "Each workspace tracks one primary payout in the current version. HelloBrand shows invoice state, due timing, and late payment status so you can follow up with the right context."
  },
  {
    q: "Can I update a workspace after it has been created?",
    a: "Yes. You can upload more supporting documents to an existing partnership workspace, and the app will use them to improve context, summaries, and warnings without requiring a new workspace."
  },
  {
    q: "Can I delete a partnership or intake?",
    a: "Yes. Draft intakes can be deleted before confirmation, and confirmed partnerships can be deleted from the workspace or partnership list. Deletion removes uploaded materials and related derived data for that partnership."
  }
];

export default function HelpPage() {
  return (
    <div className="px-8 py-10 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="space-y-6">
          <SectionIntro
            title="How can we help?"
            description="Search the knowledge base or browse the common areas creators use most while managing workspaces."
            titleClassName="text-5xl tracking-[-0.06em]"
            descriptionClassName="max-w-2xl text-lg"
          />

          <div className="relative max-w-3xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              className="h-11 border-black/10 bg-white pl-10 shadow-none dark:border-white/10 dark:bg-[#161a1f]"
            />
          </div>
        </section>

        <HelpQuickLinks items={quickLinks} />

        <section className="space-y-5">
          <SectionIntro
            title="Frequently Asked Questions"
            description="The questions below cover the current product behavior and the workflows already live in the app."
          />

          <div className="border border-black/8 bg-white dark:border-white/10 dark:bg-[#161a1f]">
            <Accordion type="single" collapsible>
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.q}
                  value={`faq-${index}`}
                  className="border-b border-black/8 px-5 last:border-b-0 dark:border-white/10"
                >
                  <AccordionTrigger className="py-5 text-left text-[15px] font-medium text-foreground hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                      {faq.a}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t border-black/8 pt-10 dark:border-white/10">
          <SectionIntro
            title="Get in Touch"
            description="Use support if the workspace flow is blocked, a document is not parsing correctly, or you need help recovering a partnership."
          />

          <HelpSupportOptions />
        </section>
      </div>
    </div>
  );
}
