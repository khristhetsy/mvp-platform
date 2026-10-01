// Request schemas shared by the field-mapping and import routes.
import { z } from "zod";
import { MAPPING_SOURCES, type MappingSource } from "./field-mapping";

export const mappingSourceSchema = z.enum(MAPPING_SOURCES as [MappingSource, ...MappingSource[]]);

export const columnMappingSchema = z.object({
  column: z.string().min(1).max(200),
  action: z.enum(["map", "custom", "ignore"]),
  target: z.string().max(40).nullish(),
  customKey: z.string().max(63).nullish(),
  customLabel: z.string().max(120).nullish(),
});
