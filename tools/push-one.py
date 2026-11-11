#!/usr/bin/env python3
"""One-commit push: overlay only changed files onto the remote HEAD tree.
Usage: push-one.py OWNER/REPO WORKDIR "commit message"
Compares local git blob SHAs (git ls-files -s) with the remote recursive
tree, uploads blobs only for new/changed files, creates ONE tree + ONE
commit + one ref update. Use for Vercel-linked repos to avoid deployment
spray from chunked pushes."""
import base64, json, subprocess, sys, time, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response

CONNECTION = "custom.github-pat"
HOSTS = ["api.github.com"]
BASE = "https://api.github.com"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a):
        raise RuntimeError("redirect refused")


def call(method, path, payload=None, raw_headers=None):
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if body:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    add_surrogate_to_request(req, CONNECTION, allowed_hosts=HOSTS)
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=120) as r:
        return r.status, read_json_response(r)


def main():
    repo, workdir, message = sys.argv[1], sys.argv[2], sys.argv[3]
    # remote HEAD + tree
    _, ref = call("GET", f"/repos/{repo}/git/ref/heads/main")
    head_sha = ref["object"]["sha"]
    _, head = call("GET", f"/repos/{repo}/git/commits/{head_sha}")
    base_tree = head["tree"]["sha"]
    _, tree = call("GET", f"/repos/{repo}/git/trees/{base_tree}?recursive=1")
    if tree.get("truncated"):
        raise SystemExit("remote tree truncated - cannot diff safely")
    remote = {e["path"]: e["sha"] for e in tree["tree"] if e["type"] == "blob"}
    # local files from git index
    out = subprocess.run(["git", "ls-files", "-s"], cwd=workdir, capture_output=True, text=True).stdout
    local = {}
    for line in out.splitlines():
        meta, path = line.split("\t", 1)
        mode, sha = meta.split()[:2]
        local[path] = (mode, sha)
    changed = [(p, m) for p, (m, s) in local.items() if remote.get(p) != s]
    deleted = [p for p in remote if p not in local]
    print(f"head {head_sha[:7]} | local {len(local)} | changed {len(changed)} | deleted {len(deleted)}")
    entries = []
    for path, mode in changed:
        content = open(f"{workdir}/{path}", "rb").read()
        _, blob = call("POST", f"/repos/{repo}/git/blobs",
                       {"content": base64.b64encode(content).decode(), "encoding": "base64"})
        entries.append({"path": path, "mode": mode, "type": "blob", "sha": blob["sha"]})
        print("blob", path, len(content), "B")
    for path in deleted:
        entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})
    if not entries:
        print("nothing to push")
        return
    _, new_tree = call("POST", f"/repos/{repo}/git/trees", {"base_tree": base_tree, "tree": entries})
    _, commit = call("POST", f"/repos/{repo}/git/commits",
                     {"message": message, "tree": new_tree["sha"], "parents": [head_sha]})
    _, upd = call("PATCH", f"/repos/{repo}/git/refs/heads/main", {"sha": commit["sha"]})
    print("COMMITTED", commit["sha"][:7], upd["object"]["sha"][:7])


if __name__ == "__main__":
    main()
