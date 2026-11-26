/**
 * /ship's early Greptile PR wiring (B2: CEO-8, DX-10, ENG-20 and the gate
 * decision). The helper's behavior is in test/greptile-early*.test.ts; this
 * pins where /ship calls it and what each outcome does.
 */
import { describe, expect, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import { expectMentions } from "./helpers/prompt-structure";

const ROOT = path.resolve(import.meta.dir, "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const skeleton = read("ship/SKILL.md.tmpl");
const early = read("ship/sections/greptile-early.md.tmpl");
const step10 = read("ship/sections/greptile.md.tmpl");
const prBody = read("ship/sections/pr-body.md.tmpl");
const flat = (s: string) => s.replace(/\s+/g, " ");

describe("/ship Step 6.5 early Greptile PR", () => {
  test("it runs after the tests section and before coverage, and the section index lists it", () => {
    const at = (m: string) => skeleton.indexOf(m);
    expect(at("{{SECTION:tests}}")).toBeLessThan(at("{{SECTION:greptile-early}}"));
    expect(at("{{SECTION:greptile-early}}")).toBeLessThan(at("{{SECTION:test-coverage}}"));
    expectMentions(skeleton, [["6.5、11.5、14.5"]], "ship skeleton step list");
    expect(read("ship/SKILL.md")).toContain("(Step 6.5) | `sections/greptile-early.md` |");
  });

  test("detect decides; off continues, ask asks once with remembered consent, on pushes and opens", () => {
    const s = flat(early);
    expect(early).toContain("~/.claude/skills/gstack/bin/gstack-greptile-early detect");
    expect(s).toContain("**`GREPTILE_EARLY: off`**");
    expect(s).toContain("**`GREPTILE_EARLY: ask`**");
    expect(s).toContain("**`GREPTILE_EARLY: on`**");
    expectMentions(s, [["`GREPTILE_EARLY: off`", "Step 7 に進みます"], ["`GREPTILE_EARLY: ask`", "AskUserQuestion"]], "early detect outcomes");
    expect(s).toContain("gstack-greptile-early consent yes`");
    expect(s).toContain("`consent no`");
    expectMentions(s, [["`Greptile: found …`", "ユーザーに示し"]], "found line shown to the user");
    const push = early.indexOf("git push -u origin <branch-name>");
    const title = early.indexOf("{{FREE_TEXT_FILE:TITLE_FILE=early-title}}");
    const open = early.indexOf('gstack-greptile-early open --base <base> --title-file "$TITLE_FILE"');
    expect(push).toBeGreaterThan(0);
    expect(title).toBeGreaterThan(push);
    expect(open).toBeGreaterThan(title);
    expectMentions(s, [["`--ready`", "ドラフトでない PR"], ["`EARLY_PR`", "`EARLY_PR_OPENED_AT`", "実行記録に保存"]], "early open flags and saved values");
  });

  test("a stopped /ship leaves the draft open with one comment through gstack-post (ENG-20)", () => {
    const s = flat(early);
    expectMentions(s, [["ドラフトを開いたままにし", "決して閉じたり force-push したりしないこと"], ["/ship が停止したこと", "コメントを 1 件投稿"]], "stopped ship leaves the draft");
    expect(early).toContain("gstack-post pr-comment <pr-number> --body-file <that file>");
    expectMentions(flat(skeleton), [["初期の Greptile PR は残す"], ["ドラフトを開いたままにし", "理由を書いたコメントを 1 つ残します"]], "early PR stays up");
  });
});

describe("/ship Step 10 waits for the early review", () => {
  test("the wait runs after the PR check and before the dispatch, bounded, with an honest timeout", () => {
    const check = step10.indexOf("`PR: exists` の場合にのみ dispatch します。");
    const wait = step10.indexOf("gstack-greptile-early wait <pr-number> --since <opened-at>");
    const dispatch = step10.indexOf("Agent でサブエージェントを dispatch します");
    expect(check).toBeGreaterThan(0);
    expect(wait).toBeGreaterThan(check);
    expect(dispatch).toBeGreaterThan(wait);
    const s = flat(step10.slice(wait, dispatch));
    expectMentions(s, [
      ["`GREPTILE_REVIEW: pending`", "再実行します"],
      ["`timeout`", "`unavailable`", "Unavailable のトリアージ経路", "理由として"],
      ["コメントがゼロだと主張してはいけません"],
      ["現在の差分に照らしてトリアージします"],
    ], "early review wait outcomes");
  });
});

describe("/ship Steps 18-19 finish the early PR", () => {
  test("the provisional title is replaced and the draft is marked ready unless a draft was asked for", () => {
    expectMentions(flat(prBody), [["既存の open な PR/MR", "Step 6.5 の早期 PR", "項目 2"]], "pr-body existing PR item");
    // Gate integrity (HONEST_WORK_GATE_INTEGRITY W3): the early draft is marked
    // ready only when the user did not ask for a draft AND no gate finding is open.
    const ready = flat(prBody).slice(flat(prBody).indexOf('1. Step 6.5 でこの PR を早期の下書きとして開いており'));
    expect(ready.length).toBeGreaterThan(0);
    expectMentions(ready, [["Step 6.5", "早期の下書き", "ユーザーが下書きを求めておらず", "`open` のものがない", "`gh pr ready <pr-number>`"]], "draft ready condition");
  });
});
