import { NextApiResponse } from "next";

import {
  BUSINESS_PLAN_LIMITS,
  DATAROOMS_PLAN_LIMITS,
  DATAROOMS_PLUS_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
} from "@/ee/limits/constants";
import Stripe from "stripe";

import prisma from "@/lib/prisma";
import { log } from "@/lib/utils";

import { getPlanFromPriceId } from "../utils";

export async function customerSubsciptionUpdated(
  event: Stripe.Event,
  res: NextApiResponse,
  isOldAccount: boolean = false,
) {
  await log({
    message: `Received customer.subscription.updated event: ${event.id}`,
    type: "info",
  });
  return res.status(200).json({ received: true });
}
