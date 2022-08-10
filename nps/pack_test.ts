import {executeFormulaFromPackDef} from '@codahq/packs-sdk/dist/development';
import {pack} from './pack';
import * as chai from "chai";
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

describe('NPS', () => {
  it(`All promoters`, async () => {
    const ratings = [9, 10];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 100);
  });

  it(`All detractors`, async () => {
    const ratings = [0, 1, 2, 3, 4, 5, 6];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, -100);
  });

  it(`All passives`, async () => {
    const ratings = [7, 8];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 0);
  });

  it(`All ratings`, async () => {
    const ratings = [4, 3, 0, 9, 5, 8, 10, 6, 1, 7, 2];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, -45);
  });

  it(`Balanced`, async () => {
    const ratings = [0, 1, 7, 8, 9, 10];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 0);
  });

  it(`Empty`, async () => {
    const ratings = [];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 0);
  });

  it(`Sparse`, async () => {
    const ratings = [1, null, 10, 10];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 33);
  });

  it(`Sparse empty`, async () => {
    const ratings = [null, null, null];
    const result = await executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    assert.equal(result, 0);
  });

  it(`Invalid`, async () => {
    const ratings = [-1, 1, 10, 11];
    const invocation = executeFormulaFromPackDef(pack, 'NPS', [ratings]);
    await invocation.should.be.rejected;
  });

});