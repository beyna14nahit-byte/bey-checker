// Universities the owner has confirmed past clients from. Shown as "Trusted by" logos on the home page.
// Logo files live in public/universities/. Only universities with a logo file are shown.
export type University = { id: string; short: string; name: string; logo: string | null };

export const UNIVERSITIES: University[] = [
  { id: "uitm", short: "UiTM", name: "Universiti Teknologi MARA", logo: "/universities/uitm.png" },
  { id: "ukm", short: "UKM", name: "Universiti Kebangsaan Malaysia", logo: "/universities/ukm.png" },
  { id: "utem", short: "UTeM", name: "Universiti Teknikal Malaysia Melaka", logo: "/universities/utem.png" },
  { id: "upm", short: "UPM", name: "Universiti Putra Malaysia", logo: "/universities/upm.png" },
  { id: "uum", short: "UUM", name: "Universiti Utara Malaysia", logo: null },
  { id: "um", short: "UM", name: "Universiti Malaya", logo: "/universities/um.png" },
  { id: "ums", short: "UMS", name: "Universiti Malaysia Sabah", logo: null },
  { id: "unimas", short: "UNIMAS", name: "Universiti Malaysia Sarawak", logo: null },
  { id: "unikl", short: "UniKL", name: "Universiti Kuala Lumpur", logo: null },
];

/** The universities shown on the page: only those whose logo has been added. */
export const UNIVERSITIES_WITH_LOGOS = UNIVERSITIES.filter((u) => u.logo);
