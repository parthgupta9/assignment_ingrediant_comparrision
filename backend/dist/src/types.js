"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRequestSchema = exports.MatchConfigSchema = exports.ProductSchema = void 0;
const zod_1 = require("zod");
exports.ProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Product name cannot be empty"),
    manufacturer: zod_1.z.string().min(1, "Manufacturer cannot be empty"),
    composition: zod_1.z.record(zod_1.z.string(), zod_1.z.number().nonnegative("Ingredient percentage must be non-negative")),
});
exports.MatchConfigSchema = zod_1.z.object({
    tolerance_pp: zod_1.z.number().min(0, "Tolerance must be non-negative").default(3.0),
    max_extra_ingredients: zod_1.z.number().int().min(0, "Max extra ingredients must be >= 0").default(1),
    max_extra_percentage: zod_1.z.number().min(0, "Max extra percentage must be >= 0").default(2.0),
    epsilon: zod_1.z.number().min(0, "Epsilon must be non-negative").default(0.01),
});
exports.MatchRequestSchema = zod_1.z.object({
    reference_product: exports.ProductSchema,
    catalog: zod_1.z.array(exports.ProductSchema),
    config: exports.MatchConfigSchema.optional().default({}),
});
