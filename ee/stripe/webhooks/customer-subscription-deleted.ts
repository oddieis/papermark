import { NextApiResponse } from "next";

import { FREE_PLAN_LIMITS } from "@/ee/limits/constants";
import Stripe from "stripe";

import prisma from "@/lib/prisma";
import { log } from "@/lib/utils";

export async function customerSubscriptionDeleted(
  event: Stripe.Event,
  res: NextApiResponse,
) {
  await log({
    message: `Received customer.subscription.deleted event: ${event.id}`,
    type: "info",
  });
  return res.status(200).json({ received: true });
}
