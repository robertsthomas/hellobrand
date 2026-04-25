/**
 * This file defines the transactional welcome email template in React Email.
 * It is the source of truth for previewing locally and uploading the template to Resend.
 */
import { createTranslator } from "next-intl";
import { Link } from "react-email";

import { resolveEmailLocale, type EmailLocale } from "@/emails/shared/locale";
import { emailMessagesByLocale } from "@/emails/shared/messages";
import {
  EmailBulletList,
  EmailButton,
  EmailContent,
  EmailHeader,
  EmailShell,
  EmailText,
  EmailTitle,
  emailSharedStyles,
} from "@/emails/shared/components";

export type WelcomeEmailTemplateProps = {
  firstName?: string | null;
  locale: EmailLocale;
  startWorkspaceUrl: string;
};

function normalizeFirstName(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveGreeting(firstName: string | null | undefined) {
  const normalized = normalizeFirstName(firstName);
  return normalized;
}

export default function WelcomeEmailTemplate(input: WelcomeEmailTemplateProps) {
  const greetingName = resolveGreeting(input.firstName);
  const t = createTranslator({
    locale: input.locale,
    messages: emailMessagesByLocale[input.locale],
    namespace: "emails.welcome",
  });

  return (
    <EmailShell lang={input.locale} preview={t("preview")}>
      <EmailHeader />
      <EmailContent>
        <EmailTitle>{t("heading")}</EmailTitle>
        <EmailText>
          {greetingName ? t("greetingNamed", { firstName: greetingName }) : t("greetingGeneric")}
        </EmailText>
        <EmailText>{t("intro")}</EmailText>
        <EmailBulletList
          items={[
            t("workspaceBenefitSummary"),
            t("workspaceBenefitTasks"),
            t("workspaceBenefitInbox"),
          ]}
        />
        <EmailButton href={input.startWorkspaceUrl}>{t("cta")}</EmailButton>
        <EmailText muted>
          {t("fallbackLinkLabel")}{" "}
          <Link href={input.startWorkspaceUrl} style={emailSharedStyles.link}>
            {input.startWorkspaceUrl}
          </Link>
        </EmailText>
        <EmailText muted style={{ margin: 0 }}>
          {t("closing")}
        </EmailText>
      </EmailContent>
    </EmailShell>
  );
}

WelcomeEmailTemplate.PreviewProps = {
  firstName: "Taylor",
  locale: resolveEmailLocale("en"),
  startWorkspaceUrl: "http://localhost:3011/app/intake/new",
} satisfies WelcomeEmailTemplateProps;
