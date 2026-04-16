import { AlertTriangle, DollarSign, FileText, Search, Shield } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpQuickLinks, HelpSupportOptions } from "@/components/patterns/help";
import { SectionIntro } from "@/components/patterns/section-intro";
import { Input } from "@/components/ui/input";

const quickLinks = [
  {
    icon: FileText,
    label: "Upload workspaces",
    description: "Start a workspace with contracts, briefs, or pasted emails.",
    accent: "text-[#1E6A4E]",
  },
  {
    icon: AlertTriangle,
    label: "Conflict warnings",
    description: "Understand category overlap, timing conflicts, and restrictions.",
    accent: "text-[#D76742]",
  },
  {
    icon: DollarSign,
    label: "Payment tracking",
    description: "Review payout terms, invoice status, and follow-up timing.",
    accent: "text-[#1E6A4E]",
  },
  {
    icon: Shield,
    label: "Privacy & security",
    description: "Review how uploaded partnership materials are stored and handled.",
    accent: "text-[#A56A2A]",
  },
];

const faqs = [
  {
    q: "What file formats can I upload?",
    a: "You can upload PDF, DOC, DOCX, RTF, TXT, EML, MSG, PPT, PPTX, XLS, and XLSX files. You can also paste raw email threads or contract text directly into a workspace instead of uploading a file.",
  },
  {
    q: "What is a workspace?",
    a: "A workspace represents a single brand partnership. You create one by uploading or pasting partnership documents through the intake flow. Each workspace holds the extracted contract terms, deliverables, risk flags, payment details, and any supporting documents you've attached.",
  },
  {
    q: "What happens after I upload documents?",
    a: "HelloBrand extracts text, classifies the document type, pulls out structured fields like payment terms and deliverables, runs risk analysis, checks for conflicts with your other partnerships, and builds a plain-language summary. You then review and confirm the extracted data before the workspace is created.",
  },
  {
    q: "How do conflict warnings work?",
    a: "HelloBrand compares your active partnerships across four dimensions: brand category overlap, competitor restrictions, exclusivity timing, and deliverable schedule collisions. Warnings appear on the dashboard, during intake review, and inside each partnership workspace.",
  },
  {
    q: "What does the AI assistant do?",
    a: "The assistant answers questions about your partnerships, drafts email replies for negotiations and follow-ups, and helps you navigate the app. It has context about the workspace you're viewing, including terms, risk flags, and deliverables. Usage limits depend on your plan.",
  },
  {
    q: "Can I add more documents to an existing workspace?",
    a: "Yes. You can upload additional documents to any existing partnership workspace. The app will re-analyze them and update context, summaries, and risk flags without creating a new workspace.",
  },
  {
    q: "How does payment tracking work?",
    a: "Each workspace tracks payment status, amount, due date, and currency. The Payments page shows all outstanding and completed payouts across your portfolio. You can also generate invoices from workspace deliverables and download them as PDFs.",
  },
  {
    q: "What does search cover?",
    a: "Global search looks across all your partnerships, matching brand names, campaign names, contract terms, document content, risk flags, summaries, and individual document sections. Results are ranked by relevance.",
  },
  {
    q: "Can I delete a partnership?",
    a: "Yes. Draft intakes can be deleted before confirmation. Confirmed partnerships can be deleted from the workspace or partnership list. Deletion removes uploaded materials and all derived data for that partnership.",
  },
  {
    q: "Does HelloBrand provide legal advice?",
    a: "No. HelloBrand helps you understand partnership terms, spot risks, and draft better responses, but it is not a law firm and does not replace legal counsel.",
  },
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
                    <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{faq.a}</p>
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
