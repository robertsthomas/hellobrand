import { absoluteUrl } from "@/lib/site";

export type BlogSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  coverImageAlt: string;
  coverImageCreditName?: string;
  coverImageCreditUrl?: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  readingTime: string;
  featured?: boolean;
  keywords: string[];
  sections: BlogSection[];
};

const realBlogCoverPhotoIds: Record<string, string> = {
  "three-things-creators-miss-in-contracts": "1651094856217-6f30970b1521",
  "how-brand-deal-contracts-actually-work-explained-simply":
    "1668605335554-7fa848f3a720",
  "the-1-way-creators-get-undervalued-in-contracts": "1754379657900-962db3a86873",
  "creators-are-signing-this-without-realizing-it": "1735825764457-ffdf0b5aa5dd",
  "the-full-lifecycle-of-a-brand-deal-from-dm-to-payment":
    "1758640920659-0bb864175983",
  "net-30-net-60-why-creators-get-paid-late": "1754379657900-962db3a86873",
  "how-much-should-you-charge-for-a-brand-deal-real-numbers":
    "1668605335554-7fa848f3a720",
  "clauses-brands-sneak-into-creator-contracts": "1651094856217-6f30970b1521",
  "exclusivity-clauses-are-costing-you-thousands": "1735825764457-ffdf0b5aa5dd",
  "this-contract-term-can-get-you-sued": "1758640920659-0bb864175983"
};

function realCoverImageUrl(photoId: string) {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=1600&q=80`;
}

function generatedCoverImageUrl(slug: string) {
  const photoId = realBlogCoverPhotoIds[slug];

  if (photoId) {
    return realCoverImageUrl(photoId);
  }

  return `/blog-cover/${slug}`;
}

const posts: BlogPost[] = [
  {
    slug: "three-things-creators-miss-in-contracts",
    title: "Three Things Creators Miss in Contracts",
    description:
      "The contract terms creators most often overlook: broad rights grants, vague exclusivity, and one-sided termination or payment mechanics.",
    category: "Contracts",
    tags: ["Usage Rights", "Exclusivity", "Payment Terms"],
    coverImageUrl: generatedCoverImageUrl("three-things-creators-miss-in-contracts"),
    coverImageAlt:
      "A graphic cover for an article about the contract terms creators most often miss.",
    publishedAt: "2026-01-12",
    updatedAt: "2026-01-12",
    author: "HelloBrand",
    readingTime: "10 min read",
    featured: true,
    keywords: [
      "creator contracts",
      "influencer agreement red flags",
      "creator contract checklist",
      "brand deal exclusivity",
      "creator usage rights",
      "creator kill fee"
    ],
    sections: [
      {
        heading: "Why this matters more than creators think",
        paragraphs: [
          "Creators sign a lot of agreements that look routine, but the real leverage is rarely in the headline fee. It lives in the rights language, exclusivity wording, and the clauses that decide what happens when the campaign changes, stalls, or goes sideways.",
          "If you miss those sections, one deal can quietly turn into a long usage buyout, a category freeze that blocks future income, or a payment trap where approval delays push your invoice further and further out.",
          "This post is educational, not legal advice. The goal is to help you spot the places in a contract that deserve the most attention before you sign."
        ],
        bullets: [
          "How broad are the rights you are giving away?",
          "How tightly is exclusivity defined?",
          "Who controls termination, takedowns, and payment timing?"
        ]
      },
      {
        heading: "1. Rights in your content and likeness",
        paragraphs: [
          "The biggest miss is usually not the deliverable itself. It is the rights bundle attached to it. A brand may want the post, the raw footage, your name, your face, your voice, your handle, paid media rights, editing rights, sublicensing rights, and a term that lasts far longer than the campaign.",
          "That changes the economics of the deal immediately. Organic reposting rights are not the same as paid ads. A short-term social repost is not the same as a perpetual, worldwide, sublicensable license. And a scoped license is very different from work-for-hire or assignment language.",
          "If a contract lets the brand edit your content freely, create derivative works, or run ads from your identity without a clear end date or approval process, you are not just delivering content. You are renting out your likeness and audience trust."
        ],
        bullets: [
          "Watch for phrases like 'work made for hire,' 'assigns all right, title, and interest,' 'perpetual,' 'irrevocable,' 'worldwide,' and 'fully sublicensable.'",
          "Separate ownership from license whenever possible.",
          "Scope every license by media, term, territory, purpose, editing rights, and sublicensing.",
          "Treat whitelisting or allowlisting as a separate paid add-on, not a free extra."
        ]
      },
      {
        heading: "2. Exclusivity that is broader than the campaign",
        paragraphs: [
          "Exclusivity often sounds reasonable in the sales conversation. Nobody expects a creator to promote two direct competitors at the same time. The problem is that contracts rarely leave it there. They expand 'competitor' into a vague category, stretch the restriction past the actual posting window, and sometimes apply it across every channel you own.",
          "That is how one paid post becomes a hidden revenue freeze. If the contract says no work for brands that compete directly or indirectly, but never defines the category tightly, you can end up blocked from unrelated deals because the wording is too broad to interpret confidently.",
          "Exclusivity should be specific enough that you can tell, before signing, exactly who is off-limits, on which platforms, and for how long."
        ],
        bullets: [
          "Define competitors by name or by a narrow product category, not a huge umbrella like wellness or beauty.",
          "Tie exclusivity to a clear start and end date, ideally around the posting window, not the brand's internal usage term.",
          "Add carve-outs for pre-existing sponsors, affiliate links, non-sponsored editorial content, and adjacent categories.",
          "Charge extra for exclusivity because it limits future earning opportunities."
        ]
      },
      {
        heading: "3. Termination, takedowns, and payment traps",
        paragraphs: [
          "The third miss is the set of clauses that control the deal once momentum drops. This is where creators get stuck doing work that cannot get approved, removing content without being paid fairly, or waiting on invoices tied to 'acceptance' that the brand can delay at its own discretion.",
          "If the brand can terminate for convenience at any time, demand a takedown for any reason, and only pay after final acceptance, the practical risk sits almost entirely on your side. Those terms matter just as much as the headline rate because they determine whether you actually collect the money after doing the work.",
          "A healthier structure uses milestones, short approval windows, deemed approval if feedback does not arrive on time, and a clear kill fee or prorated payment if the brand exits midstream."
        ],
        bullets: [
          "Avoid payment terms that depend on approval with no response deadline.",
          "Define takedown rights narrowly and state whether fees remain payable.",
          "If termination for convenience stays in the deal, add a kill fee or minimum guaranteed payment.",
          "Check liability caps, indemnity language, arbitration, and venue before you treat them as boilerplate."
        ]
      },
      {
        heading: "A fast pre-sign checklist creators can actually use",
        paragraphs: [
          "Before you sign, force the contract back into plain English. If you cannot answer the questions below clearly, the agreement is not ready yet.",
          "You do not need to negotiate every clause from scratch. But you do need to know which terms change the value of the deal and which ones quietly transfer too much risk."
        ],
        bullets: [
          "Do I keep ownership, or is this a buyout or work-for-hire arrangement?",
          "Exactly where, how long, and in what formats can the brand use the content and my likeness?",
          "Does paid media use require a separate written addendum or fee?",
          "Who counts as a competitor, and how long does exclusivity really last?",
          "What happens if the campaign is canceled after I start work?",
          "When is payment triggered, and is there a deemed approval deadline?",
          "Can the brand demand removal for any reason, or only for defined causes?",
          "Are dispute, indemnity, and liability terms balanced enough that the downside is realistic?"
        ]
      },
      {
        heading: "The real goal is not to become a lawyer",
        paragraphs: [
          "Creators do not need to become contract experts overnight. The practical goal is simpler: build a repeatable review habit around the clauses that most often reshape the deal after the rate is agreed.",
          "If you consistently slow down for rights, exclusivity, and exit mechanics, you will catch a large share of the terms that create regret later. That is exactly the kind of work a better creator operations system should make easier."
        ]
      }
    ]
  },
  {
    slug: "how-brand-deal-contracts-actually-work-explained-simply",
    title: "How Brand Deal Contracts Actually Work (Explained Simply)",
    description:
      "A plain-English walkthrough of what a brand deal contract actually controls: deliverables, payment, usage rights, approvals, restrictions, and dispute risk.",
    category: "Contracts",
    tags: ["Contract Basics", "Compliance", "Usage Rights"],
    coverImageUrl: generatedCoverImageUrl(
      "how-brand-deal-contracts-actually-work-explained-simply"
    ),
    coverImageAlt:
      "A graphic cover for an article explaining brand deal contracts simply.",
    publishedAt: "2026-01-27",
    updatedAt: "2026-01-27",
    author: "HelloBrand",
    readingTime: "9 min read",
    keywords: [
      "how brand deal contracts work",
      "creator contract explained",
      "influencer agreement basics",
      "brand deal legal terms",
      "creator sponsorship contract"
    ],
    sections: [
      {
        heading: "A brand deal contract is really six agreements in one",
        paragraphs: [
          "Most creator contracts are not just payment agreements. They are a bundle of rules covering the work, the approval process, the rights the brand gets, the restrictions you take on, the compliance obligations you have to meet, and the rules for what happens if the relationship breaks.",
          "That complexity is why contracts often feel harder than the brief. The brand may talk about one TikTok post or one YouTube integration, but the document is also deciding how long the content can live, whether it can be reused in ads, whether you can work with competitors, and where disputes have to be resolved."
        ],
        bullets: [
          "Scope: what you deliver and when.",
          "Money: how and when payment is earned.",
          "Rights: how the content and your likeness can be used.",
          "Risk: what happens if the deal goes wrong."
        ]
      },
      {
        heading: "The sections creators usually underestimate",
        paragraphs: [
          "The most underestimated sections are almost never the opening business terms. They are the middle and back-half clauses that define approvals, takedowns, usage rights, exclusivity, indemnity, and venue.",
          "Those are the clauses that determine whether a one-time post quietly becomes a reusable media asset, whether your invoice depends on subjective acceptance, and whether you would ever realistically enforce the deal if a payment issue came up."
        ],
        bullets: [
          "Approval language can control revision count and payment timing.",
          "Rights language changes whether the fee is a posting fee or a buyout.",
          "Dispute language changes whether enforcement is realistic."
        ]
      },
      {
        heading: "How to read the contract in the right order",
        paragraphs: [
          "A practical way to review a brand deal agreement is to stop reading it like a lawyer and start reading it like an operator. First confirm the deliverables and timeline. Then move immediately to payment triggers. After that, read the rights and amplification clauses, then exclusivity and takedown language, then liability and venue.",
          "That sequence works because it follows the parts of the deal that most directly change value. If payment is soft, rights are broad, and restrictions are long, the contract is more expensive than it first appears even if the headline rate seems acceptable."
        ],
        bullets: [
          "Read deliverables before you read boilerplate.",
          "Read payment before rights so you can judge whether the risk matches the fee.",
          "Read dispute terms last, but never skip them."
        ]
      },
      {
        heading: "The simplest contract test",
        paragraphs: [
          "Reduce the agreement into plain English. What am I making? When do I get paid? What can the brand do with this later? What am I not allowed to do after I sign? What happens if either side changes course?",
          "If you cannot answer those questions clearly after reading the contract once, the agreement is not actually simple. It just looks simple at the top."
        ]
      }
    ]
  },
  {
    slug: "the-1-way-creators-get-undervalued-in-contracts",
    title: "The #1 Way Creators Get Undervalued in Contracts",
    description:
      "Creators most often get underpaid when they price the post but not the downstream rights bundle: paid media, allowlisting, keep-live terms, and exclusivity.",
    category: "Pricing",
    tags: ["Pricing", "Paid Media", "Exclusivity"],
    coverImageUrl: generatedCoverImageUrl(
      "the-1-way-creators-get-undervalued-in-contracts"
    ),
    coverImageAlt:
      "A graphic cover for an article about creator undervaluation in contracts.",
    publishedAt: "2026-02-15",
    updatedAt: "2026-02-15",
    author: "HelloBrand",
    readingTime: "8 min read",
    keywords: [
      "creators undervalued in contracts",
      "brand deal pricing mistakes",
      "creator usage rights pricing",
      "whitelisting pricing",
      "creator exclusivity fee"
    ],
    sections: [
      {
        heading: "The post is not the whole product",
        paragraphs: [
          "The most common creator pricing mistake is treating the deliverable as the entire deal. A brand may be buying a post on paper, but the contract may also be buying a keep-live term, a usage license, paid media permissions, and a competitor freeze.",
          "That is why creators get undervalued even when the rate sounds respectable. The base fee is often matched to production and posting, while the contract quietly captures the long-tail asset value."
        ],
        bullets: [
          "One post can become a reusable ad asset.",
          "One campaign can create months of exclusivity.",
          "One fee can absorb multiple rights you never priced."
        ]
      },
      {
        heading: "Where the hidden value usually sits",
        paragraphs: [
          "The highest-value clauses are usually paid amplification, allowlisting or whitelisting, broad likeness rights, long keep-live requirements, and post-term exclusivity. Those are not small extras. They directly change what the brand can earn from the campaign after your work is done.",
          "If a contract says boosting or ad authorization is included at no extra cost, it is telling you the brand wants more than organic creator content. It wants media inventory tied to your identity."
        ],
        bullets: [
          "Organic reposting and paid media are not the same license.",
          "A long keep-live term has opportunity cost on your feed.",
          "Exclusivity should be treated like a separate product."
        ]
      },
      {
        heading: "The fix is contract unbundling",
        paragraphs: [
          "A better pricing model is to separate the base deliverable from the add-ons. Quote a fee for production and posting, then a separate fee for paid usage, a separate fee for allowlisting, a separate fee for extended keep-live terms, and a separate fee for exclusivity.",
          "That structure makes negotiation cleaner because both sides can see what is driving the total price. It also protects you from giving away valuable rights just to avoid friction in the sales conversation."
        ],
        bullets: [
          "Base fee for production and posting.",
          "Add-on fee for paid media rights.",
          "Add-on fee for exclusivity and restricted categories.",
          "Renewal fee for any extension beyond the original term."
        ]
      },
      {
        heading: "A fast undervaluation check before you sign",
        paragraphs: [
          "Ask whether the rate still makes sense if the post is used in paid ads, kept live for months, or paired with a category restriction that blocks other work. If the answer is no, the fee is not aligned to the actual contract.",
          "Creators do not need a perfect rate card to fix this. They need a habit of spotting when the contract is selling more than the brief."
        ]
      }
    ]
  },
  {
    slug: "creators-are-signing-this-without-realizing-it",
    title: "Creators Are Signing This Without Realizing It",
    description:
      "The most invisible contract risk is often the enforcement framework: arbitration, distant venue clauses, class waivers, and confidentiality rules that make disputes harder to fight.",
    category: "Legal Risk",
    tags: ["Arbitration", "Venue", "Confidentiality"],
    coverImageUrl: generatedCoverImageUrl(
      "creators-are-signing-this-without-realizing-it"
    ),
    coverImageAlt:
      "A graphic cover for an article about invisible dispute clauses in creator contracts.",
    publishedAt: "2026-02-04",
    updatedAt: "2026-02-04",
    author: "HelloBrand",
    readingTime: "8 min read",
    keywords: [
      "creator arbitration clause",
      "brand deal venue clause",
      "creator dispute terms",
      "influencer confidentiality contract",
      "class action waiver creator contract"
    ],
    sections: [
      {
        heading: "The invisible clause is often the dispute clause",
        paragraphs: [
          "A lot of creators read the fee, the deliverables, and the content approval language, then skim the rest. That is exactly how arbitration clauses, venue clauses, and fee-shifting rules slip through unnoticed.",
          "Those terms rarely matter in a smooth campaign. They matter when payment fails, likeness use goes too far, or a dispute gets expensive enough that you need the contract to actually protect you."
        ],
        bullets: [
          "A bad dispute clause can make a valid claim impractical.",
          "Distance and process can matter as much as legal merits.",
          "Confidentiality can reduce public leverage if it is too broad."
        ]
      },
      {
        heading: "Why these terms are so easy to miss",
        paragraphs: [
          "They usually appear at the end of the contract in dense, formal language. They also feel less urgent than usage rights or payment timing because they only become real when something has already gone wrong.",
          "But that is the point. The dispute section is the section that decides whether your rights are usable, not just theoretical."
        ]
      },
      {
        heading: "What a creator-friendly version looks like",
        paragraphs: [
          "The goal is not to eliminate every dispute clause. It is to make the enforcement path workable. If arbitration is required, push for a remote process or a local venue. If venue is fixed, push for one that is not cost-prohibitive. If confidentiality is broad, add carve-outs for legal compliance and professional advisors.",
          "For small and mid-sized creator deals, a realism test helps: would you actually spend the time and money required to enforce this agreement if the dispute amount were five thousand or ten thousand dollars? If not, the clause is more restrictive than it looks."
        ],
        bullets: [
          "Prefer local or remote-friendly venue terms.",
          "Look for small-claims or low-value dispute carve-outs.",
          "Keep confidentiality from blocking legally required disclosures."
        ]
      },
      {
        heading: "Read the back half of the contract like it changes the fee",
        paragraphs: [
          "Because it does. If enforcement is difficult, the practical value of the contract goes down. That means deposits, faster payment, narrower rights, or a higher fee may be the right trade.",
          "A dispute clause is not just legal cleanup. It is part of the economic structure of the deal."
        ]
      }
    ]
  },
  {
    slug: "the-full-lifecycle-of-a-brand-deal-from-dm-to-payment",
    title: "The Full Lifecycle of a Brand Deal (From DM to Payment)",
    description:
      "A creator-side walkthrough of the full brand deal workflow, from inbound outreach and scope alignment to approvals, invoicing, and getting paid on time.",
    category: "Workflow",
    tags: ["Workflow", "Approvals", "Invoicing"],
    coverImageUrl: generatedCoverImageUrl(
      "the-full-lifecycle-of-a-brand-deal-from-dm-to-payment"
    ),
    coverImageAlt:
      "A graphic cover for an article about the lifecycle of a brand deal.",
    publishedAt: "2026-02-09",
    updatedAt: "2026-02-09",
    author: "HelloBrand",
    readingTime: "9 min read",
    keywords: [
      "brand deal workflow",
      "creator deal lifecycle",
      "influencer campaign process",
      "creator approvals workflow",
      "brand deal invoicing"
    ],
    sections: [
      {
        heading: "Most brand deals break in the handoffs, not the creative",
        paragraphs: [
          "Creators often assume the hard part of a deal is the content. In practice, a lot of delays and disputes happen in the handoffs between stages: scope getting vague after the brief, paid usage being introduced after the rate is discussed, approvals stalling, invoicing requirements arriving late, or finance routing holding up payment.",
          "That is why a brand deal should be treated like an operational workflow, not just a creative project."
        ],
        bullets: [
          "Outreach and scope alignment set the pricing ceiling.",
          "Contracting decides rights, restrictions, and payment logic.",
          "Approvals and invoicing often decide when cash actually lands."
        ]
      },
      {
        heading: "The stages creators should track explicitly",
        paragraphs: [
          "A healthy deal moves through predictable stages: outreach, brief, quote, contract, production, review, publication, reporting, invoice, payment, and renewal or extension. If you do not track those stages, important assumptions get lost between email threads and chat messages.",
          "That matters even more when the campaign includes analytics sharing, allowlisting, or paid amplification. Those items need explicit end dates and shutdown steps, not just verbal agreement."
        ],
        bullets: [
          "Confirm rights before you confirm the rate.",
          "Confirm approvers before you start production.",
          "Confirm invoice requirements before the post goes live."
        ]
      },
      {
        heading: "Where the workflow usually stalls",
        paragraphs: [
          "The most common stalls are approval silence, revision creep, missing tax or vendor onboarding, invoice formatting issues, and payment terms that only start once the brand marks the campaign as complete.",
          "Those problems are avoidable when the contract is specific. A defined approval window, limited revision rounds, and a clear invoicing checklist do more for payment speed than a vague promise to process things quickly."
        ]
      },
      {
        heading: "Treat the deal like a system, not a one-off",
        paragraphs: [
          "The creators who get paid faster usually have repeatable process. They save approved briefs, capture scope changes in writing, invoice immediately, and know what rights need separate addenda.",
          "That system mindset does not make the work less creative. It protects the creative work from getting buried under preventable operational friction."
        ]
      }
    ]
  },
  {
    slug: "net-30-net-60-why-creators-get-paid-late",
    title: "Net 30, Net 60... Why Creators Get Paid Late",
    description:
      "Late creator payments usually come from a mix of net terms, approval gates, vendor onboarding, and internal finance workflows that were never scoped clearly in the contract.",
    category: "Payments",
    tags: ["Net Terms", "Cash Flow", "Invoices"],
    coverImageUrl: generatedCoverImageUrl(
      "net-30-net-60-why-creators-get-paid-late"
    ),
    coverImageAlt:
      "A graphic cover for an article about net payment terms for creators.",
    publishedAt: "2026-02-21",
    updatedAt: "2026-02-21",
    author: "HelloBrand",
    readingTime: "8 min read",
    keywords: [
      "net 30 creators",
      "net 60 influencer payment",
      "why brand deals pay late",
      "creator invoice terms",
      "creator cash flow"
    ],
    sections: [
      {
        heading: "Net terms are a finance workflow, not a promise of speed",
        paragraphs: [
          "Net 30 and net 60 describe when payment is due after the invoice event defined in the contract. They do not mean your payment clock starts the moment the post goes live unless the agreement says it does.",
          "That distinction is where creators get hurt. If payment is net 30 after acceptance, and acceptance is subjective, and the invoice also depends on internal vendor setup, the practical delay can be much longer than thirty days."
        ],
        bullets: [
          "Net terms measure due dates, not goodwill.",
          "Approval gates can delay when the clock starts.",
          "Missing vendor setup can push payment even further."
        ]
      },
      {
        heading: "Why late payments happen even when nobody is acting maliciously",
        paragraphs: [
          "Many brands route creator payments through normal accounts payable systems. That means invoice verification, department approvals, purchase order checks, and scheduled payment runs. A creator may think the campaign is done, while the company thinks the invoice packet is still incomplete.",
          "That process gap is why creators should stop treating invoicing like an afterthought. It is a core part of the deal structure."
        ]
      },
      {
        heading: "How to protect your cash flow upfront",
        paragraphs: [
          "The cleanest fix is milestone payments: a deposit on signing and the balance due on a clearly defined event like first publication. If the brand insists on net terms, keep the acceptance standard objective and time-bound.",
          "Also confirm vendor requirements before production starts. If the brand needs a W-9, invoice portal registration, payee matching, or purchase order references, handle that before the post goes live."
        ],
        bullets: [
          "Ask for a deposit whenever the production burden is meaningful.",
          "Tie final payment to publication or short acceptance windows.",
          "Get AP requirements in writing before launch."
        ]
      },
      {
        heading: "The question every creator should ask",
        paragraphs: [
          "When does payment become due, exactly? Not generally. Exactly. If the answer is fuzzy, the payment term is riskier than it looks.",
          "Late payment problems often start with that one missing definition."
        ]
      }
    ]
  },
  {
    slug: "how-much-should-you-charge-for-a-brand-deal-real-numbers",
    title: "How Much Should You Charge for a Brand Deal? (Real Numbers)",
    description:
      "Real pricing benchmarks help, but the right creator rate depends on scope, usage rights, paid media, revisions, exclusivity, and how much risk the contract pushes onto you.",
    category: "Pricing",
    tags: ["Rate Setting", "Benchmarks", "Usage Rights"],
    coverImageUrl: generatedCoverImageUrl(
      "how-much-should-you-charge-for-a-brand-deal-real-numbers"
    ),
    coverImageAlt:
      "A graphic cover for an article about pricing brand deals with real numbers.",
    publishedAt: "2026-02-28",
    updatedAt: "2026-02-28",
    author: "HelloBrand",
    readingTime: "10 min read",
    keywords: [
      "how much to charge for brand deals",
      "creator brand deal rates",
      "influencer pricing benchmarks",
      "brand deal pricing real numbers",
      "creator sponsorship rates"
    ],
    sections: [
      {
        heading: "Real numbers are anchors, not the final answer",
        paragraphs: [
          "Creators want rate clarity, and benchmarks can help. But a benchmark is only useful if it sits on top of real scope. A platform average or package estimate does not tell you whether the brand also wants paid media rights, multiple review rounds, or category exclusivity.",
          "That is why two creators with similar audience size can justify very different prices. The contract bundle, not just the audience size, changes the number."
        ]
      },
      {
        heading: "What should shape the quote before you send it",
        paragraphs: [
          "Start with the production work: format, editing load, number of deliverables, and timeline. Then layer on the contract modifiers: paid amplification, allowlisting, usage term, revision expectations, rush timeline, and exclusivity.",
          "If you skip that second layer, you are quoting the creative work while ignoring the licensing and restriction package that may matter more to the brand."
        ],
        bullets: [
          "Base rate for production and posting.",
          "Add-on for paid media or allowlisting.",
          "Add-on for exclusivity and extended keep-live.",
          "Rush fee when turnaround compresses your calendar."
        ]
      },
      {
        heading: "A better way to talk about pricing with brands",
        paragraphs: [
          "Instead of defending one flat number, break the quote into parts. That makes negotiation cleaner because the brand can remove rights or restrictions instead of only asking you to lower the fee.",
          "It also turns pricing into a scope conversation, which is where creators usually have more leverage than they think."
        ],
        bullets: [
          "Quote a base fee plus a rights menu.",
          "Make scope precede price in every conversation.",
          "Do not let performance-style language creep in through vague acceptance terms."
        ]
      },
      {
        heading: "The practical pricing question",
        paragraphs: [
          "If the brand got exactly what the contract says it gets, would the fee still feel fair six weeks later? If not, the rate is probably missing part of the rights bundle.",
          "The right number is the one that matches the actual agreement, not the one that matches the first line of the brief."
        ]
      }
    ]
  },
  {
    slug: "clauses-brands-sneak-into-creator-contracts",
    title: "7 Clauses Brands Sneak Into Creator Contracts",
    description:
      "The brand-deal terms creators underestimate most often: rights grabs, allowlisting, vague exclusivity, takedown control, payment traps, one-sided liability, and hard-to-enforce dispute clauses.",
    category: "Contracts",
    tags: ["Rights Grabs", "Allowlisting", "Dispute Risk"],
    coverImageUrl: generatedCoverImageUrl(
      "clauses-brands-sneak-into-creator-contracts"
    ),
    coverImageAlt:
      "A graphic cover for an article about sneaky clauses in creator contracts.",
    publishedAt: "2026-03-06",
    updatedAt: "2026-03-06",
    author: "HelloBrand",
    readingTime: "14 min read",
    keywords: [
      "creator contract red flags",
      "influencer agreement clauses",
      "whitelisting creator contracts",
      "creator usage rights",
      "brand deal payment terms",
      "creator contract checklist",
      "influencer contract negotiation"
    ],
    sections: [
      {
        heading: "Why these clauses matter more than the headline fee",
        paragraphs: [
          "A lot of creator contracts look straightforward on the surface. There is a campaign, a posting schedule, a fee, and a deadline. But the real economics of the deal often sit in the clauses that define who controls the content after posting, who carries the legal risk, and what happens if the brand changes direction midstream.",
          "That is why it helps to treat every creator agreement as two separate deals bundled together. The first is the production-and-posting work. The second is everything downstream: usage rights, paid amplification, exclusivity, approval control, and dispute risk. If you price only the first part, you can undercharge while still signing away the second.",
          "This article is educational, not legal advice. The point is practical: learn which sections quietly reshape the value of a sponsorship so you can slow down and negotiate the right things before you sign."
        ],
        bullets: [
          "Separate deliverables from downstream usage and risk.",
          "Assume the boilerplate may be where the real leverage sits.",
          "Price broader rights and restrictions as paid add-ons, not freebies."
        ]
      },
      {
        heading: "1. Rights grabs over your content, name, and likeness",
        paragraphs: [
          "One of the biggest hidden value transfers in creator contracts is a broad intellectual property grant. A brand may ask for the post itself, the raw assets, the right to edit the content, and the right to use your name, face, voice, and handle in future marketing. If the clause is worldwide, perpetual, sublicensable, or tied to derivative works, the brand is getting much more than a one-time campaign asset.",
          "Creators often miss this because license language has become normalized across platforms. But a platform license that helps a service host content is not the same as a commercial marketing license that lets a brand keep exploiting your identity after the campaign ends.",
          "If the agreement uses assignment or work-for-hire language, you may be giving up ownership entirely. Even when ownership stays with you, a badly scoped license can function like a buyout if it is broad enough."
        ],
        bullets: [
          "Watch for: perpetual, irrevocable, worldwide, sublicensable, assignable, derivative works, all media now known or later developed.",
          "Separate organic reposting from paid media and offline usage.",
          "Retain ownership where possible and scope any license by term, territory, media, and purpose."
        ]
      },
      {
        heading: "2. Paid amplification and allowlisting that turn one post into an ad asset",
        paragraphs: [
          "A clause about boosting, allowlisting, whitelisting, partnership ads, or ad account access can radically change the deal. Instead of just posting sponsored content, you are now authorizing the brand to run advertising from your content or even from your handle. That can extend the life of the campaign, change the audience, and expose private performance data to the advertiser.",
          "These permissions are easy to underestimate because they are often tucked into deliverables language or platform-specific setup steps. But once your content becomes paid media, it is no longer just a deliverable. It is a performance asset the brand may want to optimize, re-run, and scale.",
          "The commercial question is simple: if the brand wants ad rights, it should pay for ad rights. The operational question is just as important: the contract should say exactly how long those rights last, what content can be used, who gets access, and how you revoke it."
        ],
        bullets: [
          "Ask whether the deal includes boosting, Spark ads, partnership ads, allowlisting, or ad manager access.",
          "Set flight dates, creative limits, approval rules, and renewal pricing.",
          "Spell out how access is removed when the campaign ends."
        ]
      },
      {
        heading: "3. Exclusivity, noncompetes, and rights of first refusal",
        paragraphs: [
          "Exclusivity can be reasonable when it is narrow and paid for. The problem is that contracts often define competitors too broadly, stretch the restriction beyond the campaign, or bundle in first-look and first-refusal language that limits your future pipeline.",
          "A vague competitor definition can freeze revenue across an entire category instead of just blocking a direct rival. A long cooldown period can keep hurting your deal flow after the sponsored post is already live. And a right of first refusal can slow down future negotiations by forcing you to route new opportunities back through the current brand first.",
          "Creators should think about exclusivity as an opportunity-cost product. If a contract limits who you can work with, on which platforms, and for how long, that lost flexibility has economic value and should be priced accordingly."
        ],
        bullets: [
          "Define competitors narrowly, ideally by named list or a very specific product category.",
          "Time-box exclusivity with clear start and end dates.",
          "Add carve-outs for existing partners, affiliate links, editorial mentions, and platform-wide ads you do not control."
        ]
      },
      {
        heading: "4. Approval control, forced revisions, takedowns, and keep-live rules",
        paragraphs: [
          "Brands usually want some review rights. That is normal. What becomes risky is when approval is entirely subjective, revisions are unlimited, takedowns can be demanded at any time, or the content must remain live for months regardless of what changes in the campaign.",
          "Those clauses shift both creative control and business risk toward the brand. If payment is tied to final acceptance, a brand with unlimited revision power can effectively delay your invoice. If takedown rights are broad, you may lose the public value of the post after doing all the work. If keep-live terms are long, the campaign may keep occupying your feed and audience attention long after the fee has been earned.",
          "The fix is not to reject review entirely. It is to put boundaries around it. Limit revision rounds, require quick feedback, create deemed approval when the brand goes silent, and preserve payment when removal happens for the brand's convenience rather than your breach."
        ],
        bullets: [
          "Cap revision rounds and define what counts as a revision versus a new brief.",
          "Add response deadlines and deemed approval if feedback does not arrive on time.",
          "Tie takedowns to specific triggers and clarify whether fees remain payable."
        ]
      },
      {
        heading: "5. Payment traps, clawbacks, and reimbursement language",
        paragraphs: [
          "Money problems often hide inside acceptance and compliance language. A contract may say payment is due only after final approval, only after campaign completion, or only if the brand decides all requirements were met. Some agreements go further and add refund, reimbursement, withholding, or chargeback rights if the brand later claims the deliverables fell short.",
          "That structure leaves the creator carrying timing risk and dispute risk at the same time. You may finish the work, publish the content, and still be waiting on payment because the brand controls both the approval process and the interpretation of performance or compliance.",
          "A healthier structure uses milestone payments, objective acceptance standards, and a limited dispute process. If a refund right exists at all, it should be tied to material non-delivery or uncured material breach, not a vague dissatisfaction standard."
        ],
        bullets: [
          "Avoid payment terms based solely on acceptance in the brand's sole discretion.",
          "Use milestones such as signing, draft approval, and first publication.",
          "Push back on unilateral clawbacks, withholding, or charging stored payment methods."
        ]
      },
      {
        heading: "6. One-sided indemnity and lopsided liability caps",
        paragraphs: [
          "Indemnity and liability sections often look like standard legal boilerplate, but they determine who pays when something goes wrong. Many creator agreements require the creator to indemnify the brand for a wide range of claims while capping the brand's own liability to the fees paid under the contract.",
          "That can be reasonable only to the extent each side is covering risks it actually controls. You should be responsible for things you introduced, such as unlicensed music you chose yourself or factual claims you improvised without approval. The brand should be responsible for product claims, brand assets, brand scripts, and legal positions it supplied to you.",
          "If the brand wants a tight liability cap for itself, you should ask for symmetry. Otherwise you can end up functioning like the insurer for a campaign that paid you only a small fraction of the actual legal downside."
        ],
        bullets: [
          "Push for mutual indemnity tied to each party's own breach, negligence, or legal noncompliance.",
          "Remove or narrow any duty to defend if possible.",
          "Match liability caps on both sides unless there is a strong reason not to."
        ]
      },
      {
        heading: "7. Confidentiality, gag clauses, arbitration, and forum traps",
        paragraphs: [
          "The final set of clauses can make a bad agreement even harder to unwind. Broad confidentiality or non-disparagement language may restrict what you can say about the campaign, the pricing, or the dispute. A forum clause may require you to enforce the contract in a distant court. A mandatory arbitration clause may make a small claim expensive enough that it is not worth pursuing.",
          "These provisions matter because they affect practical leverage, not just legal theory. A good claim is much less useful if the cost and venue make enforcement unrealistic. The same is true if the contract is written so broadly that you are unsure whether even truthful, legally required disclosures could trigger conflict.",
          "At a minimum, confidentiality should leave room for legal compliance, platform disclosure rules, and discussions with your manager, accountant, or lawyer. Dispute clauses should be workable enough that both sides can realistically enforce the deal."
        ],
        bullets: [
          "Check whether confidentiality covers pricing, performance metrics, or even the existence of the deal.",
          "Look for remote-friendly or local venues and fair fee allocation in arbitration language.",
          "Make sure nothing blocks legally required sponsorship disclosures."
        ]
      },
      {
        heading: "A fast creator checklist before you sign",
        paragraphs: [
          "If you want a practical review habit, reduce the contract back into plain English. Ask what you are delivering, what the brand can do with it later, what restrictions you are taking on, when you get paid, and who carries the downside if the deal breaks.",
          "If any answer is vague, open-ended, or controlled entirely by the other side, that is usually where negotiation value lives. You do not need to redline every line in every deal. You do need a repeatable way to catch the clauses that quietly change the economics."
        ],
        bullets: [
          "Do I retain ownership, or is this really a buyout?",
          "Are paid ads, allowlisting, or offline usage included and separately priced?",
          "Exactly who counts as a competitor, on which platforms, and for how long?",
          "How many revision rounds are included, and when is content deemed approved?",
          "What triggers payment, and can the brand delay it indefinitely?",
          "Can the brand force removal or termination without preserving my fee?",
          "Is indemnity mutual and limited to what each side actually controls?",
          "Would I realistically enforce this contract in the chosen venue?"
        ]
      }
    ]
  },
  {
    slug: "exclusivity-clauses-are-costing-you-thousands",
    title: "Exclusivity Clauses Are Costing You Thousands",
    description:
      "Exclusivity looks simple, but it can quietly block future sponsorship revenue across platforms, categories, and post-campaign windows if you do not narrow it and price it.",
    category: "Pricing",
    tags: ["Exclusivity", "Opportunity Cost", "Negotiation"],
    coverImageUrl: generatedCoverImageUrl(
      "exclusivity-clauses-are-costing-you-thousands"
    ),
    coverImageAlt:
      "A graphic cover for an article about exclusivity clauses costing creators money.",
    publishedAt: "2026-03-17",
    updatedAt: "2026-03-17",
    author: "HelloBrand",
    readingTime: "8 min read",
    keywords: [
      "creator exclusivity clause",
      "brand deal exclusivity fee",
      "influencer noncompete clause",
      "creator opportunity cost",
      "exclusive sponsorship pricing"
    ],
    sections: [
      {
        heading: "Exclusivity is a revenue lock, not just a legal term",
        paragraphs: [
          "When a brand asks for exclusivity, it is asking you to give up optionality. That means the clause should be valued in economic terms, not treated like harmless boilerplate.",
          "A one-month or three-month restriction across a category can cost more than the campaign fee itself if that category is active in your pipeline."
        ]
      },
      {
        heading: "The wording that makes exclusivity expensive",
        paragraphs: [
          "Exclusivity becomes dangerous when competitors are defined vaguely, when the restriction applies across all platforms, or when the cooldown extends well past the actual posting window. Those choices turn a narrow brand-safety ask into a broad revenue freeze.",
          "Creators also get caught when the clause covers editorial mentions, affiliate links, or work they had already started negotiating before the deal was signed."
        ],
        bullets: [
          "Define competitors narrowly.",
          "Limit the clause to paid placements, not everything you publish.",
          "Remove post-term cooldowns unless they are separately paid."
        ]
      },
      {
        heading: "How to negotiate without turning it into a fight",
        paragraphs: [
          "The easiest frame is commercial, not emotional. If the brand wants category protection, that protection has a cost. Narrow the list of competitors, tie the dates to the actual campaign window, and add a specific exclusivity fee.",
          "This works because it gives the brand a way to keep what it truly needs while removing the broad language that creates hidden opportunity cost."
        ]
      },
      {
        heading: "A simple exclusivity test",
        paragraphs: [
          "If you cannot say exactly who is off-limits, on which platforms, and until what date, the clause is too broad. If the fee does not change when the restriction changes, the pricing is too loose.",
          "Exclusivity should always be specific enough to price."
        ]
      }
    ]
  },
  {
    slug: "this-contract-term-can-get-you-sued",
    title: "This Contract Term Can Get You Sued",
    description:
      "The highest-liability creator contract setup is usually a product-claims clause paired with broad warranties and one-sided indemnity that shifts legal risk onto the creator.",
    category: "Legal Risk",
    tags: ["Claims", "Warranties", "Indemnity"],
    coverImageUrl: generatedCoverImageUrl(
      "this-contract-term-can-get-you-sued"
    ),
    coverImageAlt:
      "A graphic cover for an article about contract terms that can expose creators to lawsuits.",
    publishedAt: "2026-03-24",
    updatedAt: "2026-03-24",
    author: "HelloBrand",
    readingTime: "9 min read",
    keywords: [
      "creator contract liability",
      "influencer warranty clause",
      "creator indemnity clause",
      "brand deal legal risk",
      "unsubstantiated claims creator"
    ],
    sections: [
      {
        heading: "The risky combination is claims plus warranties plus indemnity",
        paragraphs: [
          "A single product claim does not create the full legal risk on its own. The danger appears when the contract requires you to say something factual about the product, makes you warrant that the content is true and compliant, and then asks you to indemnify the brand if there is a problem.",
          "That combination can turn a marketing script into a liability transfer device."
        ]
      },
      {
        heading: "Where creators get exposed",
        paragraphs: [
          "The highest-risk deals are the ones involving results claims, health claims, safety claims, or promises about outcomes that you cannot independently verify. If those claims are drafted by the brand but the contract makes you responsible for them, you are carrying risk you do not control.",
          "This gets worse when takedown rights, refunds, or termination rights are also tied to noncompliance. Then the brand can shift both regulatory and payment pressure onto the creator."
        ],
        bullets: [
          "Be wary of objective efficacy or health claims.",
          "Do not warrant brand facts you cannot verify.",
          "Push product and substantiation risk back to the brand."
        ]
      },
      {
        heading: "How to protect yourself without killing the deal",
        paragraphs: [
          "Require the brand to provide and approve any factual claims in writing. Limit your own statements to honest personal experience unless substantiation is clearly provided. Then pair that with indemnity language that makes the brand responsible for product performance, safety, and brand-supplied claims.",
          "If the contract insists on broad creator warranties, narrow them so they cover what you actually control: your original content, your own disclosures, and any third-party materials you add yourself."
        ]
      },
      {
        heading: "The simplest rule to remember",
        paragraphs: [
          "No substantiation, no claim. If the brand wants you to make a strong factual promise, the contract should not leave you carrying that risk alone.",
          "The term that can get you sued is usually the one that makes you speak with certainty about something the brand should be proving."
        ]
      }
    ]
  }
];

export function getBlogPosts() {
  return [...posts].sort(
    (left, right) =>
      new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime()
  );
}

export function getFeaturedBlogPost() {
  return getBlogPosts().find((post) => post.featured) ?? getBlogPosts()[0];
}

export function getBlogPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug) ?? null;
}

export function getBlogPostUrl(slug: string) {
  return absoluteUrl(`/blog/${slug}`);
}

export function getBlogPostOgImageUrl(slug: string) {
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return absoluteUrl(`/blog-cover/${slug}`);
  }

  return post.coverImageUrl.startsWith("http")
    ? post.coverImageUrl
    : absoluteUrl(post.coverImageUrl);
}

export function getBlogIndexOgImageUrl() {
  return absoluteUrl("/blog/opengraph-image");
}

export function getBlogPostWordCount(post: BlogPost) {
  const text = post.sections
    .flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.bullets ?? [])
    ])
    .join(" ");

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function getBlogPostPlainText(post: BlogPost) {
  return post.sections
    .map((section) =>
      [
        section.heading,
        ...section.paragraphs,
        ...(section.bullets ? section.bullets.map((bullet) => `- ${bullet}`) : [])
      ].join("\n\n")
    )
    .join("\n\n");
}
