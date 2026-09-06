import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL("../migrations/0036_render_scope_repair.sql", import.meta.url), "utf8");
for (const legacy of [true, false]) {
  test(`repair ${legacy ? "legacy project-wide" : "current version-wide"} export scope`, () => {
    const output = execFileSync("python3", ["-c", `
import sqlite3,sys
c=sqlite3.connect(':memory:')
c.executescript('''CREATE TABLE render_jobs (
 id TEXT PRIMARY KEY, project_id TEXT, project_version_id TEXT,
 kind TEXT, preset_id TEXT DEFAULT 'preset', scope_key TEXT DEFAULT 'default', status TEXT DEFAULT 'queued'
);''')
legacy=sys.argv[1]=='true'
if legacy:
 c.execute("CREATE UNIQUE INDEX idx_render_jobs_active_scope ON render_jobs(project_id,kind,preset_id,scope_key) WHERE status IN ('queued','preparing','running','uploading')")
else:
 c.executescript(sys.stdin.read())
# Keep an existing export active while installing the repair.
c.execute("INSERT INTO render_jobs(id,project_id,project_version_id,kind) VALUES ('a','project','clip1-v1','final')")
if legacy:
 try:
  c.execute("INSERT INTO render_jobs(id,project_id,project_version_id,kind) VALUES ('b','project','clip2-v1','final')")
  raise AssertionError('legacy bug not reproduced')
 except sqlite3.IntegrityError: pass
 c.executescript(sys.stdin.read())
# Distinct clips may export concurrently.
c.execute("INSERT INTO render_jobs(id,project_id,project_version_id,kind) VALUES ('b','project','clip2-v1','final')")
# A duplicate active export of the same version must still be rejected.
try:
 c.execute("INSERT INTO render_jobs(id,project_id,project_version_id,kind) VALUES ('duplicate','project','clip1-v1','final')")
 raise AssertionError('duplicate version accepted')
except sqlite3.IntegrityError: pass
# Preview scopes retain their independent protection.
c.execute("INSERT INTO render_jobs(id,project_id,kind,scope_key) VALUES ('p1','project','preview','clip1-s0')")
c.execute("INSERT INTO render_jobs(id,project_id,kind,scope_key) VALUES ('p2','project','preview','clip2-s0')")
try:
 c.execute("INSERT INTO render_jobs(id,project_id,kind,scope_key) VALUES ('p3','project','preview','clip1-s0')")
 raise AssertionError('duplicate preview accepted')
except sqlite3.IntegrityError: pass
assert c.execute('SELECT COUNT(*) FROM render_jobs').fetchone()[0]==4
print('ok')
`, String(legacy)], { input: migration, encoding: "utf8" });
    assert.equal(output.trim(), "ok");
  });
}
