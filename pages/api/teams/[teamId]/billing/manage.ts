import { NextApiRequest, NextApiResponse } from "next";

import { stripeInstance } from "@/ee/stripe";
import { getPriceIdFromPlan } from "@/ee/stripe/functions/get-price-id-from-plan";
import { getQuantityFromPriceId } from "@/ee/stripe/functions/get-quantity-from-plan";
import getSubscriptionItem from "@/ee/stripe/functions/get-subscription-item";
import { PLANS, isOldAccount } from "@/ee/stripe/utils";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";

import { identifyUser, trackAnalytics } from "@/lib/analytics";
import { errorhandler } from "@/lib/errorHandler";
import prisma from "@/lib/prisma";
import { CustomUser } from "@/lib/types";

import { authOptions } from "../../../auth/[...nextauth]";

export const config = {
  // in order to enable `waitUntil` function
  supportsResponseStreaming: true,
};

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    return res.status(501).json({ error: "Billing disabled" });
    /*
    // POST /api/teams/:teamId/billing/manage – manage a user's subscription
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const userId = (session.user as CustomUser).id;
    const userEmail = (session.user as CustomUser).email;

    const { teamId } = req.query as { teamId: string };
    const {
      priceId,
      upgradePlan,
      quantity,
      addSeat,
      proAnnualBanner,
      return_url,
    } = req.body as {
      priceId: string;
      upgradePlan: boolean;
      quantity?: number;
      addSeat?: boolean;
      proAnnualBanner?: boolean;
      return_url?: string;
    };
    try {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
        select: {
          stripeId: true,
          subscriptionId: true,
          plan: true,
        },
      });

      if (!team) {
        return res.status(400).json({ error: "Team does not exists" });
      }
      if (!team.stripeId) {
        return res.status(400).json({ error: "No Stripe customer ID" });
      }

      if (!team.subscriptionId) {
        return res.status(400).json({ error: "No subscription ID" });
      }

      const subscriptionItemId = await getSubscriptionItem(
        team.subscriptionId,
        isOldAccount(team.plan),
      );

      const minQuantity = getQuantityFromPriceId(priceId);

      const stripe = stripeInstance(isOldAccount(team.plan));
      const { url } = await stripe.billingPortal.sessions.create({
        customer: team.stripeId,
        return_url: `${process.env.NEXTAUTH_URL}/settings/billing?cancel=true`,
        ...((upgradePlan || addSeat) &&
          subscriptionItemId && {
            flow_data: {
              type: "subscription_update_confirm",
              subscription_update_confirm: {
                subscription: team.subscriptionId,
                items: [
                  {
                    id: subscriptionItemId,
                    quantity: isOldAccount(team.plan)
                      ? 1
                      : (quantity ?? minQuantity),
                    price: priceId,
                  },
                ],
              },
              after_completion: {
                type: "redirect",
                redirect: {
                  return_url:
                    return_url ??
                    `${process.env.NEXTAUTH_URL}/settings/billing?success=true`,
                },
              },
            },
          }),
      });

      waitUntil(identifyUser(userEmail ?? userId));
      waitUntil(
        trackAnalytics({
          event: "Stripe Billing Portal Clicked",
          teamId,
          action: proAnnualBanner ? "pro-annual-banner" : undefined,
        }),
      );

      return res.status(200).json(url);
    } catch (error) {
      errorhandler(error, res);
    }
  */
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
