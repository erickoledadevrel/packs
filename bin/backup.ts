const fs = require("fs");
const path = require("path");
import { glob } from "glob";
import fetch from "node-fetch";
import * as mime from "mime-types";

const DefaultIcon = "default-pack-icon.png";

async function run(packName) {
  let apiKey = JSON.parse(fs.readFileSync(".coda.json").toString()).apiKey;
  let packs = await glob("**/.coda-pack.json");
  packs.sort();
  for (let pack of packs) {
    let name = path.basename(path.dirname(pack));
    if (packName && packName !== name) continue;
    let packId = JSON.parse(fs.readFileSync(pack).toString()).packId;
    let url = `https://coda.io/apis/v1/packs/${packId}/listing`;
    let response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      }
    });
    let listing = await response.json();
    if (response.status !== 200) {
      throw new Error(`Error backing up ${packId}: ${response.status}`);
    }

    let dir = path.join(path.dirname(pack), "assets");
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    let file = path.join(dir, "listing.json");
    fs.writeFileSync(file, JSON.stringify(listing, null, 2));

    if (listing.logoUrl && !listing.logoUrl.endsWith(DefaultIcon)) {
      backupImage(listing.logoUrl, dir, "icon");
    }
    if (listing.exampleImages?.length) {
      for (let i = 0; i < listing.exampleImages.length; i++) {
        backupImage(listing.exampleImages[i].imageUrl, dir, "example" + i);
      }
    }

    console.log("Backed up listing " + file);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function backupImage(url, dir, name) {
  let response = await fetch(url);
  let buffer = await response.buffer();
  let extension  = mime.extension(response.headers.get("content-type"));
  if (extension == "jpeg") extension = "jpg";
  fs.writeFileSync(path.join(dir, `${name}.${extension}`), buffer);
}

let [n, f, packName] = process.argv;
run(packName);
