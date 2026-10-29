// Default business settings, written to the database on first deploy only. The owner edits the
// live copy in /admin/settings; every page reads it from there.

export const PACKAGE_IDS = ["ai", "similarity", "combo"] as const;
export type PackageId = (typeof PACKAGE_IDS)[number];

export type Package = {
  id: PackageId;
  enabled: boolean;
  nameEn: string;
  nameMs: string;
  normalPrice: number;
  /** Charged while the promotion window is active. */
  promoPrice: number;
};

export type Settings = {
  contact: { whatsapp: string; email: string; telegramUrl: string };
  packages: Package[];
  promotion: {
    enabled: boolean;
    labelEn: string;
    labelMs: string;
    startsAt: string; // ISO with +08:00, or "" when not set
    endsAt: string; // exclusive: at this instant the normal price applies
  };
  payment: {
    provider: string;
    instructionsEn: string;
    instructionsMs: string;
    windowHours: number; // 0 = no payment deadline
  };
  delivery: {
    method: "whatsapp" | "email";
    turnaroundEn: string; // "" = not confirmed yet, not shown
    turnaroundMs: string;
  };
  upload: { formats: UploadFormat[]; maxMb: number };
  retention: { days: number; confirmed: boolean };
  launch: { uploadRulesConfirmed: boolean };
};

export const UPLOAD_FORMATS = ["pdf", "docx", "doc", "txt"] as const;
export type UploadFormat = (typeof UPLOAD_FORMATS)[number];

export const DEFAULT_SETTINGS: Settings = {
  contact: { whatsapp: "60109882148", email: "", telegramUrl: "" },
  packages: [
    { id: "ai", enabled: true, nameEn: "AI Check", nameMs: "Semakan AI", normalPrice: 9, promoPrice: 7 },
    { id: "similarity", enabled: true, nameEn: "Plagiarism / Similarity Check", nameMs: "Semakan Plagiarisme / Persamaan", normalPrice: 5, promoPrice: 4 },
    { id: "combo", enabled: true, nameEn: "AI + Plagiarism Combo", nameMs: "Kombo AI + Plagiarisme", normalPrice: 11, promoPrice: 9 },
  ],
  // End of October 2026 sale: ends at midnight, so all of 31 October is included.
  promotion: {
    enabled: true,
    labelEn: "End of October Sale",
    labelMs: "Jualan Akhir Oktober",
    startsAt: "2026-10-01T00:00:00+08:00",
    endsAt: "2026-11-01T00:00:00+08:00",
  },
  payment: {
    provider: "DuitNow QR",
    instructionsEn:
      "1. Open your banking or e-wallet app and choose DuitNow QR / Scan & Pay.\n" +
      "2. Scan the QR code and pay the exact amount shown.\n" +
      "3. Put your order reference in the payment note if your app allows it.\n" +
      "4. Upload a screenshot of your receipt below.",
    instructionsMs:
      "1. Buka aplikasi perbankan atau e-dompet anda dan pilih DuitNow QR / Imbas & Bayar.\n" +
      "2. Imbas kod QR dan bayar jumlah tepat yang dipaparkan.\n" +
      "3. Masukkan rujukan pesanan anda dalam nota bayaran jika aplikasi membenarkan.\n" +
      "4. Muat naik tangkapan skrin resit anda di bawah.",
    windowHours: 0,
  },
  delivery: { method: "whatsapp", turnaroundEn: "", turnaroundMs: "" },
  upload: { formats: ["pdf", "docx"], maxMb: 4 },
  retention: { days: 30, confirmed: false },
  launch: { uploadRulesConfirmed: false },
};

export const ORDER_STATUSES = ["awaiting_payment", "payment_review", "payment_verified", "processing", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// English labels double as translation keys (see i18n-ms.ts).
export const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting payment",
  payment_review: "Payment under review",
  payment_verified: "Payment verified",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
};
