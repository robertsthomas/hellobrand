/**
 * This file defines the transactional welcome email template in React Email.
 * It is the source of truth for previewing locally and uploading the template to Resend.
 */
import { createTranslator } from "next-intl";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

import { resolveEmailLocale, type EmailLocale } from "@/emails/shared/locale";
import { emailMessagesByLocale } from "@/emails/shared/messages";

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

const styles = {
  body: {
    backgroundColor: "#f6f3ee",
    fontFamily: "Arial, sans-serif",
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    border: "1px solid #e7dfd3",
    margin: "0 auto",
    maxWidth: "560px",
    width: "100%",
  },
  section: {
    borderTop: "2px solid #1f1a14",
    padding: "32px",
  },
  heading: {
    color: "#1f1a14",
    fontSize: "24px",
    fontWeight: "700",
    lineHeight: "1.2",
    margin: "0 0 12px",
  },
  bodyText: {
    color: "#4a4034",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  buttonWrap: {
    margin: "0 0 24px",
  },
  button: {
    backgroundColor: "#1f1a14",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "600",
    lineHeight: "1",
    padding: "14px 18px",
    textDecoration: "none",
  },
  finePrint: {
    color: "#7f6f5a",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  },
  link: {
    color: "#7f6f5a",
    textDecoration: "underline",
  },
  closing: {
    color: "#7f6f5a",
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0",
  },
} as const;

export default function WelcomeEmailTemplate(input: WelcomeEmailTemplateProps) {
  const greetingName = resolveGreeting(input.firstName);
  const t = createTranslator({
    locale: input.locale,
    messages: emailMessagesByLocale[input.locale],
    namespace: "emails.welcome",
  });

  return (
    <Html lang={input.locale}>
      <Head />
      <Preview>{t("preview")}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>
            <Heading as="h1" style={styles.heading}>
              {t("heading")}
            </Heading>
            <Text style={styles.bodyText}>
              {greetingName ? t("greetingNamed", { firstName: greetingName }) : t("greetingGeneric")}
            </Text>
            <Text style={styles.bodyText}>{t("intro")}</Text>
            <Text style={styles.bodyText}>{t("firstStep")}</Text>
            <Section style={styles.buttonWrap}>
              <Button href={input.startWorkspaceUrl} style={styles.button}>
                {t("cta")}
              </Button>
            </Section>
            <Text style={styles.finePrint}>
              {t("fallbackLinkLabel")}{" "}
              <Link href={input.startWorkspaceUrl} style={styles.link}>
                {input.startWorkspaceUrl}
              </Link>
            </Text>
            <Text style={styles.closing}>{t("closing")}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

WelcomeEmailTemplate.PreviewProps = {
  firstName: "Taylor",
  locale: resolveEmailLocale("en"),
  startWorkspaceUrl: "http://localhost:3011/app/intake/new",
} satisfies WelcomeEmailTemplateProps;
