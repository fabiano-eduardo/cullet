#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sandbox=""
keep_sandbox="${CULLET_SMOKE_KEEP:-0}"

finish() {
  local status="$1"

  if [[ -z "${sandbox:-}" ]]; then
    return
  fi

  if [[ "$status" -ne 0 ]] || [[ "$keep_sandbox" == "1" ]]; then
    printf 'Sandbox preserved at: %s\n' "$sandbox"
    return
  fi

  rm -rf "$sandbox"
}

trap 'finish "$?"' EXIT

usage() {
  printf 'Usage: ./scripts/smoke-test.sh [./cullet-<version>.tgz]\n' >&2
}

tarball_name() {
  node -p 'const pkg = require(process.argv[1]); const normalized = pkg.name.startsWith("@") ? pkg.name.slice(1).replace(/\//g, "-") : pkg.name.replace(/\//g, "-"); `${normalized}-${pkg.version}.tgz`' "$repo_root/package.json"
}

resolve_tarball_path() {
  local candidate="${1:-}"

  if [[ -n "$candidate" ]]; then
    if [[ "$candidate" = /* ]]; then
      printf '%s\n' "$candidate"
    else
      printf '%s\n' "$repo_root/$candidate"
    fi
    return
  fi

  pushd "$repo_root" >/dev/null
  npm run release:dry-run >&2
  local generated
  generated="$(tarball_name)"
  popd >/dev/null

  printf '%s\n' "$repo_root/$generated"
}

auto_tarball_path="$(resolve_tarball_path "${1:-}")"

if [[ ! -f "$auto_tarball_path" ]]; then
  printf 'Tarball not found: %s\n' "$auto_tarball_path" >&2
  exit 1
fi

printf 'Using tarball: %s\n' "$auto_tarball_path"

sandbox="$(mktemp -d "${TMPDIR:-/tmp}/cullet-smoke.XXXXXX")"
printf 'Sandbox: %s\n' "$sandbox"

pushd "$sandbox" >/dev/null
npm init -y >/dev/null
npm pkg set name=cullet-smoke private=true type=module >/dev/null
npm install "$auto_tarball_path" typescript >/dev/null
mkdir -p src

cat <<'EOF' > tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
EOF

cat <<'EOF' > src/index.ts
import {
  ERP_CORE_VERSION,
  Entity,
  ValueObject,
  type EntityState,
} from "cullet/erp-core";
import { ERP_CORE_VERSION as VERSIONED_ERP_CORE_VERSION } from "cullet/erp-core/1.0.0";

class CustomerCode extends ValueObject<string, string> {
  private constructor(value: string) {
    super(value);
    this.finalize();
  }

  static create(value: string): CustomerCode {
    return new CustomerCode(value);
  }

  equals(other: CustomerCode): boolean {
    return this.value === other.value;
  }

  toPrimitive(): string {
    return this.value;
  }
}

class Customer extends Entity<string> {
  public readonly code: CustomerCode;

  constructor(id: string, code: string) {
    const state: EntityState<string> = {
      id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      aggregateVersion: 0,
    };

    super(state);
    this.code = CustomerCode.create(code);
  }
}

const customer = new Customer("customer-1", "CUS-0001");

console.log(
  JSON.stringify({
    directVersion: ERP_CORE_VERSION,
    versionedVersion: VERSIONED_ERP_CORE_VERSION,
    customerId: customer.id,
    code: customer.code.toJSON(),
    aggregateVersion: customer.aggregateVersion,
  }),
);
EOF

npx tsc -p tsconfig.json >/dev/null
output="$(node dist/index.js)"
printf '%s\n' "$output"

if [[ "$output" != *'"directVersion":"1.0.0"'* ]] || [[ "$output" != *'"versionedVersion":"1.0.0"'* ]]; then
  printf 'Unexpected smoke test output.\n' >&2
  exit 1
fi

popd >/dev/null
printf 'Smoke test OK.\n'
