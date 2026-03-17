import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  DollarSign,
  FileText,
  Mail,
  MessageCircle,
  Search,
  Shield
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
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
    description: "Review how uploaded deal materials are stored and handled.",
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
    a: "No. HelloBrand helps you understand creator deal terms, spot risks, and draft better responses, but it is not a law firm and does not replace legal counsel."
  },
  {
    q: "How do conflict warnings work?",
    a: "HelloBrand compares active deals across category, exclusivity language, timing windows, and competitor restrictions. Warnings appear on the dashboard, during intake review, and inside each deal workspace."
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
    a: "Yes. You can upload more supporting documents to an existing deal workspace, and the app will use them to improve context, summaries, and warnings without requiring a new workspace."
  },
  {
    q: "Can I delete a deal or intake?",
    a: "Yes. Draft intakes can be deleted before confirmation, and confirmed deals can be deleted from the workspace or deal list. Deletion removes uploaded materials and related derived data for that deal."
  }
];

export default function HelpPage() {
  return (
    <div className="px-8 py-10 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl space-y-10">
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-semibold tracking-[-0.06em] text-foreground">
              How can we help?
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Search the knowledge base or browse the common areas creators use
              most while managing workspaces.
            </p>
          </div>

          <div className="relative max-w-3xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              className="h-11 border-black/10 bg-white pl-10 shadow-none dark:border-white/10 dark:bg-[#161a1f]"
            />
          </div>
        </section>

        <section className="grid gap-px overflow-hidden border border-black/8 bg-black/8 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10 dark:bg-white/10">
          {quickLinks.map((item) => (
            <div
              key={item.label}
              className="bg-white px-5 py-5 transition-colors hover:bg-secondary/30 dark:bg-[#161a1f] dark:hover:bg-white/[0.03]"
            >
              <item.icon className={`mb-3 h-5 w-5 ${item.accent}`} />
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-muted-foreground">
              The questions below cover the current product behavior and the
              workflows already live in the app.
            </p>
          </div>

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
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Get in Touch
            </h2>
            <p className="text-sm text-muted-foreground">
              Use support if the workspace flow is blocked, a document is not
              parsing correctly, or you need help recovering a deal.
            </p>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden border border-black/8 bg-black/8 md:grid-cols-2 dark:border-white/10 dark:bg-white/10">
            <div className="bg-white px-6 py-6 dark:bg-[#161a1f]">
              <MessageCircle className="mb-3 h-5 w-5 text-[#1E6A4E]" />
              <h3 className="text-base font-medium text-foreground">Live Chat</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use live support for workspace issues, upload failures, or deal
                review questions.
              </p>
              <Button className="mt-5 w-full sm:w-auto">Start Chat</Button>
            </div>

            <div className="bg-white px-6 py-6 dark:bg-[#161a1f]">
              <Mail className="mb-3 h-5 w-5 text-[#D76742]" />
              <h3 className="text-base font-medium text-foreground">Email Support</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                For longer questions, account issues, or follow-up context, send
                the team an email and expect a response within one business day.
              </p>
              <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
                <a href="mailto:support@hellobrand.com">Send Email</a>
              </Button>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-4 border-t border-black/8 pt-6 dark:border-white/10">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-[#1E6A4E]" />
            <div className="space-y-3">
              <div>
                <h3 className="text-base font-medium text-foreground">
                  Creator Resources
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Review guides on deal negotiations, creator risk review,
                  contract language, and payment follow-up templates.
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/pricing">Visit Resources</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
