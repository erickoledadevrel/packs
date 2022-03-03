import {executeFormulaFromPackDef} from '@codahq/packs-sdk/dist/development';
import {pack} from './pack';
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";

const isEmailRuns = [
  {input: "alice@example.com", expected: true},
  {input: "Alice <alice@example.com>", expected: true},
  {input: "\"Alice\" <alice@example.com>", expected: true},
  {input: "alice", expected: false},
  {input: "alice@", expected: false},
  {input: "@alice", expected: false},
  {input: "Alice <>", expected: false},
];

describe('IsEmail', () => {
  for (const {input, expected} of isEmailRuns) {
    it(`With input: ${input}`, async () => {
      const result = await executeFormulaFromPackDef(pack, 'IsEmail', [input]);
      assert.equal(result, expected);
    });
  }
});

describe('IsEmailList', () => {
  for (let {input, expected} of isEmailRuns) {
    it(`With input: ${input}`, async () => {
      const result = await executeFormulaFromPackDef(pack, 'IsEmailList', [input]);
      assert.equal(result, expected);
    });
    for (let other of isEmailRuns) {
      let combinedInput = input + ", " + other.input;
      let combinedExpected = expected && other.expected;
      it(`With input: ${combinedInput}`, async () => {
        const result = await executeFormulaFromPackDef(pack, 'IsEmailList', [combinedInput]);
        assert.equal(result, combinedExpected);
      });
    }
  }
});

const emailAddressRuns = [
  {input: "alice@example.com", expected: "alice@example.com"},
  {input: "Alice <alice@example.com>", expected: "alice@example.com"},
  {input: "\"Alice\" <alice@example.com>", expected: "alice@example.com"},
  {input: "alice", expected: ""},
  {input: "alice@", expected: ""},
  {input: "@alice", expected: ""},
  {input: "Alice <>", expected: ""},
];

describe('EmailAddress', () => {
  for (const {input, expected} of emailAddressRuns) {
    it(`With input: ${input}`, async () => {
      const result = await executeFormulaFromPackDef(pack, 'EmailAddress', [input]);
      assert.equal(result, expected);
    });
  }
});

describe('EmailAddresses', () => {
  for (let {input, expected} of isEmailRuns) {
    it(`With input: ${input}`, async () => {
      const result = await executeFormulaFromPackDef(pack, 'IsEmailList', [input]);
      assert.equal(result, expected);
    });
    for (let other of isEmailRuns) {
      let combinedInput = input + ", " + other.input;
      let combinedExpected = expected && other.expected;
      it(`With input: ${combinedInput}`, async () => {
        const result = await executeFormulaFromPackDef(pack, 'IsEmailList', [combinedInput]);
        assert.equal(result, combinedExpected);
      });
    }
  }
});