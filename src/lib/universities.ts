// Universities the owner has confirmed past clients from. Shown as "Trusted by" logos on the home page.
// Logo files live in public/universities/; until a file is added, the short name is shown in its place.
export type University = { id: string; short: string; name: string; logo: string | null };

export const UNIVERSITIES: University[] = [
  { id: "uitm", short: "UiTM", name: "Universiti Teknologi MARA", logo: null },
  { id: "ukm", short: "UKM", name: "Universiti Kebangsaan Malaysia", logo: null },
  { id: "utem", short: "UTeM", name: "Universiti Teknikal Malaysia Melaka", logo: null },
  { id: "upm", short: "UPM", name: "Universiti Putra Malaysia", logo: null },
  { id: "uum", short: "UUM", name: "Universiti Utara Malaysia", logo: null },
  { id: "um", short: "UM", name: "Universiti Malaya", logo: null },
  { id: "ums", short: "UMS", name: "Universiti Malaysia Sabah", logo: null },
  { id: "unimas", short: "UNIMAS", name: "Universiti Malaysia Sarawak", logo: null },
  { id: "unikl", short: "UniKL", name: "Universiti Kuala Lumpur", logo: null },
];
