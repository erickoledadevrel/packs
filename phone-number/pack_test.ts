import {executeFormulaFromPackDef} from '@codahq/packs-sdk/dist/development';
import {pack} from './pack';
import * as chai from "chai";
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

describe('IsPhoneNumber', () => {
  it(`US, Local`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["9164451254", "US"]);
    assert.isTrue(result);
  });

  it(`US, Local, Dashes`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["916-445-1254", "US"]);
    assert.isTrue(result);
  });

  it(`US, Local, Parens`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["(916) 445-1254", "US"]);
    assert.isTrue(result);
  });

  it(`US, Local, no region`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["9164451254"]);
    assert.isFalse(result);
  });

  it(`US, International`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["+19164451254"]);
    assert.isTrue(result);
  });

  it(`US, International, Formatted`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["+1 (916) 445-1254"]);
    assert.isTrue(result);
  });

  it(`US, International, with region`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["+19164451254", "US"]);
    assert.isTrue(result);
  });

  it(`US, International, with wrong region`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsPhoneNumber', ["+19164451254", "CA"]);
    assert.isTrue(result);  // Region code is ignored if the number contains it.
  });

});

describe('FormatPhoneNumber', () => {
  it(`US`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254"]);
    assert.equal(result, "+19164451254");
  });

  it(`US, Local`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["9164451254", "US"]);
    assert.equal(result, "+19164451254");
  });

  it(`US, e164 format`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254", null, "e164"]);
    assert.equal(result, "+19164451254");
  });

  it(`US, international format`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254", null, "international"]);
    assert.equal(result, "+1 916-445-1254");
  });

  it(`US, national format`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254", null, "national"]);
    assert.equal(result, "(916) 445-1254");
  });

  it(`US, rfc3966 format`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254", null, "rfc3966"]);
    assert.equal(result, "tel:+1-916-445-1254");
  });

  it(`US, significant format`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["+19164451254", null, "significant"]);
    assert.equal(result, "9164451254");
  });

  it(`Not phone number`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'FormatPhoneNumber', ["123"]);
    await invocation.should.be.rejected;
  });

});

describe('PhoneNumberInfo', () => {
  it(`US`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'PhoneNumberInfo', ["+19164451254"]);
    assert.deepEqual(result, {
      CanBeInternationallyDialled: true,
      Formats: {
        E164: "+19164451254",
        International: "+1 916-445-1254",
        National: "(916) 445-1254",
        Rfc3966: "tel:+1-916-445-1254",
        Significant: "9164451254",
      },
      Input: "+19164451254",
      RegionCode: "US",
      CountryCode: 1,
      Type: "fixed-line-or-mobile",
    });
  });

  it(`Not phone number`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'PhoneNumberParts', ["123"]);
    await invocation.should.be.rejected;
  });

});

describe("Examples", () => {
  for (let formula of pack.formulas) {
    describe(formula.name, () => {
      for (let [i, example] of formula.examples.entries()) {
        it(`Example ${i}`, async () => {
          const result = await executeFormulaFromPackDef(pack, formula.name, example.params as any); 
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