import { describe, expect, it } from "vitest";
import { buildPageList, ELLIPSIS } from "./table-pagination";

describe("buildPageList", () => {
  it("shows all pages when total is small", () => {
    expect(buildPageList(1, 4)).toEqual([1, 2, 3, 4]);
  });

  it("shows single page when totalPages is 1", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
  });

  it("adds ellipsis after first page when current page is far from start", () => {
    expect(buildPageList(10, 20)).toEqual([1, ELLIPSIS, 9, 10, 11, ELLIPSIS, 20]);
  });

  it("has no leading ellipsis when near the start", () => {
    expect(buildPageList(1, 20)).toEqual([1, 2, ELLIPSIS, 20]);
  });

  it("has no trailing ellipsis when near the end", () => {
    expect(buildPageList(20, 20)).toEqual([1, ELLIPSIS, 19, 20]);
  });

  it("does not duplicate adjacent pages near boundaries", () => {
    expect(buildPageList(2, 20)).toEqual([1, 2, 3, ELLIPSIS, 20]);
  });
});
