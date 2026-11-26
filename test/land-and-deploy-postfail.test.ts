/**
 * Coverage for PR #1620 — Post-failure PR-state check after `gh pr merge`
 * non-zero exit.
 *
 * The fix lives in land-and-deploy/sections/merge-and-deploy.md.tmpl as Step
 * §4a-postfail (the Step 4/5 body was carved out of the skeleton into an
 * on-demand section — prompt-token-load-reduction carve; the skeleton keeps
 * only the STOP-Read pointer). After ANY non-zero `gh pr merge`, the skill
 * must query authoritative PR state via
 * GraphQL (including queue membership) and
 * branch on the result instead of blindly retrying `gh pr merge`.
 *
 * Static invariants pin:
 *   - §4a-postfail header present
 *   - Query-before-retry invariant after any non-zero merge exit
 *   - All three state branches (MERGED, OPEN, CLOSED) named explicitly
 *   - MERGED branch: capture merge SHA via mergeCommit.oid
 *   - MERGED branch: non-destructive worktree cleanup with uncommitted-work guard
 *   - MERGED branch: continues to §4a CI watch
 *   - OPEN branch: checks autoMergeRequest before treating as failure
 *   - CLOSED branch: STOPs
 *   - Hard rule: no replay after MERGED; one guarded auto-to-direct fallback
 *   - .tmpl edit propagated to generated SKILL.md (atomic per T-Codex-3)
 */
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { expectMentions } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, "..");
const TMPL = path.join(ROOT, "land-and-deploy", "sections", "merge-and-deploy.md.tmpl");
const MD = path.join(ROOT, "land-and-deploy", "sections", "merge-and-deploy.md");

function readTmpl(): string {
  return fs.readFileSync(TMPL, "utf-8");
}
function readMd(): string {
  return fs.readFileSync(MD, "utf-8");
}

describe("PR #1620 §4a-postfail in land-and-deploy template", () => {
  test("§4a-postfail header present in template", () => {
    expect(readTmpl()).toMatch(/### 4a-postfail: /);
  });

  test("§4a-postfail comes before §4a (Merge queue detection)", () => {
    const body = readTmpl();
    const postfail = body.indexOf("### 4a-postfail:");
    const queue = body.indexOf("### 4a: ");
    expect(postfail).toBeGreaterThan(-1);
    expect(queue).toBeGreaterThan(-1);
    expect(postfail).toBeLessThan(queue);
  });

  test("any non-zero merge exit queries authoritative state before retrying", () => {
    const body = readTmpl().replace(/\s+/g, " ");
    expectMentions(body, [['`gh pr merge`', '非ゼロ', '権威ある', '照会', 'リトライ']], 'body');
  });

  test("Authoritative state query includes auto request and queue membership", () => {
    const body = readTmpl();
    expect(body).toMatch(/gh api graphql/);
    expect(body).toContain('autoMergeRequest { enabledAt } mergeQueueEntry { id state }');
  });

  test("All three state branches named: MERGED, OPEN, CLOSED", () => {
    const body = readTmpl();
    expect(body).toMatch(/state == "MERGED"/);
    expect(body).toMatch(/state == "OPEN"/);
    expect(body).toMatch(/state == "CLOSED"/);
  });

  test("MERGED branch captures merge SHA via mergeCommit.oid", () => {
    const body = readTmpl();
    expect(body).toMatch(/jq -er '\.data\.repository\.pullRequest\.mergeCommit\.oid'/);
  });

  test("MERGED worktree cleanup is non-destructive (uncommitted-work guard)", () => {
    const body = readTmpl();
    expectMentions(body, [['コミットされていない作業', '何も削除せず', 'worktree', '停止']], 'body');
    expectMentions(body, [['`--force`', '使わない']], 'body');
    expectMentions(body, [['メインの作業ツリー', '削除しない']], 'body');
  });

  test("MERGED branch continues to §4b CI auto-deploy detection", () => {
    const body = readTmpl();
    expect(body).toContain('§4b');
  });

  // #2656: the failed merge carried --delete-branch; the recovery path must
  // reconcile the remote branch instead of silently dropping that half.
  // #2696: that reconciliation must target the PR head repository, not the
  // base checkout's origin, because fork branches do not exist in origin.
  test("MERGED branch reconciles the PR head repository (ls-remote, confirm-first delete)", () => {
    const body = readTmpl();
    expect(body).toMatch(/gh pr view "\$PR_NUMBER" --repo "\$REPO" --json headRepositoryOwner,headRepository,headRefName/);
    // gh leaves .headRepository.nameWithOwner empty (verified live, gh 2.83) —
    // owner/name is composed from headRepositoryOwner.login + headRepository.name.
    expect(body).toMatch(/headRepositoryOwner\.login/);
    expect(body).not.toMatch(/\[\.headRepository\.nameWithOwner/);
    // The head repository and branch are PR data: read into shell variables
    // from gh's JSON, never model-substituted into the command.
    expect(body).toMatch(/IFS=\$'\\t' read -r HEAD_REPO HEAD_BRANCH <<< "\$\(gh pr view/);
    expect(body).toMatch(/git ls-remote --heads "https:\/\/github\.com\/\$HEAD_REPO\.git" "refs\/heads\/\$HEAD_BRANCH"/);
    expect(body).toMatch(/git push "https:\/\/github\.com\/\$HEAD_REPO\.git" --delete "refs\/heads\/\$HEAD_BRANCH"/);
    expect(body).not.toMatch(/git ls-remote --heads origin/);
    expect(body).not.toMatch(/git push origin --delete/);
    // Confirm-first: deletion is offered, never unilateral.
    expectMentions(body, [['削除しますか', '確認']], 'body');
  });

  test("MERGED branch reconciliation distinguishes branch-absent from check-failed", () => {
    const body = readTmpl();
    // exit 0 + empty output = already clean (idempotent re-runs)...
    expectMentions(body, [['終了コード 0', '出力が空', 'すでに存在しません']], 'body');
    // ...non-zero exit = unknown state, never read as a clean branch.
    expectMentions(body, [['失敗した確認', 'クリーンなブランチ', '読まない']], 'body');
  });

  test("OPEN branch checks autoMergeRequest before treating as failure", () => {
    const body = readTmpl();
    expect(body).toMatch(/autoMergeRequest != null or \.mergeQueueEntry != null/);
  });

  test("CLOSED branch STOPs", () => {
    const body = readTmpl();
    expect(body).toMatch(/state == "CLOSED"[\s\S]{0,200}\bstop\b/i);
  });

  test("Hard rule: no replay after MERGED and only one guarded direct fallback", () => {
    const body = readTmpl().replace(/\s+/g, " ");
    expectMentions(body, [['MERGED', '決して', 'マージを再実行しない']], 'body');
    expectMentions(body, [['1 回だけ', '直接マージ', 'フォールバック']], 'body');
    expectMentions(body, [['直接の試行', 'フォールバックはありません']], 'body');
    expectMentions(body, [['OPEN', '自動リクエストなし', 'キューエントリなし']], 'body');
  });

  test("Generated merge-and-deploy.md carries the §4a-postfail section (atomic regen per T-Codex-3)", () => {
    const md = readMd();
    expect(md).toMatch(/### 4a-postfail: /);
    expect(md).toMatch(/state == "MERGED"/);
    expect(md).toMatch(/headRepositoryOwner\.login/);
    expect(md).not.toMatch(/git ls-remote --heads origin/);
  });
});
