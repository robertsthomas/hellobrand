/**
 * This file defines the shared notification email template in React Email.
 * It keeps workspace, inbox, and payment notification rendering in one reusable template.
 */
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

export type NotificationEmailTemplateProps = {
  preview: string;
  headline: string;
  body: string;
  ctaLabel: string;
  href: string;
  settingsHref: string;
};

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
    margin: "0 0 24px",
  },
  button: {
    backgroundColor: "#1f1a14",
    color: "#ffffff",
    fontSize: "14px",
    lineHeight: "1",
    padding: "12px 18px",
    textDecoration: "none",
  },
  footer: {
    borderTop: "1px solid #e7dfd3",
    padding: "16px 32px",
  },
  finePrint: {
    color: "#7f6f5a",
    fontSize: "12px",
    lineHeight: "1.5",
    margin: 0,
  },
  link: {
    color: "#7f6f5a",
    textDecoration: "underline",
  },
} as const;

export default function NotificationEmailTemplate(input: NotificationEmailTemplateProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{input.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.section}>
            <Heading as="h1" style={styles.heading}>
              {input.headline}
            </Heading>
            <Text style={styles.bodyText}>{input.body}</Text>
            <Button href={input.href} style={styles.button}>
              {input.ctaLabel}
            </Button>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.finePrint}>
              You&apos;re receiving this because you have email notifications enabled in{" "}
              <Link href={input.settingsHref} style={styles.link}>
                HelloBrand
              </Link>
              .
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

NotificationEmailTemplate.PreviewProps = {
  preview: "Final posting milestone is today. Generate the invoice now in HelloBrand.",
  headline: "Generate your invoice",
  body: "Summer Campaign reached its final posting milestone today. Generate the invoice now so it is ready to send and track in your workspace.",
  ctaLabel: "Generate invoice",
  href: "http://localhost:3011/app/p/deal_123?tab=invoices",
  settingsHref: "http://localhost:3011/app/settings/notifications",
} satisfies NotificationEmailTemplateProps;
