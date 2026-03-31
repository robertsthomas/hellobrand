"use client";

import { CircleHelp } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

const FIELD_GUIDE = [
  {
    section: "Partnership",
    fields: [
      {
        name: "Brand name",
        description: "The company or brand you are partnering with. This is how the partnership will be labeled across your workspace."
      },
      {
        name: "Agency name",
        description: "If a talent agency, management company, or intermediary is coordinating the deal on behalf of the brand, enter their name here. Leave blank for direct brand partnerships."
      }
    ]
  },
  {
    section: "Primary contact",
    fields: [
      {
        name: "Contact type",
        description: "Whether your main point of contact works at the brand directly or at an agency/management company representing them."
      },
      {
        name: "Contact name, title, email, phone",
        description: "The person you communicate with about deliverables, approvals, and payments. Having this on file helps the AI draft emails and follow-ups."
      }
    ]
  },
  {
    section: "Contract snapshot",
    fields: [
      {
        name: "Contract title",
        description: "A short, recognizable name for this partnership. This appears in your dashboard, inbox, and notifications."
      },
      {
        name: "Primary payment amount",
        description: "The total compensation you expect for this partnership. If the deal has multiple payouts, enter the primary or total amount here."
      },
      {
        name: "Currency",
        description: "The currency your payout will be in. Defaults to USD."
      }
    ]
  },
  {
    section: "Deliverables and timeline",
    fields: [
      {
        name: "Brand category",
        description: "The industry or product category the brand falls under (e.g. beauty, tech, food). Used to detect conflicts with other partnerships that have exclusivity or competitor restrictions."
      },
      {
        name: "Posting window",
        description: "The date range during which you are expected to publish content. Helps track deadlines and detect scheduling conflicts with other deals."
      },
      {
        name: "Competitor / restricted categories",
        description: "Categories or brands you are restricted from working with during this partnership. HelloBrand uses these to flag conflicts across your active deals."
      },
      {
        name: "Disclosure obligations",
        description: "Requirements for how you must disclose the sponsorship, such as #ad hashtags, verbal mentions, or FTC-compliant captions. These show as reminders in your workspace."
      },
      {
        name: "Deliverables",
        description: "The specific content pieces you need to create, such as Instagram Reels, TikTok videos, or blog posts. Each deliverable tracks a title, channel, quantity, and due date."
      },
      {
        name: "Timeline",
        description: "Key milestones like draft submission dates, revision deadlines, and go-live dates. These feed into your dashboard's upcoming deliverables view."
      },
      {
        name: "Analytics highlights",
        description: "Audience stats, engagement benchmarks, or performance metrics relevant to this deal. For example: average views per Reel, follower demographics, or engagement rate. Useful for tracking what the brand expects."
      }
    ]
  },
  {
    section: "Notes",
    fields: [
      {
        name: "Notes",
        description: "A freeform space for anything the AI extraction missed, verbal agreements, negotiation context, or your own reminders. Carries into the workspace."
      }
    ]
  }
];

export function IntakeFieldGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center text-black/35 transition hover:text-black/60 dark:text-white/35 dark:hover:text-white/60"
          aria-label="Field guide"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Field guide</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-6">
          {FIELD_GUIDE.map((section) => (
            <div key={section.section}>
              <h3 className="text-sm font-semibold text-ink">{section.section}</h3>
              <div className="mt-2 space-y-3">
                {section.fields.map((field) => (
                  <div key={field.name}>
                    <p className="text-sm font-medium text-black/70 dark:text-white/75">{field.name}</p>
                    <p className="mt-0.5 text-sm text-black/55 dark:text-white/55">{field.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
