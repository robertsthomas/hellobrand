/**
 * This route handles authenticated workspace HTTP requests.
 * It connects partnership reads, writes, and document operations to the shared deal and document domain code.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireViewer } from "@/lib/auth";
import {
  applyPendingChangesForViewer,
  dismissPendingChangesForViewer,
  getDealForViewer
} from "@/lib/deals";
import { computeTermsDiff } from "@/lib/pending-changes";
import type { DealTermsRecord, PendingExtractionData } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const viewer = await requireViewer();
  const aggregate = await getDealForViewer(viewer, dealId);

  if (!aggregate?.terms?.pendingExtraction) {
    return NextResponse.json({
      hasPendingChanges: false,
      totalChangedFields: 0,
      manuallyEditedConflicts: 0,
      entries: []
    });
  }

  const diff = computeTermsDiff(
    aggregate.terms as DealTermsRecord,
    aggregate.terms.pendingExtraction as PendingExtractionData
  );

  return NextResponse.json(diff);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  const viewer = await requireViewer();
  const body = await request.json();

  if (body.action === "apply") {
    const acceptedFields: string[] = Array.isArray(body.acceptedFields)
      ? body.acceptedFields
      : [];
    await applyPendingChangesForViewer(viewer, dealId, acceptedFields);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "dismiss") {
    await dismissPendingChangesForViewer(viewer, dealId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
