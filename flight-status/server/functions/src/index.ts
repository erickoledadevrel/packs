import * as functions from "firebase-functions";
const admin = require('firebase-admin');

admin.initializeApp({
  databaseURL: "https://erickoleda-flight-status.firebaseio.com/",
});

// @ts-ignore
import Amadeus = require('amadeus');

const MonthMax = 200;
const DocIdHeader = "X-DocId";

export const flightStatus = functions.https.onRequest(async (request, response) => {
  let docId = request.headers[DocIdHeader.toLocaleLowerCase()] as string;
  if (!docId) {
    throw new Error("Missing doc ID header.");
  }

  let hasQuota = checkQuota(docId);
  if (!hasQuota) {
    response.status(429).send("Monthly quota exceeded.");
  }

  const amadeus = getAmadeusClient();
  let apiResponse;
  try {
    console.log(request.query);
    apiResponse = await amadeus.client.get('/v2/schedule/flights', request.query);
  } catch (e: any) {
    response.status(400).send(e.response.result);
    return;
  }
  response.send(apiResponse.result);
});

async function checkQuota(docId: string): Promise<boolean> {
  let now = new Date();
  let month = now.toISOString().substring(0, 7);
  
  let db = admin.database();
  let countsRef = db.ref(`docs/${docId}/counts/${month}`);
  let transaction = await countsRef.transaction((count: number) => {
    if (!count) {
      return 1;
    }
    if (count >= MonthMax) {
      // Abort.
      return;
    }
    return count + 1;
  });
  return transaction.committed
}

function getAmadeusClient() {
  const AmadeusClientId = process.env.AMADEUS_CLIENT_ID;
  const AmadeusClientSecret = process.env.AMADEUS_CLIENT_SECRET;
  
  if (!AmadeusClientId || !AmadeusClientSecret) {
    throw new Error("Amadeus client ID or secret not found.");
  }
  
  return new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
  });
}