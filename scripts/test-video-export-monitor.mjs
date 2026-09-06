import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Run the provider's hooks with controlled fetch/timer/DOM boundaries. Panels
// can be discarded independently while their workspace provider stays mounted.
function workspace(initialRenders = []) {
  let cursor = 0;
  const hooks = [];
  let effects = [];
  let responseRenders = initialRenders;
  let failRefresh = false;
  const downloads = [];
  const intervals = new Set();
  const stable = (value, deps) => {
    const index = cursor++;
    const old = hooks[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      hooks[index] = { value, deps };
    }
    return hooks[index].value;
  };
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    useContext: () => {},
    useCallback: stable,
    useRef(value) { const index = cursor++; return hooks[index] ??= { current: value }; },
    useState(value) {
      const index = cursor++;
      hooks[index] ??= { value };
      return [hooks[index].value, (next) => {
        hooks[index].value = typeof next === "function" ? next(hooks[index].value) : next;
      }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = hooks[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        effects.push(() => {
          old?.cleanup?.();
          hooks[index] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../app/components/VideoExportProvider.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }) };
      if (name.endsWith("video-event-client")) return { trackVideoWorkspaceEvent() {} };
      throw new Error(name);
    },
    fetch: async () => ({ ok: !failRefresh, json: async () => ({ renders: responseRenders }) }),
    window: { setInterval(fn) { intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); } },
    document: { body: { appendChild() {} }, createElement() {
      return { click() { downloads.push(this.href); }, remove() {} };
    } },
  });
  const render = () => {
    cursor = 0;
    effects = [];
    const tree = exports.VideoExportProvider({ projectId: "project", initialRenders, children: null });
    effects.forEach((effect) => effect());
    return tree.props.value;
  };
  return { render, downloads, intervals,
    respond(renders, fail = false) { responseRenders = renders; failRefresh = fail; } };
}
const job = (id, status = "queued") => ({ id, candidateId: id, status, videoUrl: status === "completed" ? "ready" : null });

test("two clips finish after switching panels and each downloads only once", async () => {
  const app = workspace();
  let context = app.render();
  await context.refresh();
  context = app.render();
  const firstPanel = context;
  firstPanel.watch(job("clip1"));
  const secondPanel = app.render();
  secondPanel.watch(job("clip2"));
  context = app.render();
  app.respond([job("clip1", "completed"), job("clip2", "completed")]);
  await context.refresh();
  app.render();
  assert.equal(app.downloads.length, 2);
  await context.refresh();
  app.render();
  assert.equal(app.downloads.length, 2);
});

test("existing exports do not auto-download on entry; canceled jobs do not download", async () => {
  const app = workspace([job("old", "completed")]);
  let context = app.render();
  await context.refresh();
  context = app.render();
  context.watch(job("cancel"));
  context.forget("cancel");
  app.respond([job("old", "completed"), job("cancel", "completed")]);
  await context.refresh();
  app.render();
  assert.equal(app.downloads.length, 0);
});

test("temporary status failure keeps pending download intent and clears after recovery", async () => {
  const app = workspace();
  let context = app.render();
  await context.refresh();
  context = app.render();
  context.watch(job("clip1"));
  context = app.render();
  app.respond([], true);
  await context.refresh();
  assert.equal(app.render().statusError, true);
  app.respond([job("clip1", "completed")]);
  await context.refresh();
  assert.equal(app.render().statusError, false);
  assert.equal(app.downloads.length, 1);
});
