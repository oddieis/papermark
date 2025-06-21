import { z } from "zod";
import { FREE_PLAN_LIMITS } from "./constants";

export const configSchema = z.object({});

export async function getLimits(_: { teamId: string; userId: string }) {
  return {
    ...FREE_PLAN_LIMITS,
    usage: { documents: 0, links: 0, users: 0 },
  };
}

