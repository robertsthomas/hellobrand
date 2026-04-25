/**
 * This file defines the shared notification email template in React Email.
 * It keeps workspace, inbox, and payment notification rendering in one reusable template.
 */
import { Link } from "react-email";

import {
  EmailButton,
  EmailContent,
  EmailDetailPanel,
  EmailFooter,
  EmailHeader,
  EmailShell,
  EmailStatusAccent,
  EmailText,
  EmailTitle,
  emailSharedStyles,
  type EmailStatusVariant,
} from "@/emails/shared/components";

export type NotificationEmailTemplateProps = {
  preview: string;
  eyebrow?: string;
  headline: string;
  body: string;
  ctaLabel: string;
  href: string;
  settingsHref: string;
  variant: EmailStatusVariant;
  issueItems?: string[];
  issueMoreCount?: number;
};

export default function NotificationEmailTemplate(input: NotificationEmailTemplateProps) {
  return (
    <EmailShell
      footer={
        <EmailFooter>
          You&apos;re receiving this because you have email notifications enabled in{" "}
          <Link href={input.settingsHref} style={emailSharedStyles.link}>
            HelloBrand
          </Link>
          .
        </EmailFooter>
      }
      preview={input.preview}
    >
      <EmailStatusAccent variant={input.variant} />
      <EmailHeader />
      <EmailContent>
        {input.eyebrow ? (
          <EmailText muted style={{ fontSize: "13px", fontWeight: "700", margin: "0 0 8px" }}>
            {input.eyebrow}
          </EmailText>
        ) : null}
        <EmailTitle>{input.headline}</EmailTitle>
        <EmailText>{input.body}</EmailText>
        {input.issueItems?.length ? (
          <EmailDetailPanel
            rows={[
              ...input.issueItems.slice(0, 3).map((item) => ({ label: "Issue", value: item })),
              ...(input.issueMoreCount && input.issueMoreCount > 0
                ? [{ label: "More", value: `and ${input.issueMoreCount} more` }]
                : []),
            ]}
            title="What needs attention"
            variant={input.variant}
          />
        ) : null}
        <EmailButton href={input.href}>{input.ctaLabel}</EmailButton>
      </EmailContent>
    </EmailShell>
  );
}

NotificationEmailTemplate.PreviewProps = {
  preview: "Final posting milestone is today. Generate the invoice now in HelloBrand.",
  eyebrow: "Action required",
  headline: "Generate your invoice",
  body: "Summer Campaign reached its final posting milestone today. Generate the invoice now so it is ready to send and track in your workspace.",
  ctaLabel: "Generate invoice",
  href: "http://localhost:3011/app/p/deal_123?tab=invoices",
  settingsHref: "http://localhost:3011/app/settings/notifications",
  variant: "warning",
  issueItems: ["Invoice has not been generated yet"],
} satisfies NotificationEmailTemplateProps;
