import { ImageResponse } from "next/og";

import { getCurrentViewer } from "@/lib/auth";
import { getProfileForViewer } from "@/lib/profile";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  let accentColor = "#1a4d3e";

  try {
    const viewer = await getCurrentViewer();
    if (viewer) {
      const profile = await getProfileForViewer(viewer);
      if (profile.accentColor) {
        accentColor = profile.accentColor;
      }
    }
  } catch {
    // Fall back to default color
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accentColor
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: "rotate(18deg)" }}
        >
          <path d="M18 11V6a2 2 0 0 0-4 0v7" />
          <path d="M14 13V5a2 2 0 0 0-4 0v8" />
          <path d="M10 13V7a2 2 0 0 0-4 0v6.5c0 5 3.5 8.5 8 8.5s8-3 8-6v-3a2 2 0 0 0-4 0" />
          <path d="M18 11a2 2 0 1 1 4 0v2" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
