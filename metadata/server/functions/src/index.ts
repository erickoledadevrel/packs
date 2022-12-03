import * as functions from "firebase-functions";

export const redirect = functions.https.onRequest(async (request, response) => {
  const secret = request.headers.authorization?.split(" ")[1];
  if (secret != process.env.SECRET_VALUE) {
    response.status(403).send("Invalid authorization.");
    return;
  }
  const url = request.query.url as string;
  if (!url) {
    response.status(400).send("Missing parameter: url");
    return;
  }
  response.redirect(url);
});
