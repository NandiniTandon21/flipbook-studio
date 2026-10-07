#!/usr/bin/env bash
# Scan the repository (working tree AND full git history) for personal paths,
# credentials and private keys before publishing.
#
#   bash tools/privacy-scan.sh        → exit 0 when clean, 1 when something needs a look
#
# vendor/ and package-lock.json are skipped: minified third-party code and base64
# blobs produce false positives (e.g. pdf.js "PasswordException", random "AKIA…" runs).
set -u
cd "$(dirname "$0")/.."

PATTERN='(/Users/|/home/[a-z]|C:\\Users\\|/private/var/folders)'          # local machine paths
PATTERN+='|(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'         # GitHub tokens
PATTERN+='|(sk-[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})'  # OpenAI / Slack / Google
PATTERN+='|(AKIA[0-9A-Z]{16}\b)'                                              # AWS access key
PATTERN+='|(BEGIN [A-Z ]*PRIVATE KEY)'                                        # private keys
PATTERN+='|([A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud)\.com)'     # personal email

EXCLUDE=(-- . ':!vendor' ':!package-lock.json' ':!dist' ':!tools/privacy-scan.sh')
found=0

echo "▸ working tree"
if git grep -n -I -E "$PATTERN" "${EXCLUDE[@]}"; then found=1; fi

echo "▸ git history"
history_hits=$(for c in $(git rev-list --all); do
  git grep -n -I -E "$PATTERN" "$c" "${EXCLUDE[@]}" 2>/dev/null
done | sort -u)
if [ -n "$history_hits" ]; then echo "$history_hits"; found=1; fi

echo "▸ built app (paths/emails only; it is mostly vendored code)"
if grep -o -E '(/Users/[A-Za-z]|/home/[a-z]+/|[A-Za-z0-9._%+-]+@(gmail|yahoo|outlook|hotmail|icloud)\.com)' dist/*.html; then found=1; fi

echo "▸ commit identities"
git log --all --format='%an <%ae>' | sort -u

if [ "$found" -eq 0 ]; then echo "✓ nothing sensitive found"; else echo "✗ review the matches above"; fi
exit "$found"
