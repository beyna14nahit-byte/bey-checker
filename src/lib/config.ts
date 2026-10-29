// Default business settings, written to the database on first deploy only. The owner edits the
// live copy in /admin/settings; every page reads it from there.

export type Settings = {
  contact: { whatsapp: string; email: string; telegramUrl: string };
  pricing: { currency: "MYR"; normalPrice: number };
  promotion: {
    enabled: boolean;
    promoPrice: number;
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
  contact: { whatsapp: "", email: "", telegramUrl: "" },
  pricing: { currency: "MYR", normalPrice: 9 },
  promotion: { enabled: false, promoPrice: 7, labelEn: "Launch promotion", labelMs: "Promosi pelancaran", startsAt: "", endsAt: "" },
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
