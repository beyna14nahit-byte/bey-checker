import { db } from "./db";

export type Testimonial = { id: string; display_name: string; feedback: string; rating: number | null };

/** Only feedback with recorded consent that the owner has published. Empty until real feedback exists. */
export async function getPublishedTestimonials(): Promise<Testimonial[]> {
  return db()<Testimonial[]>`select id, display_name, feedback, rating from testimonials
    where published and consent_confirmed order by created_at desc limit 6`;
}
