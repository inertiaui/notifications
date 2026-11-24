#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "$0")" && pwd)"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

info()    { printf "%s==>%s %s\n" "$BLUE"   "$NC" "$*"; }
success() { printf "%s✓%s %s\n"   "$GREEN"  "$NC" "$*"; }
warn()    { printf "%s!%s %s\n"   "$YELLOW" "$NC" "$*"; }
die()     { printf "%s✗%s %s\n"   "$RED"    "$NC" "$*" >&2; exit 1; }

# ── args ────────────────────────────────────────────────────────────────
[ $# -eq 1 ] || die "Usage: $0 <version>  (e.g. 1.0.0 or 1.1.0-beta1)"

TAG="$1"
if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    die "Invalid version: $TAG — expected X.Y.Z or X.Y.Z-suffix (no leading 'v')"
fi

VERSION="$TAG"
PRERELEASE=false
[[ "$TAG" == *-* ]] && PRERELEASE=true

# ── required tools ──────────────────────────────────────────────────────
command -v composer >/dev/null || die "composer not found"
command -v pnpm     >/dev/null || die "pnpm not found"
command -v gh       >/dev/null || die "gh CLI not found"

# ── git state ───────────────────────────────────────────────────────────
info "Pre-flight checks"

git rev-parse --git-dir >/dev/null 2>&1 || die "Not a git repository"
[ -z "$(git status --porcelain)" ]      || die "Working tree is not clean — commit or stash first"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
LOCAL_HEAD=$(git rev-parse HEAD)
SHORT_HEAD=$(git rev-parse --short HEAD)

[ "$BRANCH" = "main" ] || die "Releases must be cut from 'main' (currently on '$BRANCH')"

# The remote that points at GitHub, which may not be called origin.
REMOTE=$(git remote -v | awk '$2 ~ /github\.com[:\/]inertiaui\/notifications(\.git)?$/ { print $1; exit }')
[ -n "$REMOTE" ] || die "No remote points at github.com/inertiaui/notifications"

info "Fetching from $REMOTE..."
# --force: trust the remote as the source of truth for tags (overwrites local tags
# whose SHA has drifted, e.g. from a manual rebase or rewrite of a release commit).
git fetch --tags --force "$REMOTE"

# Tag must not already exist
if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
    die "Tag $TAG already exists locally"
fi
if git ls-remote --tags --exit-code "$REMOTE" "refs/tags/$TAG" >/dev/null 2>&1; then
    die "Tag $TAG already exists on $REMOTE"
fi

# Branch must be in sync with remote
REMOTE_HEAD=$(git rev-parse "$REMOTE/$BRANCH" 2>/dev/null || echo "")
if [ -z "$REMOTE_HEAD" ]; then
    die "Branch $BRANCH has no upstream on $REMOTE"
elif [ "$REMOTE_HEAD" != "$LOCAL_HEAD" ]; then
    REMOTE_SHORT=$(git rev-parse --short "$REMOTE/$BRANCH")
    die "Local $BRANCH ($SHORT_HEAD) is out of sync with $REMOTE/$BRANCH ($REMOTE_SHORT) — pull or push first"
fi

# ── CI check ────────────────────────────────────────────────────────────
info "Checking CI on $SHORT_HEAD..."
CI_FAILED=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,conclusion \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.conclusion == \"failure\" or .conclusion == \"cancelled\" or .conclusion == \"timed_out\" or .conclusion == \"action_required\")] | length")
CI_PENDING=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,status \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.status != \"completed\")] | length")
CI_PASSED=$(gh run list --branch "$BRANCH" --limit 20 --json headSha,conclusion \
    --jq "[.[] | select(.headSha == \"$LOCAL_HEAD\") | select(.conclusion == \"success\")] | length")

if [ "$CI_FAILED" != "0" ]; then
    die "$CI_FAILED CI workflow(s) failed on $SHORT_HEAD — fix before releasing"
fi

if [ "$CI_PENDING" != "0" ]; then
    warn "$CI_PENDING CI workflow(s) still running on $SHORT_HEAD"
    read -r -p "Continue anyway? (y/N) " REPLY
    [[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"
elif [ "$CI_PASSED" = "0" ]; then
    warn "No CI runs found for $SHORT_HEAD"
    read -r -p "Continue anyway? (y/N) " REPLY
    [[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"
else
    success "CI green ($CI_PASSED workflow(s) passed)"
fi

# ── changelog ───────────────────────────────────────────────────────────
# The release notes come from the CHANGELOG section of this version.
NOTES=$(awk -v version="$VERSION" '
    $0 ~ "^## " { if (found) exit; if ($2 == version) { found = 1; next } }
    found { print }
' CHANGELOG.md)
[ -n "$(printf '%s' "$NOTES" | tr -d '[:space:]')" ] || die "CHANGELOG.md has no '## $VERSION' section — rename 'Unreleased' and commit it first"

# ── confirm ─────────────────────────────────────────────────────────────
MARK_LATEST=true
[ "$PRERELEASE" = true ] && MARK_LATEST=false

CURRENT_VUE=$(node -p "require('./vue/package.json').version")
CURRENT_REACT=$(node -p "require('./react/package.json').version")

echo
info "About to release:"
printf "  %-12s vue=%s, react=%s\n" "Current:"  "$CURRENT_VUE" "$CURRENT_REACT"
printf "  %-12s %s\n" "Version:"     "$VERSION"
printf "  %-12s %s\n" "Tag:"         "$TAG"
printf "  %-12s %s @ %s\n" "Branch:" "$BRANCH" "$SHORT_HEAD"
printf "  %-12s %s\n" "Remote:"      "$REMOTE"
printf "  %-12s %s\n" "Pre-release:" "$PRERELEASE"
printf "  %-12s %s\n" "Mark latest:" "$MARK_LATEST"
echo
read -r -p "Proceed? (y/N) " REPLY
[[ "$REPLY" =~ ^[Yy]$ ]] || die "Aborted"

# ── bump versions ───────────────────────────────────────────────────────
info "Bumping vue/package.json to $VERSION..."
(cd vue && pnpm version "$VERSION" --no-git-tag-version --no-git-checks --allow-same-version >/dev/null)

info "Bumping react/package.json to $VERSION..."
(cd react && pnpm version "$VERSION" --no-git-tag-version --no-git-checks --allow-same-version >/dev/null)

# ── build ───────────────────────────────────────────────────────────────
info "Running composer build (quality, tests, builds, and package checks)..."
composer build

# Verify `composer build` didn't leave unexpected source changes behind
# (e.g. formatter fixes or a stale Boost guide on a previously "clean" tree).
# Expected modifications: package.json in vue/+react/, their dist/ dirs, and the root pnpm-lock.yaml.
UNEXPECTED_CHANGES=$(git status --porcelain \
    | grep -vE "^.M (react|vue)/dist/|^.M (react|vue)/package\.json$|^.M pnpm-lock\.yaml$|^\?\? (react|vue)/dist/" \
    || true)
if [ -n "$UNEXPECTED_CHANGES" ]; then
    echo
    warn "composer build modified unexpected source files:"
    echo "$UNEXPECTED_CHANGES"
    die "Commit those fixes first, then re-run this script"
fi

# ── commit ──────────────────────────────────────────────────────────────
git add vue/package.json vue/dist \
        react/package.json react/dist \
        pnpm-lock.yaml

if git diff --cached --quiet; then
    warn "Nothing to commit (versions and dist unchanged)"
else
    info "Committing release..."
    git commit -m "$VERSION"
fi

# ── tag + push ──────────────────────────────────────────────────────────
info "Tagging $TAG..."
git tag "$TAG"

info "Pushing branch and tag to $REMOTE..."
git push "$REMOTE" "$BRANCH"
git push "$REMOTE" "$TAG"

# ── github release ──────────────────────────────────────────────────────
info "Creating GitHub release..."
RELEASE_FLAGS=(--title "$TAG" --notes "$NOTES")
[ "$PRERELEASE" = true ] && RELEASE_FLAGS+=(--prerelease)
[ "$MARK_LATEST" = false ] && RELEASE_FLAGS+=(--latest=false)
gh release create "$TAG" "${RELEASE_FLAGS[@]}"

echo
success "Released $TAG"
info "The publish-to-npm workflow has been triggered by the release event."
info "Packagist picks up the tag through its GitHub hook."
info "Watch: gh run watch"
