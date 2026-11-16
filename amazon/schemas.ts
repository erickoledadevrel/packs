import * as coda from '@codahq/packs-sdk';

export const ProductSchema = sdk.makeObjectSchema({
  properties: {
    asin: { type: sdk.ValueType.String },
    upc: { type: sdk.ValueType.String },
    name: { type: sdk.ValueType.String },
    description: { type: sdk.ValueType.String },
    brand: { type: sdk.ValueType.String },
    categories: { 
      type: sdk.ValueType.Array,
      items: { type: sdk.ValueType.String },
    },
    rating: { type: sdk.ValueType.Number },
    reviews: { type: sdk.ValueType.Number },
    price: { fromKey: "price_parsed", type: sdk.ValueType.Number, codaType: sdk.ValueHintType.Currency },
    photo: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.ImageReference },
    link: { fromKey: "short_url", type: sdk.ValueType.String, codaType: sdk.ValueHintType.Url },
    asOf: { type: sdk.ValueType.String, codaType: sdk.ValueHintType.Date },
  },
  idProperty: "asin",
  displayProperty: "name",
  featuredProperties: ["price", "photo"],
  imageProperty: "photo",
  snippetProperty: "description",
  subtitleProperties: ["price", "rating", "reviews", "asOf"],
  linkProperty: "link",
});