#!/bin/bash
npm install date-holidays@"<4.0.0" &&
npx mocha --require ts-node/register holidays/pack_test.ts &&
npx coda upload holidays/pack.ts --notes="Update NPM package"
