import type * as Handlebars from "handlebars";

/**
 * Block helper that tests if two values are equal.
 */
export function eq(a, b, opts: Handlebars.HelperOptions) {
  if (a === b) {
   return opts.fn(this);
  } else {
   return opts.inverse(this);
  }
}

/**
 * Block helper that tests if the first value is greater than the second.
 */
export function gt(a, b, opts: Handlebars.HelperOptions) {
  if (a > b) {
   return opts.fn(this);
  } else {
   return opts.inverse(this);
  }
}