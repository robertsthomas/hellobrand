"use client";

import Link from "next/link";
import { BookOpen, Mail, MessageCircle } from "lucide-react";

import { useAssistant } from "@/components/assistant-provider";
import { Button } from "@/components/ui/button";

export function HelpSupportOptions() {
  const { openAssistant } = useAssistant();

  return (
    <>
      <div className="mt-6 grid gap-px overflow-hidden border border-black/8 bg-black/8 md:grid-cols-2 dark:border-white/10 dark:bg-white/10">
        <div className="bg-white px-6 py-6 dark:bg-card">
          <MessageCircle className="mb-3 h-5 w-5 text-[#1E6A4E]" />
          <h3 className="text-base font-medium text-foreground">Chat with Assistant</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ask questions about your partnerships, draft replies, or get help navigating the app.
            The assistant knows your workspace context.
          </p>
          <Button className="mt-5 w-full sm:w-auto" onClick={() => openAssistant()}>
            Open Assistant
          </Button>
        </div>

        <div className="bg-white px-6 py-6 dark:bg-card">
          <Mail className="mb-3 h-5 w-5 text-[#D76742]" />
          <h3 className="text-base font-medium text-foreground">Email Support</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            For longer questions, account issues, or follow-up context, send the team an email and
            expect a response within one business day.
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
            <h3 className="text-base font-medium text-foreground">Creator Resources</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
              Review guides on partnership negotiations, creator risk review, contract language, and
              payment follow-up templates.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">Visit Resources</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
