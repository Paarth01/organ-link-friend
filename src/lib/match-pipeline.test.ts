import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ACTIVE_MATCH_STATUSES, canCompleteMatch, canConfirmMatch, hasAssignedHospital } from "./match-pipeline";

describe("match pipeline rules", () => {
  it("counts only proposed and confirmed matches as active", () => {
    assert.deepEqual(ACTIVE_MATCH_STATUSES, ["proposed", "accepted"]);
  });

  it("requires a nonblank hospital before confirming a proposed match", () => {
    assert.equal(canConfirmMatch("proposed", "Lilavati Hospital", "available", "waiting"), true);
    assert.equal(canConfirmMatch("proposed", "  ", "available", "waiting"), false);
    assert.equal(canConfirmMatch("proposed", "Lilavati Hospital", "matched", "waiting"), false);
    assert.equal(canConfirmMatch("proposed", "Lilavati Hospital", "available", "matched"), false);
    assert.equal(canConfirmMatch("accepted", "Lilavati Hospital", "available", "waiting"), false);
  });

  it("recognizes a hospital name after trimming whitespace", () => {
    assert.equal(hasAssignedHospital("  Apollo Hospital  "), true);
    assert.equal(hasAssignedHospital(" \n "), false);
  });

  it("allows completion only after a match is confirmed", () => {
    assert.equal(canCompleteMatch("accepted"), true);
    assert.equal(canCompleteMatch("proposed"), false);
    assert.equal(canCompleteMatch("rejected"), false);
    assert.equal(canCompleteMatch("completed"), false);
  });
});