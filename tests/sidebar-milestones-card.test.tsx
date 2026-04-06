import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { SidebarMilestonesCard } from "@/components/sidebar-milestones-card";

describe("SidebarMilestonesCard", () => {
  test("renders steps in order with the expected hrefs", () => {
    const html = renderToStaticMarkup(
      <SidebarMilestonesCard
        milestones={{
          visible: true,
          completedCount: 1,
          totalCount: 3,
          items: [
            {
              id: "create_workspace",
              label: "Create workspace",
              href: "/app/intake/new",
              complete: true
            },
            {
              id: "setup_creator_profile",
              label: "Set up creator profile",
              href: "/app/settings/profile",
              complete: false
            },
            {
              id: "connect_email",
              label: "Connect email",
              href: "/app/settings",
              complete: false
            }
          ]
        }}
      />
    );

    expect(html).toContain("Getting started");
    expect(html).toMatch(
      /href="\/app\/intake\/new"[\s\S]*href="\/app\/settings\/profile"[\s\S]*href="\/app\/settings"/
    );
  });
});
