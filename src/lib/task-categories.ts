import type { Database } from "@/integrations/supabase/types";

export type TaskCategory = Database["public"]["Enums"]["task_category"];

export const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "video_editing", label: "Video Editing" },
  { value: "graphic_designing", label: "Graphic Designing" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "website_development", label: "Website Development" },
  { value: "logo_design", label: "Logo Design" },
  { value: "other", label: "Other" },
];

export const CATEGORY_LABEL: Record<TaskCategory, string> = Object.fromEntries(
  TASK_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<TaskCategory, string>;

export function categoryLabel(cat: TaskCategory, custom?: string | null) {
  if (cat === "other" && custom) return custom;
  return CATEGORY_LABEL[cat] ?? cat;
}
