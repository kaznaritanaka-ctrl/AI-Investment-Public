#!/usr/bin/env bash
# Thin Docker adapter; reuse existing individual checks, no aggregate verify:ci.
set -euo pipefail
PHASE=${1:?fixed phase required}
[[ $# == 1 && ${GITHUB_RUN_ID:-} =~ ^[0-9]+$ && ${GITHUB_RUN_ATTEMPT:-} =~ ^[0-9]+$ ]]
[[ ${GITHUB_REPOSITORY:-} == kaznaritanaka-ctrl/AI-Investment-Public ]]
[[ ${GITHUB_REF:-} == refs/heads/codex/linux-fixed-verification-20261020 ]]
IMAGE=docker.io/library/node@sha256:e5a8dee7bc1e6a215d224a7ef8206f7e77271bc3cabd5febf2beafac0674f174
BASE=d15976cb2b195513a66d5a7dbe7e3bab04729b3f
D="$RUNNER_TEMP/air-fixed-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
OUT="$D/out"
PNPM=/tools/package/bin/pnpm.cjs
if [[ $PHASE == prepare ]]; then
  [[ ! -e $D ]]
  mkdir -p "$D"/{source,store,cache,tools,out}
  [[ $(node --version) == v24.19.0 && $(git rev-parse HEAD) == "$GITHUB_SHA" ]]
  git merge-base --is-ancestor "$BASE" HEAD
  git diff --name-only "$BASE" HEAD | sort > "$OUT/changed-paths.txt"
  printf '%s\n' .github/workflows/public-ci.yml .github/workflows/public-linux-fixed.yml ci/run-linux-fixed.sh pnpm-lock.yaml scripts/check-public-ci.mjs scripts/test-public-preview.mjs | sort > "$OUT/allowed-paths.txt"
  cmp "$OUT/changed-paths.txt" "$OUT/allowed-paths.txt"
  git diff --exit-code "$BASE" HEAD -- package.json pnpm-workspace.yaml patches app lib components build public wrangler.public.jsonc vite.config.ts vite.cloudflare.config.ts .openai
  node scripts/check-public-secrets.mjs
  git archive HEAD | tar -xf - -C "$D/source"
  (cd "$D/source"; find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$OUT/source-sha256.txt"
  (cd "$D/source"; printf '%s\n' '315f6740801d9fa615a8e925375fd3355283b659a9cec59184b02bdc33a01fa6  pnpm-lock.yaml' '2f6884f6ee55c2fb703c06dae3d4036f4776800debf33dc994e5386c47ce2076  package.json' '488741ee5a1ef4d73578de7978bf34ded32844f74dd1b0081b6e28bf6de0b15e  pnpm-workspace.yaml' 'e9b33b19691612ea1d566abd357da97d5dd77f09f82a34b4c84c956d81a04108  patches/miniflare@5.20260926.1-alpha.patch' | sha256sum -c -) | tee "$OUT/input-sha.log"
  curl --fail --location --retry 0 --max-time 120 https://registry.npmjs.org/pnpm/-/pnpm-11.25.0.tgz -o "$D/pnpm.tgz"
  printf '%s  %s\n' 5cde925b4f075f725eb71fbae18a42ffe784524789f19b61c731cb8721ec28aaee160e01a8d5af4fedb2a42cdbf300efe23db356b0d4a17b4d63e11f8ab7c956 "$D/pnpm.tgz" | sha512sum -c -
  tar -xzf "$D/pnpm.tgz" -C "$D/tools"
  printf '%s  %s\n' 67b035e322203961795e8e34ca63a08c37a4386eda94107fb3d28f3246d882ad "$D/tools/package/bin/pnpm.cjs" ddc64218bc85fb88d28b5def06eb01fafb39cb67f7a9465ce736456658cc7f11 "$D/tools/package/dist/pnpm.mjs" | sha256sum -c -
  docker pull --platform linux/amd64 "$IMAGE"
  docker image inspect "$IMAGE" > "$OUT/image.json"
  docker version --format '{{.Server.Version}}' > "$OUT/docker-server-version.txt"
  git rev-parse HEAD HEAD^{tree} > "$OUT/git-sha.txt"
  exit 0
fi
[[ -d $OUT && ! -e $OUT/$PHASE.cid ]]
NET=none
ARGS=()
case "$PHASE" in
  fetch) NET=bridge; ARGS=(node "$PNPM" fetch --ignore-scripts --store-dir /store --cache-dir /cache --fetch-retries=0) ;;
  install) ARGS=(node "$PNPM" install --offline --frozen-lockfile --store-dir /store --cache-dir /cache --package-import-method=copy --fetch-retries=0) ;;
  health) ARGS=(bash -euc '
    check() { expected=$1; shift; actual=$("$@"); printf "%s\n" "$actual"; [[ "$actual" == "$expected" ]]; }
    uname -a; cat /etc/os-release; getconf GNU_LIBC_VERSION
    check v24.19.0 node --version
    check 11.25.0 node /tools/package/bin/pnpm.cjs --version
    check "workerd 2026-09-26" node node_modules/.pnpm/workerd@1.20260926.1/node_modules/workerd/bin/workerd --version
    check 0.28.1 node node_modules/.pnpm/esbuild@0.28.1/node_modules/esbuild/bin/esbuild --version
    check 4.143.1 node node_modules/wrangler/bin/wrangler.js --version
    check "Version 5.9.3" node node_modules/typescript/bin/tsc --version
    check v9.39.4 node node_modules/eslint/bin/eslint.js --version
    check "vite/8.0.16 linux-x64 node-v24.19.0" node node_modules/vite/bin/vite.js --version
    mf=(node_modules/.pnpm/miniflare@5.20260926.1-alph*/node_modules/miniflare/dist/src/workers/core/entry.worker.js)
    [[ ${#mf[@]} == 1 ]]
    printf "%s  %s\n" 4e13eaf144738dae0dee8c64d6205462e1fe2f59e97a9d3962f586c43dc3cc9d "${mf[0]}" | sha256sum -c -
    sha256sum node_modules/.pnpm/@cloudflare+workerd-linux-64@1.20260926.1/node_modules/@cloudflare/workerd-linux-64/bin/workerd
  ') ;;
  lint|typecheck) ARGS=(node "$PNPM" run "$PHASE") ;;
  ci-policy) ARGS=(node --test scripts/test-public-ci.mjs) ;;
  verification-guards) ARGS=(node --test scripts/test-public-verification.mjs) ;;
  body-proxy-guards) ARGS=(node --test scripts/test-public-body-proxy-guards.mjs) ;;
  sites-build) ARGS=(node "$PNPM" run build) ;;
  public-build) ARGS=(node "$PNPM" run build:cloudflare) ;;
  public-bundle) ARGS=(node "$PNPM" run check:cloudflare) ;;
  toolchain|proxy|body-proxy) ARGS=(node --test "scripts/test-public-$PHASE.mjs") ;;
  built-actions) ARGS=(node scripts/test-public-actions.mjs) ;;
  built-http) ARGS=(node scripts/test-public-built-http.mjs) ;;
  preview) ARGS=(node scripts/test-public-preview.mjs) ;;
  audit) NET=bridge; ARGS=(node "$PNPM" audit --json) ;;
  *) printf 'STOP: unsupported fixed phase\n' >&2; exit 2 ;;
esac
NAME="air-fixed-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$PHASE"
if docker inspect "$NAME" >/dev/null 2>&1; then printf 'STOP: container name already exists\n' >&2; exit 2; fi
cleanup() {
  rc=$?; trap - EXIT
  if [[ -s $OUT/$PHASE.cid ]]; then
    cid=$(< "$OUT/$PHASE.cid")
    [[ $cid =~ ^[a-f0-9]{64}$ ]] || exit 2
    [[ $(docker inspect -f '{{index .Config.Labels "air.run"}}' "$cid") == "$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" ]] || exit 2
    docker inspect "$cid" > "$OUT/$PHASE.container.json"
    if [[ $(docker inspect -f '{{.State.Running}}' "$cid") == true ]]; then docker stop --time 5 "$cid"; rc=1; fi
    [[ $(docker inspect -f '{{.State.Running}}' "$cid") == false ]] || exit 2
    docker rm "$cid" > "$OUT/$PHASE.removed.txt"
  fi
  printf '{"phase":"%s","exitCode":%s}\n' "$PHASE" "$rc" > "$OUT/$PHASE.result.json"
  exit "$rc"
}
trap cleanup EXIT
set +e
timeout --signal=TERM --kill-after=10s 240s docker run --name "$NAME" --cidfile "$OUT/$PHASE.cid" --label "air.run=$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" --platform linux/amd64 --init --network "$NET" --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 512 --memory 6g --memory-swap 6g --user "$(id -u):$(id -g)" --tmpfs /tmp:rw,nosuid,nodev,mode=1777 --workdir /s --mount "type=bind,src=$D/source,dst=/s" --mount "type=bind,src=$D/store,dst=/store" --mount "type=bind,src=$D/cache,dst=/cache" --mount "type=bind,src=$D/tools,dst=/tools,readonly" --env HOME=/tmp --env TMPDIR=/tmp --env CI=true --env BROWSER=none --env NPM_CONFIG_USERCONFIG=/dev/null --env NPM_CONFIG_GLOBALCONFIG=/dev/null --env NPM_CONFIG_REGISTRY=https://registry.npmjs.org --env CLOUDFLARE_CF_FETCH_ENABLED=false --env CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false --env WRANGLER_SEND_METRICS=false --env WRANGLER_WRITE_LOGS=false "$IMAGE" "${ARGS[@]}" > "$OUT/$PHASE.stdout.log" 2> "$OUT/$PHASE.stderr.log"
rc=$?
set -e
cat "$OUT/$PHASE.stdout.log"
cat "$OUT/$PHASE.stderr.log" >&2
(cd "$D/source"; sha256sum -c "$OUT/source-sha256.txt") > "$OUT/$PHASE.input-sha.log"
if [[ $PHASE == install ]] && grep -Ei 'ENOENT|EPERM|EACCES|SQLITE_CANTOPEN|ERR_PNPM|Error:|ELIFECYCLE' "$OUT/$PHASE."{stdout,stderr}.log; then rc=1; fi
if [[ $PHASE == audit ]]; then
  node --input-type=module -e 'import fs from "node:fs";import {evaluateAudit} from "./scripts/audit-public-dependencies.mjs";const report=JSON.parse(fs.readFileSync(process.argv[1]));const result=evaluateAudit(report,Number(process.argv[2]));fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+"\n");process.exitCode=result.status==="PASS"?0:1;' "$OUT/audit.stdout.log" "$rc" "$OUT/audit.verdict.json"
fi
exit "$rc"
