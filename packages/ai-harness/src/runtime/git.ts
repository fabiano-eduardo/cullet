// Opt-in git checkpointing for the harness. After each attempt it commits the
// agent's work on success or rolls it back on failure, so a run leaves a clean,
// bisectable history and a failed attempt never pollutes the next one.
//
// Assumption: the harness owns the working tree during a run — start from a
// clean, dedicated branch. Rollback is `git reset --hard` + `git clean -fd`,
// which discards ALL uncommitted changes in `cwd`, not just the agent's.
import { execFileSync } from "node:child_process";
import type { VerifyFn, VerifyOutcome } from "../harness/types.js";

function git(args: string[], cwd: string): string {
    return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

/** True when the working tree has no staged or unstaged changes. */
export function isGitClean(cwd: string): boolean {
    return git(["status", "--porcelain"], cwd) === "";
}

/** Stage everything and commit. Returns false when there was nothing to commit. */
export function gitCommitAll(message: string, cwd: string): boolean {
    git(["add", "-A"], cwd);
    if (git(["status", "--porcelain"], cwd) === "") return false;
    git(["commit", "-m", message], cwd);
    return true;
}

/** Discard every uncommitted change in the working tree, back to HEAD. */
export function gitRollback(cwd: string): void {
    git(["reset", "--hard", "HEAD"], cwd);
    git(["clean", "-fd"], cwd);
}

export interface GitCheckpointOptions {
    /** Repository working directory. Defaults to process.cwd(). */
    cwd?: string;
    /**
     * Refuse to start when the working tree already has uncommitted changes.
     * On by default. A checkpointed run owns the tree and rolls failed attempts
     * back with `git reset --hard` + `git clean -fd`, which would silently
     * discard any pre-existing work. Pass `false` to consciously run dirty.
     */
    requireCleanStart?: boolean;
    /** Build the commit message for a successful task. */
    commitMessage?: (taskId: string, description: string) => string;
    /** Notified about each checkpoint decision (commit / rollback / noop). */
    onCheckpoint?: (info: {
        taskId: string;
        action: "commit" | "rollback" | "noop";
    }) => void;
}

export interface GitCheckpoint {
    /**
     * Wrap a `verify` step so a passing attempt is committed and a failing one is
     * rolled back. Pass your real verifier, or call with no argument to commit
     * unconditionally (every applied attempt is treated as a success).
     */
    wrapVerify(inner?: VerifyFn): VerifyFn;
}

function defaultCommitMessage(taskId: string, description: string): string {
    // Fall back to the id when the first line is empty, so an empty-description
    // task still gets a meaningful subject instead of a dangling "feat(id): ".
    const subject = description.split("\n")[0].slice(0, 72) || taskId;
    return `feat(${taskId}): ${subject}`;
}

/**
 * Build a git checkpoint strategy. Wire it into `runHarness` via `verify`:
 *
 *   const checkpoint = createGitCheckpoint({ cwd });
 *   runHarness({ provider, tasks, apply, verify: checkpoint.wrapVerify(shellVerifier([...])) });
 */
export function createGitCheckpoint(
    options: GitCheckpointOptions = {},
): GitCheckpoint {
    const cwd = options.cwd ?? process.cwd();
    const buildMessage = options.commitMessage ?? defaultCommitMessage;

    // Guard at construction — before runHarness applies anything — so a dirty
    // start aborts loudly here instead of being swallowed by runHarness's
    // verify try/catch (which would turn it into a retried task failure and
    // keep clobbering the tree).
    if (options.requireCleanStart !== false && !isGitClean(cwd)) {
        throw new Error(
            `createGitCheckpoint: refusing to start in a dirty working tree (${cwd}). ` +
                `A failed attempt is rolled back with \`git reset --hard\` + \`git clean -fd\`, ` +
                `which would discard your uncommitted changes. Commit or stash them first, ` +
                `or pass { requireCleanStart: false } to run over a dirty tree on purpose.`,
        );
    }

    return {
        wrapVerify(inner?: VerifyFn): VerifyFn {
            return async (args): Promise<VerifyOutcome> => {
                const outcome: VerifyOutcome = inner
                    ? await inner(args)
                    : { passed: true };

                if (outcome.passed) {
                    const committed = gitCommitAll(
                        buildMessage(args.task.id, args.task.description),
                        cwd,
                    );
                    options.onCheckpoint?.({
                        taskId: args.task.id,
                        action: committed ? "commit" : "noop",
                    });
                } else {
                    gitRollback(cwd);
                    options.onCheckpoint?.({
                        taskId: args.task.id,
                        action: "rollback",
                    });
                }

                return outcome;
            };
        },
    };
}
