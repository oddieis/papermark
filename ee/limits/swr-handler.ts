import { z } from "zod";
import { FREE_PLAN_LIMITS } from "./constants";

export const configSchema = z.object({});

export type LimitProps = z.infer<typeof configSchema> & {
  usage: {
    documents: number;
    links: number;
    users: number;
  };
  dataroomUpload?: boolean;
};

export function useLimits() {
  return {
    showUpgradePlanModal: false,
    limits: { ...FREE_PLAN_LIMITS, usage: { documents: 0, links: 0, users: 0 } },
    canAddDocuments: true,
    canAddLinks: true,
    canAddUsers: true,
    error: undefined,
    loading: false,
  };
}
