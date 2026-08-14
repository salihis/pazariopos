#!/usr/bin/env python3
# deploy/insert_pazariopos_nginx_block.py
# ─────────────────────────────────────────────────────────────
# Safely inserts deploy/nginx.pazariopos.snippet.conf into the shared
# marketplace nginx config (default: /home/ubuntu/pazario/nginx.deploy.conf),
# right before that file's LAST closing brace (which closes the
# `http { ... }` block — the snippet's server directive must live
# inside http{}, not at the top level).
#
# Always takes a timestamped backup first and never touches the
# existing pazario.tr / www.pazario.tr server block — this only adds
# new content, never removes or rewrites anything.
#
# USAGE:
#   python3 deploy/insert_pazariopos_nginx_block.py \
#       /home/ubuntu/pazario/nginx.deploy.conf \
#       deploy/nginx.pazariopos.snippet.conf
#
# After running, ALWAYS validate before reloading nginx:
#   docker compose -f /home/ubuntu/pazario/docker-compose.deploy.yml \
#       exec nginx nginx -t
# ─────────────────────────────────────────────────────────────

import sys
import shutil
from datetime import datetime
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <target-nginx-conf> <snippet-conf>", file=sys.stderr)
        return 1

    target_path = Path(sys.argv[1])
    snippet_path = Path(sys.argv[2])

    if not target_path.is_file():
        print(f"Error: target file not found: {target_path}", file=sys.stderr)
        return 1
    if not snippet_path.is_file():
        print(f"Error: snippet file not found: {snippet_path}", file=sys.stderr)
        return 1

    target_content = target_path.read_text()
    snippet_content = snippet_path.read_text()

    if "erp.pazario.tr" in target_content:
        print("Already contains an erp.pazario.tr block — refusing to insert a duplicate.")
        print("If you need to re-run this, first restore from a backup (see below) and try again.")
        return 1

    last_brace_index = target_content.rfind("}")
    if last_brace_index == -1:
        print("Error: couldn't find a closing brace in the target file — does not look like a valid nginx.conf.", file=sys.stderr)
        return 1

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = target_path.with_suffix(target_path.suffix + f".backup_{timestamp}")
    shutil.copy2(target_path, backup_path)
    print(f"Backup written to: {backup_path}")

    new_content = (
        target_content[:last_brace_index]
        + "\n"
        + snippet_content.rstrip()
        + "\n"
        + target_content[last_brace_index:]
    )
    target_path.write_text(new_content)
    print(f"Inserted erp.pazario.tr block into: {target_path}")
    print("\nNEXT STEP — validate before reloading:")
    print("  docker compose -f /home/ubuntu/pazario/docker-compose.deploy.yml exec nginx nginx -t")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
