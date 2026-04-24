/**
 * This file provides the shared React Email foundation for HelloBrand transactional emails.
 * Components intentionally use inline, static styles for broad email client compatibility.
 */
import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

import {
  emailColors,
  emailRadii,
  emailSpacing,
  emailStatusColors,
  emailType,
  type EmailStatusVariant,
} from "@/emails/shared/tokens";

type EmailShellProps = {
  children: ReactNode;
  preview: string;
  lang?: string;
  maxWidth?: 600 | 640;
  footer?: ReactNode | false;
};

type EmailTextProps = {
  children: ReactNode;
  muted?: boolean;
  style?: CSSProperties;
};

type EmailButtonProps = {
  children: ReactNode;
  href: string;
  style?: CSSProperties;
};

type EmailFooterProps = {
  children?: ReactNode;
  settingsHref?: string;
  supportHref?: string;
  unsubscribeHref?: string;
};

type EmailDetailPanelRow = {
  label: string;
  value?: ReactNode;
};

type EmailDetailPanelProps = {
  children?: ReactNode;
  rows?: EmailDetailPanelRow[];
  title?: string;
  variant?: EmailStatusVariant;
};

export type { EmailStatusVariant };

const styles = {
  body: {
    backgroundColor: emailColors.canvas,
    fontFamily: emailType.fontFamily,
    margin: 0,
    padding: "32px 0",
  },
  container: {
    backgroundColor: emailColors.surface,
    border: `1px solid ${emailColors.border}`,
    borderRadius: emailRadii.lg,
    margin: "0 auto",
    overflow: "hidden",
    width: "100%",
  },
  header: {
    padding: `${emailSpacing.xl} ${emailSpacing["2xl"]} ${emailSpacing.md}`,
  },
  wordmark: {
    color: emailColors.ink,
    fontSize: emailType.label,
    fontWeight: "700",
    letterSpacing: "0.08em",
    lineHeight: emailType.lineHeight.tight,
    margin: 0,
    textTransform: "uppercase" as const,
  },
  content: {
    padding: `${emailSpacing.lg} ${emailSpacing["2xl"]} ${emailSpacing["2xl"]}`,
  },
  title: {
    color: emailColors.ink,
    fontSize: emailType.title,
    fontWeight: "700",
    lineHeight: emailType.lineHeight.tight,
    margin: `0 0 ${emailSpacing.md}`,
  },
  text: {
    color: emailColors.body,
    fontSize: emailType.body,
    lineHeight: emailType.lineHeight.body,
    margin: `0 0 ${emailSpacing.lg}`,
  },
  mutedText: {
    color: emailColors.muted,
  },
  buttonWrap: {
    margin: `${emailSpacing.xl} 0`,
  },
  button: {
    backgroundColor: emailColors.primary,
    borderRadius: emailRadii.md,
    color: emailColors.surface,
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1",
    padding: "14px 18px",
    textDecoration: "none",
  },
  detailPanel: {
    backgroundColor: "#fbfcfd",
    border: `1px solid ${emailColors.border}`,
    borderRadius: emailRadii.md,
    margin: `${emailSpacing.xl} 0`,
    padding: emailSpacing.lg,
  },
  detailTitle: {
    color: emailColors.ink,
    fontSize: emailType.small,
    fontWeight: "700",
    lineHeight: emailType.lineHeight.tight,
    margin: `0 0 ${emailSpacing.md}`,
  },
  detailRow: {
    borderTop: `1px solid ${emailColors.border}`,
    padding: `${emailSpacing.md} 0 0`,
    margin: `${emailSpacing.md} 0 0`,
  },
  detailLabel: {
    color: emailColors.muted,
    fontSize: emailType.label,
    fontWeight: "700",
    lineHeight: emailType.lineHeight.tight,
    margin: `0 0 ${emailSpacing.xs}`,
    textTransform: "uppercase" as const,
  },
  detailValue: {
    color: emailColors.ink,
    fontSize: emailType.body,
    lineHeight: emailType.lineHeight.body,
    margin: 0,
  },
  footer: {
    borderTop: `1px solid ${emailColors.border}`,
    padding: `${emailSpacing.lg} ${emailSpacing["2xl"]} ${emailSpacing.xl}`,
  },
  footerText: {
    color: emailColors.muted,
    fontSize: "12px",
    lineHeight: "1.5",
    margin: 0,
  },
  link: {
    color: emailColors.primary,
    textDecoration: "underline",
  },
} as const;

export function EmailShell({
  children,
  preview,
  lang = "en",
  maxWidth = 600,
  footer,
}: EmailShellProps) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={{ ...styles.container, maxWidth: `${maxWidth}px` }}>
          {children}
          {footer !== false ? (footer ?? <EmailFooter />) : null}
        </Container>
      </Body>
    </Html>
  );
}

export function EmailHeader() {
  return (
    <Section style={styles.header}>
      <Text style={styles.wordmark}>HelloBrand</Text>
    </Section>
  );
}

export function EmailStatusAccent({ variant }: { variant: EmailStatusVariant }) {
  return (
    <Section
      style={{
        backgroundColor: emailStatusColors[variant],
        height: "3px",
        lineHeight: "3px",
      }}
    />
  );
}

export function EmailContent({ children }: { children: ReactNode }) {
  return <Section style={styles.content}>{children}</Section>;
}

export function EmailTitle({ children }: { children: ReactNode }) {
  return (
    <Heading as="h1" style={styles.title}>
      {children}
    </Heading>
  );
}

export function EmailText({ children, muted = false, style }: EmailTextProps) {
  return (
    <Text style={{ ...styles.text, ...(muted ? styles.mutedText : {}), ...style }}>{children}</Text>
  );
}

export function EmailButton({ children, href, style }: EmailButtonProps) {
  return (
    <Section style={styles.buttonWrap}>
      <Button href={href} style={{ ...styles.button, ...style }}>
        {children}
      </Button>
    </Section>
  );
}

export function EmailDetailPanel({
  children,
  rows,
  title,
  variant = "neutral",
}: EmailDetailPanelProps) {
  return (
    <Section
      style={{
        ...styles.detailPanel,
        borderTop: `3px solid ${emailStatusColors[variant]}`,
      }}
    >
      {title ? <Text style={styles.detailTitle}>{title}</Text> : null}
      {rows?.map((row) => (
        <Section key={row.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text style={styles.detailValue}>{row.value ?? "None"}</Text>
        </Section>
      ))}
      {children}
    </Section>
  );
}

export function EmailFooter({
  children,
  settingsHref,
  supportHref = "mailto:support@hellobrand.com",
  unsubscribeHref,
}: EmailFooterProps) {
  if (children) {
    return (
      <Section style={styles.footer}>
        <Text style={styles.footerText}>{children}</Text>
      </Section>
    );
  }

  return (
    <Section style={styles.footer}>
      <Text style={styles.footerText}>
        Need help?{" "}
        <Link href={supportHref} style={styles.link}>
          Contact support
        </Link>
        {settingsHref ? (
          <>
            {" "}
            or update your{" "}
            <Link href={settingsHref} style={styles.link}>
              notification settings
            </Link>
          </>
        ) : null}
        {unsubscribeHref ? (
          <>
            {" "}
            or{" "}
            <Link href={unsubscribeHref} style={styles.link}>
              unsubscribe
            </Link>
          </>
        ) : null}
        .
      </Text>
    </Section>
  );
}

export function EmailDivider() {
  return <Hr style={{ borderColor: emailColors.border, margin: `${emailSpacing.xl} 0` }} />;
}

export const emailSharedStyles = {
  link: styles.link,
  noMarginText: {
    ...styles.text,
    margin: 0,
  },
} as const;
