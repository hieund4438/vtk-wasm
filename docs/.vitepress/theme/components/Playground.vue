<script setup>

import { computed, onBeforeUnmount, onMounted, ref, useAttrs } from "vue";

const props = defineProps({
  displayIFrame: {
    type: Boolean,
    default: false,
  },
  consoleMinHeight: {
    type: String,
    default: '200px',
  }
})

const attrs = useAttrs();

let playground = null;
const activeTab = ref("js");
const isHtmlTab = computed(() => activeTab.value === "html");

const outputIframeRef = ref(null);
const editorHostHtmlRef = ref(null);
const editorHostJsRef = ref(null);
const consoleOutputRef = ref(null);
const tabJsRef = ref(null);
const tabHtmlRef = ref(null);
const inlineSourceRef = ref(null);

function trimSingleOuterNewline(text) {
  let output = text;
  if (output.startsWith("\n")) output = output.slice(1);
  if (output.endsWith("\n")) output = output.slice(0, -1);
  return output;
}

function getInlineSnippet(node) {
  if (!node) return undefined;
  if (node instanceof HTMLTextAreaElement) {
    return trimSingleOuterNewline(node.value);
  }
  return trimSingleOuterNewline(node.textContent ?? "");
}

function readInlineSource() {
  const container = inlineSourceRef.value;
  if (!container) {
    return {
      html: undefined,
      js: undefined,
    };
  }

  const htmlNode = container.querySelector('[data-lang="html"]');
  const jsNode = container.querySelector('[data-lang="js"]');

  return {
    html: getInlineSnippet(htmlNode),
    js: getInlineSnippet(jsNode),
  };
}

function requireElement(name, element) {
  if (!element) throw new Error(`Missing required element ref: ${name}`);
  return element;
}

function setActiveTab(next) {
  activeTab.value = next;
  playground?.setActiveTab(next);
}

function onTabClick(next) {
  setActiveTab(next);
  playground?.focus();
}

function onTabKeyDown(e) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") {
    return;
  }
  e.preventDefault();

  const order = ["js", "html"];
  const currentIdx = activeTab.value === "html" ? 1 : 0;

  let nextIdx = currentIdx;
  if (e.key === "ArrowLeft") nextIdx = (currentIdx + order.length - 1) % order.length;
  if (e.key === "ArrowRight") nextIdx = (currentIdx + 1) % order.length;
  if (e.key === "Home") nextIdx = 0;
  if (e.key === "End") nextIdx = order.length - 1;

  const nextTab = order[nextIdx];
  setActiveTab(nextTab);
  if (nextTab === "html") tabHtmlRef.value?.focus();
  else tabJsRef.value?.focus();
}

function onRun() {
  playground?.run();
}

function onReset() {
  playground?.reset();
}

function onCopy() {
  const content = isHtmlTab.value ? playground?.getHtml() : playground?.getJs();
  if (content) {
    navigator.clipboard.writeText(content).catch((err) => {
      console.error("Failed to copy:", err);
    });
  }
}

function createIframeId() {
  return `vtk-iframe-${Math.random().toString(36).slice(2, 10)}`;
}

async function createHtmlJsPlayground(options) {
  const {
    initialHtml,
    initialJs,
    elements,
    displayIFrame,
  } = options;

  if (!initialHtml || !initialJs) {
    throw new Error("createHtmlJsPlayground requires initialHtml and initialJs");
  }

  const {
    editorHostHtml,
    editorHostJs,
    consoleOutput,
    outputIframe,
  } = elements;

  if (!displayIFrame) {
    outputIframe.style.display = "none";
  }

  // Lazy-load editor deps.
  const { EditorView, basicSetup } = await import("codemirror");
  const { EditorState } = await import("@codemirror/state");
  const { HighlightStyle, syntaxHighlighting } = await import("@codemirror/language");
  const { tags } = await import("@lezer/highlight");
  const { javascript } = await import("@codemirror/lang-javascript");
  const { html } = await import("@codemirror/lang-html");

  // Console output helper.
  const consoleSink = createConsoleSink(consoleOutput);
  const iframeId = createIframeId();
  outputIframe.id = iframeId;
  const detachConsoleBridge = attachIframeConsoleBridge({
    iframeId,
    onMessage: (method, args) => consoleSink.append(args, method),
  });

  const customFontTheme = EditorView.theme({
    "&": {
      fontFamily: "'Lucida Console', 'Monaco', monospace",
      backgroundColor: "var(--vp-c-bg)",
      color: "var(--vp-c-text-1)",
    },
    ".cm-content": {
      fontFamily: "'Lucida Console', 'Monaco', monospace",
    },
    ".cm-gutters": {
      fontFamily: "'Lucida Console', 'Monaco', monospace",
      backgroundColor: "var(--vp-c-bg)",
      color: "var(--vp-c-text-2)",
      borderRight: "1px solid var(--vp-c-divider)",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--vp-c-bg-soft)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "var(--vp-c-bg-soft)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "color-mix(in srgb, var(--vp-c-brand-1) 22%, transparent)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--vp-c-brand-1)",
    },
  });

  const vpSyntaxTheme = HighlightStyle.define([
    { tag: tags.keyword, color: "var(--vp-c-brand-1)" },
    { tag: [tags.name, tags.variableName], color: "var(--vp-c-text-1)" },
    { tag: [tags.function(tags.variableName), tags.labelName], color: "var(--vp-c-brand-2)" },
    { tag: [tags.propertyName, tags.attributeName], color: "var(--vp-c-text-1)" },
    { tag: [tags.typeName, tags.className], color: "var(--vp-c-tip-1)" },
    { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--vp-c-warning-1)" },
    { tag: [tags.string, tags.special(tags.string)], color: "var(--vp-c-tip-1)" },
    { tag: [tags.comment, tags.quote], color: "var(--vp-c-text-3)", fontStyle: "italic" },
    { tag: [tags.operator, tags.punctuation], color: "var(--vp-c-text-2)" },
    { tag: [tags.meta, tags.escape, tags.regexp], color: "var(--vp-c-brand-2)" },
    { tag: tags.invalid, color: "var(--vp-c-danger-1)" },
  ]);

  const vpEditorExtensions = [
    customFontTheme,
    syntaxHighlighting(vpSyntaxTheme),
  ];
  // Editor state factories (keep per-tab undo by keeping per-tab EditorState objects).
  const createHtmlState = (doc = initialHtml) =>
    EditorState.create({
      doc,
      extensions: [basicSetup, html(), ...vpEditorExtensions],
    });

  const createJsState = (doc = initialJs) =>
    EditorState.create({
      doc,
      extensions: [basicSetup, javascript(), ...vpEditorExtensions],
    });

  let htmlState = createHtmlState();
  let jsState = createJsState();
  let active = "js";

  const view = new EditorView({
    state: jsState,
    parent: editorHostJs,
  });

  function persistActiveState() {
    if (active === "html") htmlState = view.state;
    else jsState = view.state;
  }

  function setActiveTab(next) {
    if (next === active) return;
    persistActiveState();
    active = next;

    const isHtml = active === "html";
    if (isHtml) {
      editorHostHtml.appendChild(view.dom);
      view.setState(htmlState);
    } else {
      editorHostJs.appendChild(view.dom);
      view.setState(jsState);
    }
  }

  // Runner
  const runner = createIframeRunner({
    iframe: outputIframe,
  });

  return {
    getHtml: () => (active === "html" ? view.state.doc.toString() : htmlState.doc.toString()),
    getJs: () => (active === "js" ? view.state.doc.toString() : jsState.doc.toString()),
    focus: () => {
      view.focus();
    },
    setActiveTab,
    run: async () => {
      consoleSink.clear();
      persistActiveState();
      await runner.run({
        html: htmlState.doc.toString(),
        js: jsState.doc.toString(),
        consoleProxy: true,
        iframeId,
      });
    },
    reset: () => {
      htmlState = createHtmlState();
      jsState = createJsState();
      view.setState(active === "html" ? htmlState : jsState);
      consoleSink.setReady();
    },
    setHtml: (nextHtml) => {
      htmlState = createHtmlState(nextHtml);
      if (active === "html") view.setState(htmlState);
    },
    setJs: (nextJs) => {
      jsState = createJsState(nextJs);
      if (active === "js") view.setState(jsState);
    },
    dispose: () => {
      detachConsoleBridge();
      view.destroy();
    },
  };
}

function createConsoleSink(outputDiv) {
  function append(args, type) {
    const content = (args ?? []).map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(" ");

    outputDiv.textContent += `${content}\n`;
  }

  function clear() {
    outputDiv.textContent = "";
  }

  function setReady() {
    outputDiv.textContent = "> Ready.";
  }

  return { append, clear, setReady };
}

function attachIframeConsoleBridge({ iframeId, onMessage }) {
  function handler(event) {
    if (!event?.data || event.data.source !== "iframe-runner") return;
    if (event.data.iframeId !== iframeId) return;
    const { method, args } = event.data;
    onMessage(method, args);
  }
  window.addEventListener("message", handler);
  // Return a detach function.
  return () => window.removeEventListener("message", handler);
}

function createIframeRunner({ iframe }) {
  let runId = 0;

  async function run({ html, js, consoleProxy, iframeId }) {
    runId += 1;
    const current = runId;
    // Assign onload before setting srcdoc to avoid races.
    iframe.onload = () => {
      if (current !== runId) return;
      try {
        const iframeDoc = iframe.contentDocument;
        // Adjust iframe height to content.
        const height = Math.max(
          iframeDoc?.documentElement?.scrollHeight ?? 0,
          iframeDoc?.body?.scrollHeight ?? 0,
        );
        iframe.style.height = `${height}px`;

        // Inject user code as a module script.
        const script = iframeDoc.createElement("script");
        script.type = "module";
        script.textContent = buildInjectedModuleSource({
          userCode: js,
          consoleProxy,
          iframeId,
        });
        iframeDoc.body.appendChild(script);
      } catch (e) {
        // If something goes wrong, attempt to surface it in the parent console.
        // (This runner is intended for same-origin srcdoc, but keep it resilient.)
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    iframe.srcdoc = html;
  }
  return { run };
}

function buildInjectedModuleSource({ userCode, consoleProxy, iframeId }) {
  if (!consoleProxy) return userCode;
  return `// Console proxy into parent
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

function send(method, args) {
  try {
    window.parent.postMessage({ source: "iframe-runner", iframeId: ${JSON.stringify(iframeId)}, method, args }, "*");
  } catch {
    // ignore
  }
}

console.log = (...args) => { send("log", args); originalConsole.log(...args); };
console.warn = (...args) => { send("warn", args); originalConsole.warn(...args); };
console.error = (...args) => { send("error", args); originalConsole.error(...args); };

// User code
${userCode}`;
}

onMounted(async () => {
  const inline = readInlineSource();
  let displayIFrame = props.displayIFrame;

  playground = await createHtmlJsPlayground({
    initialHtml: inline.html,
    initialJs: inline.js,
    elements: {
      editorHostHtml: requireElement("editorHostHtml", editorHostHtmlRef.value),
      editorHostJs: requireElement("editorHostJs", editorHostJsRef.value),
      consoleOutput: requireElement("consoleOutput", consoleOutputRef.value),
      outputIframe: requireElement("outputIframe", outputIframeRef.value),
    },
    displayIFrame,
  });

  playground.setActiveTab(activeTab.value);

  playground.run();
});

onBeforeUnmount(() => {
  if (playground) playground.dispose();
});

</script>

<template>
  <div class="playground">
    <div ref="inlineSourceRef" class="inline-source">
      <slot />
    </div>

    <iframe ref="outputIframeRef" src="about:blank" scrolling="no"></iframe>

    <div class="editor-header">
      <div class="tabs" role="tablist" aria-label="Code tabs">
        <button ref="tabJsRef" class="tab" id="tab-js" type="button" role="tab" :aria-selected="String(!isHtmlTab)"
          aria-controls="panel-js" :tabindex="!isHtmlTab ? 0 : -1" @click="onTabClick('js')"
          @keydown="onTabKeyDown">JS</button>
        <button ref="tabHtmlRef" class="tab" id="tab-html" type="button" role="tab" :aria-selected="String(isHtmlTab)"
          aria-controls="panel-html" :tabindex="isHtmlTab ? 0 : -1" @click="onTabClick('html')"
          @keydown="onTabKeyDown">HTML</button>
      </div>
      <button class="copy-btn" type="button" aria-label="Copy current code" title="Copy current code" @click="onCopy">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 9.75A2.25 2.25 0 0 1 11.25 7.5h6A2.25 2.25 0 0 1 19.5 9.75v7.5a2.25 2.25 0 0 1-2.25 2.25h-6A2.25 2.25 0 0 1 9 17.25v-7.5Z"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
          />
          <path
            d="M15 7.5V6.75A2.25 2.25 0 0 0 12.75 4.5h-6A2.25 2.25 0 0 0 4.5 6.75v7.5a2.25 2.25 0 0 0 2.25 2.25H9"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
          />
        </svg>
      </button>
    </div>

    <div id="panel-html" class="tabpanel" role="tabpanel" aria-labelledby="tab-html" :hidden="!isHtmlTab">
      <div ref="editorHostHtmlRef" id="editor-host-html"></div>
    </div>
    <div id="panel-js" class="tabpanel" role="tabpanel" aria-labelledby="tab-js" :hidden="isHtmlTab">
      <div ref="editorHostJsRef" id="editor-host-js"></div>
    </div>

    <div class="toolbar">
      <button id="run-btn" @click="onRun">Run</button>
      <button id="reset-btn" @click="onReset">Reset</button>
    </div>
    <textarea ref="consoleOutputRef" name="console-output" class="console"></textarea>
  </div>
</template>

<style scoped>
body {
  font-family: 'Lucida Console', 'Monaco', monospace;
}

.playground {
  max-width: 800px;
  margin: 0 auto;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.toolbar {
  padding: 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  display: flex;
  gap: 10px;
  background: var(--vp-c-bg-soft);
}

button {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

button:hover {
  background: var(--vp-c-bg-mute);
}

#run-btn {
  border-color: var(--vp-c-tip-2);
}

#run-btn:hover {
  background-color: rgba(151, 150, 150, 0.293);
}

#reset-btn {
  border-color: var(--vp-c-brand-1);
}

#reset-btn:hover {
  background-color: rgba(151, 150, 150, 0.293);
}

.tabs {
  display: flex;
  gap: 0;
  background: transparent;
}

.tab {
  appearance: none;
  background: transparent;
  border: none;
  padding: 10px 14px;
  cursor: pointer;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.tab:last-child {
  border-right: none;
}

.tab[aria-selected="true"] {
  border-bottom: 2px solid var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.tab:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-right: 10px;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
}

.copy-btn svg {
  width: 18px;
  height: 18px;
}

/* Editor area */
.cm-editor {
  height: var(--playground-editor-height, 400px);
  font-size: 14px;
}

/* Console Output */
.console {
  width: 100%;
  min-height: v-bind('props.consoleMinHeight');
  max-height: 300px;
  font-weight: bold;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.log-line {
  padding: 2px 0;
}

.log-error {
  color: var(--vp-c-danger-1);
}

.log-warn {
  color: var(--vp-c-warning-1);
}

.log-log {
  color: var(--vp-c-text-1);
}

iframe {
  width: 100%;
  border: none;
  display: block;
}

.inline-source {
  display: none;
}
</style>
