/**
 * Regression tests for #1834: /retro wrote "3 Things to Improve" as prose only,
 * so the next retro could not tell whether last week's recommendations were
 * acted on. The Step 13 snapshot now saves them and Step 12 scores them.
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { expectMentions, expectTokens } from "./helpers/prompt-structure";

const ROOT = path.resolve(import.meta.dir, "..");
const SKILL = fs.readFileSync(path.join(ROOT, "retro", "SKILL.md"), "utf-8");
const REPORT = fs.readFileSync(path.join(ROOT, "retro", "sections", "report-format.md"), "utf-8");

function step(heading: string, next: string): string {
  const start = SKILL.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = SKILL.indexOf(next, start + heading.length);
  expect(end).toBeGreaterThan(start);
  return SKILL.slice(start, end);
}

describe("#1834 retro persists recommendations and detects follow-through", () => {
  const step12 = step("### Step 12:", "### Step 13:");
  const step13 = step("### Step 13:", "### Step 14:");

  test("Step 13 schema always saves the 3 Things to Improve as recommendations", () => {
    const schema = step13.match(/```json\n(\{[\s\S]*?\n\})\n```/)?.[1] ?? "";
    const parsed = JSON.parse(schema);
    expect(Array.isArray(parsed.recommendations)).toBe(true);
    expect(Object.keys(parsed.recommendations[0]).sort()).toEqual(["category", "text"]);
    expect(step13).toContain("**`recommendations` は常に含めてください:**");
    expect(step13).toContain("該当がなければ `[]` と書きます");
    expectMentions(step13, [["共有用の一行サマリー", "改善すべき 3 点", "JSON のスナップショットを保存"]], "Step 13");
  });

  test("Step 12 scores prior recommendations and skips older snapshots silently", () => {
    expect(step12).toContain("**推奨事項のフォロースルー:**");
    expectTokens(step12, ["`addressed`", "`partial`", "`open`", "**Recommendation follow-through**"], "Step 12");
    expectMentions(step12, [["過去の推奨事項 3 件のうち 2 件に対応"]], "Step 12");
    expectMentions(step12, [["`recommendations` キーがなければ", "黙って省略"]], "Step 12");
  });

  test("report format ties the 3 Things to Improve to the saved items", () => {
    const improve = REPORT.slice(REPORT.indexOf("### 改善すべき 3 点"), REPORT.indexOf("### 来週の習慣 3 点"));
    expectMentions(improve, [["Step 13", "スナップショット", "`recommendations`", "保存"]], "improve section");
    expectMentions(REPORT, [["Step 12", "推奨事項のフォロースルー", "含める"]], "report format");
  });

  test("global mode snapshot is unchanged", () => {
    expect(step("## Global Retrospective Mode", "## Compare Mode")).not.toContain("recommendations");
  });
});
