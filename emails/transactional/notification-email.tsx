/**
 * This file defines the shared notification email template in React Email.
 * It keeps workspace, inbox, and payment notification rendering in one reusable template.
 */
import { Link } from "react-email";

import {
  EmailButton,
  EmailContent,
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
  headline: string;
  body: string;
  ctaLabel: string;
  href: string;
  settingsHref: string;
  variant: EmailStatusVariant;
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
        <EmailTitle>{input.headline}</EmailTitle>
        <EmailText>{input.body}</EmailText>
        <EmailButton href={input.href}>{input.ctaLabel}</EmailButton>
      </EmailContent>
    </EmailShell>
  );
}

NotificationEmailTemplate.PreviewProps = {
  preview: "Final posting milestone is today. Generate the invoice now in HelloBrand.",
  headline: "Generate your invoice",
  body: "Summer Campaign reached its final posting milestone today. Generate the invoice now so it is ready to send and track in your workspace.",
  ctaLabel: "Generate invoice",
  href: "http://localhost:3011/app/p/deal_123?tab=invoices",
  settingsHref: "http://localhost:3011/app/settings/notifications",
  variant: "warning",
} satisfies NotificationEmailTemplateProps;
