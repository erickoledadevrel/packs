import {executeFormulaFromPackDef} from "@codahq/packs-sdk/dist/development";
import {pack} from "./pack";
import * as chai from "chai";
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

describe("Examples", () => {
  for (let formula of pack.formulas) {
    if (formula.cacheTtlSecs == 0 || !formula.examples) continue;
    describe(formula.name, () => {
      for (let [i, example] of formula.examples.entries()) {
        it(`Example ${i}`, async () => {
          const result = await executeFormulaFromPackDef(pack, formula.name, example.params as any, undefined, undefined, {
            useRealFetcher: true,
            manifestPath: require.resolve("./pack"),
          });
          if (typeof example.result == "object") {
            assert.deepEqual(result, example.result);
          } else {
            assert.equal(result, example.result);
          }
        });
      }
    });
  }
});
