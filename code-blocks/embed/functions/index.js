const fs = require("fs");
const path = require('path');

const functions = require("firebase-functions");

exports.index = functions.https.onRequest((request, response) => {
  let host = request.headers["x-forwarded-host"] || request.headers.host;
  let url = new URL(`${request.protocol}://${host}${request.path}`);
  for (let key of Object.keys(request.query)) {
    url.searchParams.append(key, request.query[key]);  
  }
  let template = fs.readFileSync(path.resolve("index.html")).toString();
  let page = template
    .replace("{protocol}", request.protocol)
    .replace("{host}", host)
    .replace("{url}", encodeURIComponent(url));
  response.send(page);
});

exports.oembed = functions.https.onRequest((request, response) => {
  response.send({
    type: "rich",
    version: "1.0",
    html: `<iframe src="${request.query.url}">`,
    width: 400,
    height: 200,
  });
});
