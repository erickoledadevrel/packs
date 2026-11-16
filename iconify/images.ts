import * as sdk from "@superhuman/plugins-sdk";
import { getIconData } from "@iconify/utils/lib/icon-set/get-icon";
import { iconToSVG } from "@iconify/utils/lib/svg/build";
import { iconToHTML } from "@iconify/utils/lib/svg/html";

const ApiBaseUrl = "https://api.iconify.design";
const OneDaySecs = 24 * 60 * 60;
// Keep batched GET requests comfortably below common URL-length limits.
const MaxUrlLength = 1800;
type IconDataSet = Parameters<typeof getIconData>[0];

export async function getIconImages(ids: string[], context: sdk.ExecutionContext) {
  let collections = new Map<string, Set<string>>();
  for (let id of ids) {
    let [prefix, name] = id.split(":");
    if (!collections.has(prefix)) collections.set(prefix, new Set());
    collections.get(prefix).add(name);
  }

  let images = new Map<string, string>();
  for (let [prefix, names] of collections) {
    let getUrl = (batch: string[]) => sdk.withQueryParams(`${ApiBaseUrl}/${prefix}.json`, {
      icons: batch.join(","),
    });
    let batches: string[][] = [];
    let batch: string[] = [];
    // Sorting makes request URLs deterministic so the fetcher cache is useful.
    for (let name of [...names].sort()) {
      if (batch.length && getUrl([...batch, name]).length > MaxUrlLength) {
        batches.push(batch);
        batch = [];
      }
      batch.push(name);
    }
    if (batch.length) batches.push(batch);

    // Fetch sequentially to avoid moving the image-request burst to the server.
    for (let names of batches) {
      let response = await context.fetcher.fetch<IconDataSet>({
        method: "GET",
        url: getUrl(names),
        cacheTtlSecs: OneDaySecs,
      });
      for (let name of names) {
        let icon = getIconData(response.body, name);
        if (!icon) {
          throw new sdk.UserVisibleError(`Iconify did not return image data for "${prefix}:${name}". Try syncing again.`);
        }
        // The official utilities resolve aliases, inherited dimensions, flips,
        // and rotations before producing a self-contained SVG document.
        let rendered = iconToSVG(icon, { width: "auto", height: "auto" });
        let svg = iconToHTML(rendered.body, rendered.attributes);
        images.set(`${prefix}:${name}`, sdk.SvgConstants.DataUrlPrefix + Buffer.from(svg).toString("base64"));
      }
    }
  }
  return images;
}
