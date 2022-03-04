import {executeFormulaFromPackDef} from '@codahq/packs-sdk/dist/development';
import {pack} from './pack';
import * as chai from "chai";
import {assert} from "chai";
import {describe} from "mocha";
import {it} from "mocha";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
chai.should();

const validEmails = [
  {input: "alice@example.com", address: "alice@example.com", parts: {}},
  {input: "Alice <alice@example.com>", address: "alice@example.com"},

  {input: "alice@example.com", valid: true},
  {input: "Alice <alice@example.com>", expected: true},
  {input: "\"Alice\" <alice@example.com>", expected: true},
  {input: "alice", expected: false},
  {input: "alice@", expected: false},
  {input: "@alice", expected: false},
  {input: "Alice <>", expected: false},
];

describe('IsEmail', () => {
  it(`Address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmail', ["alice@example.com"]);
    assert.isTrue(result);
  });

  it(`Name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmail', ["Alice <alice@example.com>"]);
    assert.isTrue(result);
  });

  it(`Not email`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmail', ["Alice"]);
    assert.isFalse(result);
  });
});

describe('IsEmailList', () => {
  it(`Single address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmailList', ["alice@example.com"]);
    assert.isTrue(result);
  });

  it(`Single name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmailList', ["Alice <alice@example.com>"]);
    assert.isTrue(result);
  });

  it(`Multiple addresses`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmailList', ["alice@example.com, bob@example.com"]);
    assert.isTrue(result);
  });

  it(`Multiple names`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmailList', ["Alice <alice@example.com>, Bob <bob@example.com>"]);
    assert.isTrue(result);
  });

  it(`Mixed`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmailList', ["alice@example.com, Bob <bob@example.com>"]);
    assert.isTrue(result);
  });

  it(`Not email`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'IsEmail', ["Alice, Bob"]);
    assert.isFalse(result);
  });
});

describe('EmailAddress', () => {
  it(`Address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddress', ["alice@example.com"]);
    assert.equal(result, "alice@example.com");
  });

  it(`Name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddress', ["Alice <alice@example.com>"]);
    assert.equal(result, "alice@example.com");
  });

  it(`Not email`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'EmailAddress', ["Alice"]);
    await invocation.should.be.rejected;
  });
});

describe('EmailAddresses', () => {
  it(`Single address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddresses', ["alice@example.com"]);
    assert.deepEqual(result, ["alice@example.com"]);
  });

  it(`Single name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddresses', ["Alice <alice@example.com>"]);
    assert.deepEqual(result, ["alice@example.com"]);
  });

  it(`Multiple addresses`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddresses', ["alice@example.com, bob@example.com"]);
    assert.deepEqual(result, ["alice@example.com", "bob@example.com"]);
  });

  it(`Multiple names`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddresses', ["Alice <alice@example.com>, Bob <bob@example.com>"]);
    assert.deepEqual(result, ["alice@example.com", "bob@example.com"]);
  });

  it(`Mixed`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailAddresses', ["alice@example.com, Bob <bob@example.com>"]);
    assert.deepEqual(result, ["alice@example.com", "bob@example.com"]);
  });

  it(`Not email`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'EmailAddresses', ["Alice, Bob"]);
    await invocation.should.be.rejected;
  });
});

describe('EmailParts', () => {
  it(`Address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailParts', ["alice@example.com"]);
    assert.deepEqual(result, {
      Name: null,
      Address: "alice@example.com",
      Local: "alice",
      Domain: "example.com",
    });
  });

  it(`Name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailParts', ["Alice <alice@example.com>"]);
    assert.deepEqual(result, {
      Name: "Alice",
      Address: "alice@example.com",
      Local: "alice",
      Domain: "example.com",
    });
  });

  it(`Not email`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'EmailParts', ["Alice"]);
    await invocation.should.be.rejected;
  });
});

describe('EmailListParts', () => {
  it(`Single address`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailListParts', ["alice@example.com"]);
    assert.deepEqual(result, [
      {
        Name: null,
        Address: "alice@example.com",
        Local: "alice",
        Domain: "example.com",
      }
    ]);
  });

  it(`Single name`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailListParts', ["Alice <alice@example.com>"]);
    assert.deepEqual(result, [
      {
        Name: "Alice",
        Address: "alice@example.com",
        Local: "alice",
        Domain: "example.com",
      }
    ]);
  });

  it(`Multiple addresses`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailListParts', ["alice@example.com, bob@example.com"]);
    assert.deepEqual(result, [
      {
        Name: null,
        Address: "alice@example.com",
        Local: "alice",
        Domain: "example.com",
      },
      {
        Name: null,
        Address: "bob@example.com",
        Local: "bob",
        Domain: "example.com",
      }
    ]);
  });

  it(`Multiple names`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailListParts', ["Alice <alice@example.com>, Bob <bob@example.com>"]);
    assert.deepEqual(result, [
      {
        Name: "Alice",
        Address: "alice@example.com",
        Local: "alice",
        Domain: "example.com",
      },
      {
        Name: "Bob",
        Address: "bob@example.com",
        Local: "bob",
        Domain: "example.com",
      }
    ]);
  });

  it(`Mixed`, async () => {
    const result = await executeFormulaFromPackDef(pack, 'EmailListParts', ["alice@example.com, Bob <bob@example.com>"]);
    assert.deepEqual(result, [
      {
        Name: null,
        Address: "alice@example.com",
        Local: "alice",
        Domain: "example.com",
      },
      {
        Name: "Bob",
        Address: "bob@example.com",
        Local: "bob",
        Domain: "example.com",
      }
    ]);
  });

  it(`Not email`, async () => {
    let invocation = executeFormulaFromPackDef(pack, 'EmailListParts', ["Alice, Bob"]);
    await invocation.should.be.rejected;
  });
});