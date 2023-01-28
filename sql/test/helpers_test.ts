import {executeFormulaFromPackDef} from '@codahq/packs-sdk/dist/development';
import * as chai from "chai";
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";
import * as chaiAsPromised from "chai-as-promised";
import { parseSpec } from '../helpers';
chai.use(chaiAsPromised);
chai.should();

describe('parseLoad', () => {
  it(`Table name`, async () => {
    const result = parseSpec("Foo");
    assert.deepEqual(result, {table: "Foo", doc: undefined, destination: undefined});
  });
  it(`Spaces in table name`, async () => {
    const result = parseSpec("Foo Foo");
    assert.deepEqual(result, {table: "Foo Foo", doc: undefined, destination: undefined});
  });
  it(`With doc ID`, async () => {
    const result = parseSpec("Foo@1234");
    assert.deepEqual(result, {table: "Foo", doc: "1234", destination: undefined});
  });
  it(`With destination`, async () => {
    const result = parseSpec("Foo=>Bar");
    assert.deepEqual(result, {table: "Foo", doc: undefined, destination: "Bar"});
  });
  it(`With doc ID and destination`, async () => {
    const result = parseSpec("Foo@1234=>Bar");
    assert.deepEqual(result, {table: "Foo", doc: "1234", destination: "Bar"});
  });
  it(`With whitespace`, async () => {
    const result = parseSpec("  Foo  @  1234  =>  Bar  ");
    assert.deepEqual(result, {table: "Foo", doc: "1234", destination: "Bar"});
  });
});
