import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    createGitCheckpoint,
    gitCommitAll,
    gitRollback,
    isGitClean,
} from "./git.js";
import type { Task } from "../harness/types.js";

function git(args: string[], cwd: string): string {
    return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

describe("createGitCheckpoint", () => {
    let repo: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), "harness-git-"));
        git(["init", "-q"], repo);
        git(["config", "user.email", "test@example.com"], repo);
        git(["config", "user.name", "Test"], repo);
        writeFileSync(join(repo, "seed.txt"), "seed\n");
        git(["add", "-A"], repo);
        git(["commit", "-q", "-m", "seed"], repo);
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    const task: Task = { id: "task-1", description: "do a thing" };

    it("commits the working tree when the wrapped verify passes", async () => {
        const checkpoint = createGitCheckpoint({ cwd: repo });
        const verify = checkpoint.wrapVerify(() => ({ passed: true }));

        writeFileSync(join(repo, "new.txt"), "created by agent\n");
        const outcome = await verify({ task });

        expect(outcome.passed).toBe(true);
        expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(2);
        expect(git(["show", "-s", "--format=%s", "HEAD"], repo)).toContain(
            "task-1",
        );
        expect(git(["status", "--porcelain"], repo)).toBe("");
    });

    it("rolls the working tree back when the wrapped verify fails", async () => {
        const checkpoint = createGitCheckpoint({ cwd: repo });
        const verify = checkpoint.wrapVerify(() => ({
            passed: false,
            feedback: "nope",
        }));

        writeFileSync(join(repo, "new.txt"), "created by agent\n");
        const outcome = await verify({ task });

        expect(outcome.passed).toBe(false);
        expect(existsSync(join(repo, "new.txt"))).toBe(false); // discarded
        expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(1); // no new commit
        expect(git(["status", "--porcelain"], repo)).toBe("");
    });

    it("reports a noop when a passing attempt produced no changes", async () => {
        const actions: string[] = [];
        const checkpoint = createGitCheckpoint({
            cwd: repo,
            onCheckpoint: ({ action }) => actions.push(action),
        });
        const verify = checkpoint.wrapVerify(() => ({ passed: true }));

        await verify({ task });

        expect(actions).toEqual(["noop"]);
    });

    it("commits unconditionally when wrapVerify is called with no inner check", async () => {
        const checkpoint = createGitCheckpoint({ cwd: repo });
        const verify = checkpoint.wrapVerify(); // no inner → every attempt passes

        writeFileSync(join(repo, "new.txt"), "created by agent\n");
        const outcome = await verify({ task });

        expect(outcome.passed).toBe(true);
        expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(2);
    });

    it("reports commit and rollback actions through onCheckpoint", async () => {
        const actions: string[] = [];
        const checkpoint = createGitCheckpoint({
            cwd: repo,
            onCheckpoint: ({ action }) => actions.push(action),
        });

        writeFileSync(join(repo, "pass.txt"), "kept\n");
        await checkpoint.wrapVerify(() => ({ passed: true }))({ task });

        writeFileSync(join(repo, "fail.txt"), "discarded\n");
        await checkpoint.wrapVerify(() => ({ passed: false }))({ task });

        expect(actions).toEqual(["commit", "rollback"]);
    });

    it("uses the task id as the subject when the description is empty", async () => {
        const checkpoint = createGitCheckpoint({ cwd: repo });
        const verify = checkpoint.wrapVerify(() => ({ passed: true }));

        writeFileSync(join(repo, "new.txt"), "created by agent\n");
        await verify({ task: { id: "task-empty", description: "" } });

        expect(git(["show", "-s", "--format=%s", "HEAD"], repo)).toBe(
            "feat(task-empty): task-empty",
        );
    });

    it("defaults cwd to process.cwd() and accepts a clean tree with no options", () => {
        // Exercise the no-arg construction (cwd defaults to process.cwd(),
        // requireCleanStart defaults on) against a known-clean tree by running
        // it from inside the seeded temp repo, so it doesn't depend on the real
        // working tree being clean.
        const original = process.cwd();
        process.chdir(repo);
        try {
            const checkpoint = createGitCheckpoint();
            expect(typeof checkpoint.wrapVerify).toBe("function");
        } finally {
            process.chdir(original);
        }
    });

    it("refuses to construct when the working tree is dirty by default", () => {
        writeFileSync(join(repo, "uncommitted.txt"), "work in progress\n");

        expect(() => createGitCheckpoint({ cwd: repo })).toThrow(
            /dirty working tree/,
        );
        // The pre-existing work is left untouched — nothing was reset or cleaned.
        expect(existsSync(join(repo, "uncommitted.txt"))).toBe(true);
    });

    it("runs over a dirty tree when requireCleanStart is false", async () => {
        writeFileSync(join(repo, "pre-existing.txt"), "kept\n");
        const checkpoint = createGitCheckpoint({
            cwd: repo,
            requireCleanStart: false,
        });

        writeFileSync(join(repo, "new.txt"), "created by agent\n");
        const outcome = await checkpoint.wrapVerify(() => ({ passed: true }))({
            task,
        });

        expect(outcome.passed).toBe(true);
        // Both the pre-existing and the agent file are swept into the commit.
        expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(2);
        expect(git(["status", "--porcelain"], repo)).toBe("");
    });
});

describe("git helpers", () => {
    let repo: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), "harness-git-helpers-"));
        git(["init", "-q"], repo);
        git(["config", "user.email", "test@example.com"], repo);
        git(["config", "user.name", "Test"], repo);
        writeFileSync(join(repo, "seed.txt"), "seed\n");
        git(["add", "-A"], repo);
        git(["commit", "-q", "-m", "seed"], repo);
    });

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true });
    });

    describe("isGitClean", () => {
        it("returns true when the working tree has no changes", () => {
            expect(isGitClean(repo)).toBe(true);
        });

        it("returns false for an unstaged change", () => {
            writeFileSync(join(repo, "seed.txt"), "modified\n");
            expect(isGitClean(repo)).toBe(false);
        });

        it("returns false for an untracked file", () => {
            writeFileSync(join(repo, "new.txt"), "new\n");
            expect(isGitClean(repo)).toBe(false);
        });

        it("returns false for a staged but uncommitted change", () => {
            writeFileSync(join(repo, "new.txt"), "new\n");
            git(["add", "-A"], repo);
            expect(isGitClean(repo)).toBe(false);
        });
    });

    describe("gitCommitAll", () => {
        it("stages and commits everything, returning true", () => {
            writeFileSync(join(repo, "new.txt"), "new\n");

            expect(gitCommitAll("add new file", repo)).toBe(true);
            expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(2);
            expect(git(["show", "-s", "--format=%s", "HEAD"], repo)).toBe(
                "add new file",
            );
            expect(isGitClean(repo)).toBe(true);
        });

        it("returns false and creates no commit when there is nothing to commit", () => {
            expect(gitCommitAll("nothing to do", repo)).toBe(false);
            expect(git(["log", "--oneline"], repo).split("\n")).toHaveLength(1);
        });
    });

    describe("gitRollback", () => {
        it("discards unstaged changes back to HEAD", () => {
            writeFileSync(join(repo, "seed.txt"), "modified\n");

            gitRollback(repo);

            expect(git(["show", "HEAD:seed.txt"], repo)).toBe("seed");
            expect(isGitClean(repo)).toBe(true);
        });

        it("removes untracked files", () => {
            writeFileSync(join(repo, "new.txt"), "new\n");

            gitRollback(repo);

            expect(existsSync(join(repo, "new.txt"))).toBe(false);
            expect(isGitClean(repo)).toBe(true);
        });

        it("discards staged changes", () => {
            writeFileSync(join(repo, "new.txt"), "new\n");
            git(["add", "-A"], repo);

            gitRollback(repo);

            expect(existsSync(join(repo, "new.txt"))).toBe(false);
            expect(isGitClean(repo)).toBe(true);
        });
    });
});
