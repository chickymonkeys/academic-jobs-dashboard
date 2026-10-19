import { z } from "zod"

/**
 * The normalized vacancy model shared by the ingest pipeline (scripts/) and the app (src/).
 * Every source adapter maps its raw payload onto this shape; the UI never sees source-specific fields.
 */

export const SOURCE_IDS = ["ejm", "joe"] as const
export const SourceIdSchema = z.enum(SOURCE_IDS)
export type SourceId = z.infer<typeof SourceIdSchema>

export const CATEGORY_IDS = ["faculty", "postdoc", "teaching", "nonacademic", "predoc"] as const
export const CategorySchema = z.enum(CATEGORY_IDS)
export type Category = z.infer<typeof CategorySchema>

export const REGION_IDS = [
  "north-america",
  "latin-america",
  "europe",
  "africa-middle-east",
  "asia",
  "oceania",
] as const
export const RegionIdSchema = z.enum(REGION_IDS)
export type RegionId = z.infer<typeof RegionIdSchema>

export const GeoPrecisionSchema = z.enum(["exact", "city", "country"])
export type GeoPrecision = z.infer<typeof GeoPrecisionSchema>

export const VacancySchema = z.object({
  id: z.string(),
  source: SourceIdSchema,
  url: z.string(),
  /** Same position found on other sources (deduplicated) */
  alsoOn: z.array(z.object({ source: SourceIdSchema, url: z.string() })),
  title: z.string(),
  institution: z.string(),
  department: z.string().nullable(),
  category: CategorySchema,
  positionTypes: z.array(z.string()),
  /** JEL top-level letters, or "any" */
  fields: z.array(z.string()),
  city: z.string().nullable(),
  admin: z.string().nullable(),
  country: z.string(),
  countryCode: z.string().nullable(),
  worldRegion: RegionIdSchema,
  lat: z.number(),
  lng: z.number(),
  geoPrecision: GeoPrecisionSchema,
  /** YYYY-MM-DD; null when the source does not expose it and the listing predates our first crawl */
  postedAt: z.string().nullable(),
  deadline: z.string().nullable(),
  firstSeenAt: z.string(),
  summary: z.string(),
  logoUrl: z.string().nullable(),
})
export type Vacancy = z.infer<typeof VacancySchema>

export const SnapshotSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  items: z.array(VacancySchema),
})
export type Snapshot = z.infer<typeof SnapshotSchema>

export const SourceStatusSchema = z.object({
  id: SourceIdSchema,
  name: z.string(),
  homepage: z.string(),
  ok: z.boolean(),
  count: z.number(),
  fetchedAt: z.string().nullable(),
  error: z.string().nullable(),
})
export type SourceStatus = z.infer<typeof SourceStatusSchema>

export const MetaSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  total: z.number(),
  sources: z.array(SourceStatusSchema),
})
export type Meta = z.infer<typeof MetaSchema>

export const BlockSchema = z.object({ t: z.enum(["p", "h", "li"]), text: z.string() })
export type Block = z.infer<typeof BlockSchema>

/** Heavy per-listing payload, fetched lazily when a listing is opened */
export const VacancyDetailSchema = z.object({
  id: z.string(),
  blocks: z.array(BlockSchema),
  keywords: z.array(z.string()),
  salary: z.string().nullable(),
  requirements: z.array(z.string()),
  jel: z.array(z.object({ code: z.string(), label: z.string() })),
})
export type VacancyDetail = z.infer<typeof VacancyDetailSchema>
