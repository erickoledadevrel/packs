import * as coda from "@codahq/packs-sdk";

export const pack = coda.newPack();

const PromoterValue = "Promoter";
const PassiveValue = "Passive";
const DetractorValue = "Detractor";

pack.addFormula({
  name: "Category",
  description: "Calculates whether the given score is a Promoter, Detractor, or Passive.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.Number,
      name: "rating",
      description: "The rating (0-10) that the user gave.",
    }),
  ],
  resultType: coda.ValueType.String,
  examples: [
    { params: [4], result: "Detractor" },
    { params: [7], result: "Passive" },
    { params: [9], result: "Promoter" },
  ],
  execute: async function (args, context) {
    let [rating] = args;
    if (isInvalid(rating)) {
      throw new coda.UserVisibleError("Invalid rating: " + rating);
    }
    return getBucket(rating);
  }
});

pack.addFormula({
  name: "NPS",
  description: "Calculates the Net Promoter Score® for a set of ratings.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.SparseNumberArray,
      name: "ratings",
      description: "The ratings (0-10) that the users gave.",
    }),
  ],
  resultType: coda.ValueType.Number,
  examples: [
    { params: [10, 4, 9, 8], result: 25 },
  ],
  execute: async function (args, context) {
    let [ratings] = args;
    
    // Remove sparse rows.
    ratings = ratings.filter(rating => rating !== null && rating !== undefined);

    // Handle an empty list.
    if (!ratings.length) {
      return 0;
    }

    // Handle invalid ratings.
    let invalid = ratings.filter(rating => isInvalid(rating));
    if (invalid.length) {
      throw new coda.UserVisibleError("Invalid ratings: " + invalid.join(", "));
    }

    let buckets = ratings.map(rating => getBucket(rating));
    let total = buckets.length;
    let promoters = buckets.filter(bucket => bucket == PromoterValue).length;
    let detractors = buckets.filter(bucket => bucket == DetractorValue).length;
    return Math.round((promoters - detractors) * 100 / total);
  }
});

function isInvalid(rating) {
  return rating < 0 || rating > 10;
}

function getBucket(rating) {
  if (rating >= 9) return PromoterValue;
  if (rating <= 6) return DetractorValue;
  return PassiveValue;
}