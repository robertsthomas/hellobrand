import type { Metadata } from "next";

import { MarketingNav } from "@/components/marketing-nav";

export const metadata: Metadata = {
  title: "Privacy Policy | HelloBrand",
  description: "How HelloBrand collects, uses, and protects user data."
};

const sections = [
  {
    title: "What HelloBrand does",
    body: [
      "HelloBrand helps creators manage brand partnerships by organizing contracts, email conversations, payment tracking, deliverables, and related workflow context in one workspace.",
      "When a user chooses to connect an email account, HelloBrand uses that connection to help identify deal-related conversations, display linked threads, and surface relevant workflow updates such as approvals, deliverables, payment mentions, rights language, and attachment changes."
    ]
  },
  {
    title: "Information we collect",
    body: [
      "We collect information that users provide directly, such as account details, profile information, uploaded documents, workspace content, and connected email account settings.",
      "If a user connects an email provider, we may process message metadata and content needed to support the requested feature, including sender and recipient addresses, subject lines, snippets, message body content, timestamps, and attachment metadata. Where relevant to the feature, we may also process attachment text and related extracted summaries."
    ]
  },
  {
    title: "How we use information",
    body: [
      "We use information to operate HelloBrand, including authenticating users, maintaining workspaces, organizing deal communications, generating summaries and drafting assistance, surfacing workflow alerts, and improving the reliability and security of the service.",
      "Email-connected data is used only to provide user-requested product functionality. We do not use connected mailbox data to create advertising audiences or targeting segments."
    ]
  },
  {
    title: "Data sharing",
    body: [
      "We do not sell personal information or connected mailbox data. We do not share mailbox data with advertisers or data brokers.",
      "We may use service providers and infrastructure partners to host the application, store encrypted data, deliver product emails, and power product features such as AI-assisted summaries and workflow suggestions. Those providers act only on our behalf and only as necessary to operate the service."
    ]
  },
  {
    title: "Retention and controls",
    body: [
      "We retain information for as long as needed to provide the service, comply with legal obligations, resolve disputes, and enforce our agreements. Users can disconnect supported email accounts, and we limit access to mailbox data to the authorized user and the systems required to provide the feature.",
      "We may retain logs and operational records for security, reliability, fraud prevention, and compliance purposes."
    ]
  },
  {
    title: "Security",
    body: [
      "We take reasonable measures to protect user data, including access controls, encrypted storage for sensitive credentials, and controls designed to reduce unauthorized access or disclosure.",
      "No method of transmission or storage is completely secure, so we cannot guarantee absolute security."
    ]
  },
  {
    title: "User choices and rights",
    body: [
      "Depending on where a user lives, they may have rights related to access, correction, deletion, or restriction of personal information. We aim to honor applicable privacy rights under relevant laws.",
      "Users may also disconnect third-party integrations at any time through the product where supported."
    ]
  },
  {
    title: "Children",
    body: [
      "HelloBrand is not intended for children under 13, and we do not knowingly collect personal information from children under 13."
    ]
  },
  {
    title: "Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. If we make material changes, we may update the effective date and provide additional notice where appropriate."
    ]
  },
  {
    title: "Contact",
    body: [
      "For privacy-related questions or requests, please use the contact or support information made available through HelloBrand."
    ]
  }
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fefcfa] text-foreground dark:bg-[#0f1115]">
      <MarketingNav />

      <main className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/70 dark:text-[#8ec6b1]/80">
              Legal
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] text-[#1a2634] sm:text-5xl dark:text-[#eef2f5]">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-[#5d6876] sm:text-base dark:text-[#aab3bf]">
              Effective date: March 25, 2026
            </p>
            <p className="mt-6 max-w-3xl text-[0.98rem] leading-relaxed text-[#5d6876] dark:text-[#aab3bf]">
              This Privacy Policy describes how HelloBrand collects, uses, stores, and
              protects information when people use the HelloBrand product and related
              services.
            </p>
          </div>

          <div className="mt-12 space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="border-t border-black/8 pt-8 dark:border-white/10">
                <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-[0.98rem] leading-8 text-[#4f5967] dark:text-[#aab3bf]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
