/**
 * This file provides shared account deletion logic used by both admin and self-service flows.
 * It handles Stripe cancellation, storage cleanup, Clerk deletion, and Prisma cascade in one place.
 */
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

import { isStripeConfigured, STRIPE_API_VERSION } from "@/lib/billing/config";
import { prisma } from "@/lib/prisma";
import { deleteStoredBytes } from "@/lib/storage";

export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const billingAccount = await prisma.billingAccount.findUnique({
    where: { userId },
    select: { id: true, stripeCustomerId: true },
  });

  if (billingAccount?.stripeCustomerId && isStripeConfigured()) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const stripe = new Stripe(secretKey!, { apiVersion: STRIPE_API_VERSION });

    const subscriptions = await stripe.subscriptions.list({
      customer: billingAccount.stripeCustomerId,
      status: "all",
    });

    for (const sub of subscriptions.data) {
      if (sub.status === "active" || sub.status === "trialing") {
        await stripe.subscriptions.cancel(sub.id);
      }
    }
  }

  const documentPaths = await prisma.document.findMany({
    where: { userId },
    select: { storagePath: true },
  });

  const emailAccountIds = await prisma.connectedEmailAccount.findMany({
    where: { userId },
    select: { id: true },
  });

  const emailAccountIdsList = emailAccountIds.map((account) => account.id);

  const attachmentPaths =
    emailAccountIdsList.length > 0
      ? await prisma.emailAttachment.findMany({
          where: {
            message: { thread: { accountId: { in: emailAccountIdsList } } },
          },
          select: { storageKey: true },
        })
      : [];

  const rawMessagePaths =
    emailAccountIdsList.length > 0
      ? await prisma.emailMessage.findMany({
          where: {
            thread: { accountId: { in: emailAccountIdsList } },
          },
          select: { rawStorageKey: true },
          take: 5000,
        })
      : [];

  const allPaths = [
    ...documentPaths.map((document) => document.storagePath),
    ...attachmentPaths.map((attachment) => attachment.storageKey),
    ...rawMessagePaths.map((message) => message.rawStorageKey),
  ].filter(
    (p): p is string => typeof p === "string" && p.length > 0 && !p.startsWith("pasted:")
  );

  const storageErrors: string[] = [];
  await Promise.allSettled(
    allPaths.map((storagePath) =>
      deleteStoredBytes(storagePath).catch((error) => {
        storageErrors.push(
          `${storagePath}: ${error instanceof Error ? error.message : "unknown"}`
        );
      })
    )
  );

  const clerkWarnings: string[] = [];
  try {
    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message.includes("Not Found") || message.includes("not found") || message.includes("404")) {
      clerkWarnings.push("Clerk user already deleted or not found.");
    } else {
      throw new Error(
        `Clerk deletion failed: ${message}. Storage cleanup ran (${allPaths.length} files), Prisma cleanup pending.`
      );
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  return { deletedFiles: allPaths.length, storageErrors, clerkWarnings };
}
