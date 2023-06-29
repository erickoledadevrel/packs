const fs = require("fs");
const path = require("path");
import { glob } from "glob";
import fetch from "node-fetch";

async function run() {
  let apiKey = JSON.parse(fs.readFileSync(".coda.json").toString()).apiKey;
  let packs = await glob("**/.coda-pack.json");
  packs.sort();
  for (let pack of packs) {
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
    console.log("Backed up listing " + file);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

run();
