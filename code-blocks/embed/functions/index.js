const functions = require("firebase-functions");

exports.index = functions.https.onRequest((request, response) => {
  let url = `https://${request.headers.host}${request.url}`;
  response.send(`
    <html>
      <head>
        <link rel="alternate" 
              type="application/json+oembed"
              href="/oembed?url=${encodeURIComponent(url)}&format=json"
              title="Code Block Embed" />
      </head>
      <body>Loading...</body>
    </html>
  `);
});

exports.oembed = functions.https.onRequest((request, response) => {
  response.send({
    type: "rich",
    version: "1.0",
    html: "This is my embed",
    width: 400,
    height: 200,
  });
});
