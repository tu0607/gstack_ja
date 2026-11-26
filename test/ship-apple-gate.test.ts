/**
 * R2 pin (fork port wave 2): the Apple release adapter loads BEFORE ship's
 * branch gate, and the non-Apple gate is byte-unchanged.
 *
 * Two failure modes this prevents: a future ship-template refactor that
 * re-blocks store releases behind "ship from a feature branch" (the exact
 * live failure the fork hit — a solo dev with a clean tree on main shipping
 * to TestFlight got aborted over branch topology), and the reverse — the
 * Apple path accidentally weakening the branch gate for normal
 * repository-landing ships.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { expectMentions } from './helpers/prompt-structure';

const ROOT = join(import.meta.dir, "..");
const SKELETON = readFileSync(join(ROOT, "ship", "SKILL.md"), "utf-8");

const GATE_TEXT = "「You're on the base branch. Ship from a feature branch.」";

describe("ship Apple gate ordering (R2)", () => {
  test("the section index requires a store-distribution request, not merely an Apple repository", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "ship", "sections", "manifest.json"), "utf-8"));
    const apple = manifest.sections.find((section: { id: string }) => section.id === "apple-release");
    expect(SKELETON).toContain("App Store/TestFlight 配布の依頼");
  });

  test("the Apple adapter read directive precedes the branch gate", () => {
    const appleRead = SKELETON.indexOf("sections/apple-release.md");
    const gate = SKELETON.indexOf(GATE_TEXT);
    expect(appleRead).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(-1);
    expect(appleRead).toBeLessThan(gate);
  });

  test("store distribution explicitly bypasses the branch/PR ceremony", () => {
    expectMentions(SKELETON, [['App Store', '現在のブランチ', 'ベースブランチ']], 'SKELETON');
    expectMentions(SKELETON, [['ブランチゲート', 'リポジトリへの取り込み', 'のみ']], 'SKELETON');
  });

  test("the non-Apple branch gate is byte-unchanged and appears exactly once", () => {
    const first = SKELETON.indexOf(GATE_TEXT);
    expect(first).toBeGreaterThan(-1);
    expect(SKELETON.indexOf(GATE_TEXT, first + 1)).toBe(-1);
  });

  test("the adapter section exists in the union with its battle-tested spine", () => {
    const section = readFileSync(join(ROOT, "ship", "sections", "apple-release.md"), "utf-8");
    for (const anchor of ["承認の機会", "fastlane spaceauth", "iris/v1/apiKeys", "appPriceSchedules"]) {
      expect(section).toContain(anchor);
    }
    expectMentions(section, [['前に', '認証情報', '分類']], 'section');
    expectMentions(section, [['ストア配布', 'リポジトリへの取り込みではありません']], 'section');
  });

  test("routine interaction limits cannot waive blocking documentation or safety decisions", () => {
    for (const name of ["apple-release.md.tmpl", "apple-release.md"]) {
      const section = readFileSync(join(ROOT, "ship", "sections", name), "utf-8").replace(/\s+/g, " ");
      expect(section).toContain("2 回の通常のやり取り");
      expectMentions(section, [['STOP', '承認', '判断']], 'section');
      expect(section.indexOf("**ドキュメントの事前確認:**")).toBeLessThan(section.indexOf("## 承認の機会は 1 回だけ"));
      expect(section).toContain("`read-only` モード");
      expectMentions(section, [['配布の前に', 'ドキュメントリスク']], 'section');
    }
  });
});
