import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/site";

export const alt = "HelloBrand blog";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function BlogOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(circle at top left, #f4d36f 0%, #fbf5e7 38%, #ffffff 100%)",
          padding: "64px",
          color: "#142033"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            fontSize: 28,
            fontWeight: 700
          }}
        >
          <div
            style={{
              height: 48,
              width: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              background: "#1a4d3e",
              color: "#fff"
            }}
          >
            HB
          </div>
          <span>{siteConfig.name}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#8b6d3b"
            }}
          >
            Blog
          </div>
          <div
            style={{
              maxWidth: 900,
              fontSize: 72,
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.05em"
            }}
          >
            Creator operations guidance that actually helps you negotiate better.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#4d596d"
          }}
        >
          Contracts, rights, exclusivity, and payment systems for creators.
        </div>
      </div>
    ),
    size
  );
}
