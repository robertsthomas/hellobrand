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
  coverImageUrl: string;
  coverImageAlt: string;
  coverImageCreditName: string;
  coverImageCreditUrl: string;
  publishedAt: string;
  updatedAt?: string;
  author: string;
  readingTime: string;
  featured?: boolean;
  keywords: string[];
  sections: BlogSection[];
};

const posts: BlogPost[] = [
  {
    slug: "three-things-creators-miss-in-contracts",
    title: "Three Things Creators Miss in Contracts",
    description:
      "The contract terms creators most often overlook: broad rights grants, vague exclusivity, and one-sided termination or payment mechanics.",
    category: "Contracts",
    coverImageUrl:
      "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80",
    coverImageAlt:
      "A clean creator-style workspace with laptop, notebook, coffee, and planning materials, without any people in frame.",
    coverImageCreditName: "Lauren Mancke",
    coverImageCreditUrl:
      "https://unsplash.com/photos/aOC7TSLb1o8",
    publishedAt: "2026-03-25",
    updatedAt: "2026-03-25",
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
  return absoluteUrl(`/blog/${slug}/opengraph-image`);
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
