/* ─────────────────────────────────────────────
   HACCPrint – core types
───────────────────────────────────────────── */

export type IndustryProfile =
  | "restaurant"
  | "hotel"
  | "bakery"
  | "pharmacy"
  | "custom";

export type LabelType =
  | "bontas"        // Date of opening
  | "ervenyesseg"   // Use-by / expiry
  | "termek_leiras" // Product description
  | "custom";       // Free text

export type Language = "en" | "hu";

export type Theme = "dark" | "light";

export type SubscriptionPlan = "basic" | "premium" | "trial";

/* ── Label template saved by the user ── */
export interface LabelTemplate {
  id: string;
  name: string;
  type: LabelType;
  category: string;
  description: string | null;
  shelfLifeDays: number;
  allergens: string | null;
  profile: IndustryProfile;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  printCount: number;
}

/* ── A single completed print job (for HACCP log) ── */
export interface PrintJob {
  id: string;
  templateId: string;
  templateName: string;
  labelType: LabelType;
  copies: number;
  printedAt: string;           // ISO datetime
  preparedDate: string;        // YYYY-MM-DD
  expiryDate: string;          // YYYY-MM-DD
  operatorName: string | null;
}

/* ── App settings stored locally ── */
export interface AppSettings {
  profile: IndustryProfile;
  language: Language;
  theme: Theme;
  operatorName: string;
  printerName: string | null;   // null = auto-detect
  autoCalculateExpiry: boolean;
  haccpLogEnabled: boolean;
}

/* ── License ── */
export interface License {
  key: string;
  plan: SubscriptionPlan;
  expiresAt: string;
  deviceId: string;
  activatedAt: string;
}
