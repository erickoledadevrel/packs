import * as coda from '@codahq/packs-sdk';

export const ProductSchema = coda.makeObjectSchema({
  properties: {
    asin: { type: coda.ValueType.String },
    upc: { type: coda.ValueType.String },
    name: { type: coda.ValueType.String },
    description: { type: coda.ValueType.String },
    brand: { type: coda.ValueType.String },
    categories: { 
      type: coda.ValueType.Array,
      items: { type: coda.ValueType.String },
    },
    rating: { type: coda.ValueType.Number },
    reviews: { type: coda.ValueType.Number },
    price: { fromKey: "price_parsed", type: coda.ValueType.Number, codaType: coda.ValueHintType.Currency },
    photo: { type: coda.ValueType.String, codaType: coda.ValueHintType.ImageReference },
    link: { fromKey: "short_url", type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    asOf: { type: coda.ValueType.String, codaType: coda.ValueHintType.Date },
  },
  idProperty: "asin",
  displayProperty: "name",
  featuredProperties: ["price", "photo"],
  imageProperty: "photo",
  snippetProperty: "description",
  subtitleProperties: ["price", "rating", "reviews", "asOf"],
  linkProperty: "link",
});