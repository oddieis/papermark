// INFO: for numeric values,`null` means unlimited

export type TPlanLimits = {
  users: number;
  links: number | null;
  documents: number | null;
  domains: number;
  datarooms: number;
  customDomainOnPro: boolean;
  customDomainInDataroom: boolean;
  advancedLinkControlsOnPro: boolean | null;
  watermarkOnBusiness?: boolean | null;
};

const UNLIMITED_LIMITS = {
  users: Infinity,
  links: null,
  documents: null,
  domains: Infinity,
  datarooms: Infinity,
  customDomainOnPro: true,
  customDomainInDataroom: true,
  advancedLinkControlsOnPro: true,
  watermarkOnBusiness: true,
  conversationsInDataroom: true,
} as const;

export const FREE_PLAN_LIMITS = UNLIMITED_LIMITS;
export const PRO_PLAN_LIMITS = UNLIMITED_LIMITS;
export const BUSINESS_PLAN_LIMITS = UNLIMITED_LIMITS;
export const DATAROOMS_PLAN_LIMITS = UNLIMITED_LIMITS;
export const DATAROOMS_PLUS_PLAN_LIMITS = UNLIMITED_LIMITS;

