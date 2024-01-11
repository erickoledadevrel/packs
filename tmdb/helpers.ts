import * as coda from "@codahq/packs-sdk";

export function formatMovieForSchema(movie, country: string, configuration) {
  formatCommonForSchema(movie, configuration);
  movie.link = `https://www.themoviedb.org/movie/${movie.id}`;
  if (movie.runtime) {
    movie.runtime = movie.runtime + " mins";
  }
  movie.rating = movie.release_dates.results
    ?.find(releasesByCountry => releasesByCountry.iso_3166_1 == country)
    ?.release_dates
    .sort((a, b) => a.release_date.localeCompare(b.release_date))
    [0].certification;
}

export function formatShowForSchema(show, country: string, configuration) {
  formatCommonForSchema(show, configuration);
  show.link = `https://www.themoviedb.org/tv/${show.id}`;
  show.rating = show.content_ratings.results
    ?.find(ratingByCountry => ratingByCountry.iso_3166_1 == country)
    ?.rating;
}

function formatCommonForSchema(common, configuration) {
  // TODO: HTML escape or use template.
  common.details = [
    common.tagline ? `<i>${common.tagline}</i>` : '',
    common.overview,
  ].join(" ");
  common.genres = common.genres?.map(genre => genre.name);

  // URLs
  common.homepage = common.homepage?.replace("http://", "https://");

  // Images
  let baseUrl = configuration.images.secure_base_url;
  if (common.poster_path) {
    common.poster_path = coda.joinUrl(baseUrl, getLargestStandardSize(configuration.images.poster_sizes), common.poster_path);
  }
  if (common.backdrop_path) {
    common.backdrop_path = coda.joinUrl(baseUrl, getLargestStandardSize(configuration.images.backdrop_sizes), common.backdrop_path);
  }
}

function getLargestStandardSize(sizes: string[]): string {
  return sizes.filter(s => s != "original").pop();
}
