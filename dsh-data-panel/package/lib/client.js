window.__ModuleLoader__.load({
	id: "dsh-data-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");
		var ReactDOM = require("react-dom");

		var h = React.createElement;
		var useState = React.useState;
		var useEffect = React.useEffect;
		var useMemo = React.useMemo;
		var useRef = React.useRef;
		var useSyncExternalStore = React.useSyncExternalStore;

		//#region styles
		var CSS = `
.dp-root, .dp-root *, .dp-detail, .dp-detail *, .dp-mask, .dp-mask * { box-sizing: border-box; }
.dp-root, .dp-detail, .dp-mask {
	--dp-bg: var(--dsw-alias-bg-layer-1, #ffffff);
	--dp-bg2: var(--dsw-alias-bg-layer-2, #f7f8fa);
	--dp-bg3: var(--dsw-alias-bg-layer-3, #f2f3f5);
	--dp-text: var(--dsw-alias-label-primary, #1f2329);
	--dp-text2: var(--dsw-alias-label-secondary, #646a73);
	--dp-text3: var(--dsw-alias-label-tertiary, #8f959e);
	--dp-border: var(--dsw-alias-border-l1, #e5e6eb);
	--dp-border2: var(--dsw-alias-border-l2, #eef0f3);
	--dp-brand: var(--dsw-alias-brand-primary, #4d6bfe);
	--dp-on-brand: var(--dsw-alias-label-primary-foreground, #ffffff);
	--dp-danger: var(--dsw-alias-label-error, #f54a45);
	--dp-success: var(--dsw-alias-label-success, #2ea121);
	--dp-warning: var(--dsw-alias-label-warning, #ff8800);
	height: 100%;
	overflow: auto;
	background: var(--dp-bg);
	color: var(--dp-text);
	font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
	font-size: 13px;
	line-height: 1.5;
	-webkit-font-smoothing: antialiased;
}
.dp-root ::-webkit-scrollbar { width: 10px; height: 10px; }
.dp-root ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--dp-text3) 28%, transparent); border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
.dp-root ::-webkit-scrollbar-track { background: transparent; }
.dp-shell { max-width: 1180px; margin: 0 auto; padding: 26px 30px 56px; }
.dp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.dp-eyebrow { color: var(--dp-text3); font-size: 10px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; }
.dp-title { margin: 5px 0 5px; font-size: 24px; font-weight: 650; letter-spacing: -.015em; line-height: 1.25; }
.dp-subtitle { margin: 0; max-width: 620px; color: var(--dp-text2); font-size: 13px; }
.dp-stats { display: flex; gap: 8px; }
.dp-stat { min-width: 76px; padding: 10px 14px; border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); }
.dp-stat b { display: block; font-size: 20px; font-weight: 650; line-height: 1.2; letter-spacing: -.01em; }
.dp-stat span { display: block; margin-top: 1px; color: var(--dp-text3); font-size: 11px; }
.dp-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 22px 0 12px; }
.dp-search { position: relative; flex: 1 1 240px; max-width: 360px; }
.dp-search svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--dp-text3); pointer-events: none; }
.dp-search input { width: 100%; height: 36px; padding: 0 12px 0 34px; border: 1px solid transparent; border-radius: 10px; background: var(--dp-bg2); color: var(--dp-text); font: inherit; outline: none; transition: border-color .15s, background .15s, box-shadow .15s; }
.dp-search input:hover { border-color: var(--dp-border); }
.dp-search input:focus { border-color: var(--dp-brand); background: var(--dp-bg); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent); }
.dp-search input::placeholder { color: var(--dp-text3); }
.dp-select { height: 36px; padding: 0 28px 0 10px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; outline: none; cursor: pointer; }
.dp-select:focus { border-color: var(--dp-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent); }
.dp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s, color .15s, box-shadow .15s, filter .15s; }
.dp-btn:hover { background: var(--dp-bg2); }
.dp-btn:focus-visible { outline: 2px solid var(--dp-brand); outline-offset: 2px; }
.dp-btn:disabled { opacity: .55; cursor: not-allowed; }
.dp-btn-primary { border-color: var(--dp-brand); background: var(--dp-brand); color: var(--dp-on-brand); }
.dp-btn-primary:hover { background: var(--dp-brand); filter: brightness(1.06); }
.dp-btn-ghost { border-color: transparent; background: transparent; color: var(--dp-text2); }
.dp-btn-ghost:hover { background: var(--dp-bg2); color: var(--dp-text); }
.dp-btn-danger { border-color: color-mix(in srgb, var(--dp-danger) 30%, transparent); color: var(--dp-danger); }
.dp-btn-danger:hover { background: color-mix(in srgb, var(--dp-danger) 8%, transparent); }
.dp-btn-sm { height: 30px; padding: 0 10px; font-size: 12px; }
.dp-demo-banner { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 12px; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--dp-warning) 26%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--dp-warning) 7%, transparent); color: var(--dp-text2); font-size: 12px; }
.dp-demo-banner b { color: var(--dp-warning); font-weight: 650; }
.dp-demo-banner button { margin-left: auto; padding: 0; border: 0; background: none; color: var(--dp-warning); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; }
.dp-demo-banner button:hover { text-decoration: underline; text-underline-offset: 2px; }
.dp-alert { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--dp-danger) 26%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--dp-danger) 7%, transparent); color: var(--dp-danger); font-size: 12px; }
.dp-alert button { margin-left: auto; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.dp-card { overflow: hidden; border: 1px solid var(--dp-border); border-radius: 14px; background: var(--dp-bg); }
.dp-card-scroll { overflow-x: clip; }
.dp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.dp-table th { padding: 11px 12px; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-align: left; white-space: nowrap; }
.dp-table th.dp-right { text-align: right; }
.dp-table td { padding: 12px; border-bottom: 1px solid var(--dp-border2); vertical-align: middle; letter-spacing: .02em; }
.dp-table tbody tr:last-child td { border-bottom: 0; }
.dp-row { transition: background .12s; }
.dp-row:hover { background: var(--dp-bg2); }
.dp-title-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dp-title-link { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; padding: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-weight: 550; text-align: left; cursor: pointer; }
.dp-title-link:hover { color: var(--dp-brand); }
.dp-title-link:hover .dp-title-text { text-decoration: underline; text-underline-offset: 3px; }
.dp-title-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-demo-tag { flex: 0 0 auto; padding: 0 6px; border: 1px solid color-mix(in srgb, var(--dp-warning) 36%, transparent); border-radius: 5px; color: var(--dp-warning); font-size: 10px; line-height: 16px; }
.dp-ext { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; color: var(--dp-text3); }
.dp-ext:hover { background: var(--dp-bg3); color: var(--dp-brand); }
.dp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; background: var(--dp-bg3); color: var(--dp-text2); font-size: 12px; font-weight: 500; line-height: 18px; white-space: nowrap; }
.dp-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
.dp-pill[data-tone="doing"] { background: color-mix(in srgb, var(--dp-brand) 10%, transparent); color: var(--dp-brand); }
.dp-pill[data-tone="done"] { background: color-mix(in srgb, var(--dp-success) 10%, transparent); color: var(--dp-success); }
.dp-pill[data-tone="blocked"] { background: color-mix(in srgb, var(--dp-danger) 10%, transparent); color: var(--dp-danger); }
.dp-chip { display: inline-block; max-width: 100%; overflow: hidden; padding: 1px 8px; border: 1px solid var(--dp-border); border-radius: 6px; color: var(--dp-text2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dp-case-id { display: block; overflow: hidden; color: var(--dp-text2); font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.dp-cell-text { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0; color: var(--dp-text2); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
.dp-cell-text.empty { color: var(--dp-text3); }
.dp-type { display: inline-block; max-width: 100%; overflow: hidden; padding: 1px 8px; border: 1px solid color-mix(in srgb, var(--dp-brand) 34%, transparent); border-radius: 6px; background: color-mix(in srgb, var(--dp-brand) 5%, transparent); color: var(--dp-brand); font-size: 12px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }
.dp-type[data-tone="perf"] { border-color: color-mix(in srgb, var(--dp-warning) 36%, transparent); background: color-mix(in srgb, var(--dp-warning) 7%, transparent); color: var(--dp-warning); }
.dp-type[data-tone="exception"] { border-color: color-mix(in srgb, var(--dp-danger) 34%, transparent); background: color-mix(in srgb, var(--dp-danger) 6%, transparent); color: var(--dp-danger); }
.dp-type[data-tone="compat"] { border-color: var(--dp-border); background: var(--dp-bg2); color: var(--dp-text2); }
.dp-owner { color: var(--dp-text2); }
.dp-time { color: var(--dp-text3); font-size: 12px; white-space: nowrap; }
.dp-actions { display: flex; justify-content: flex-end; align-items: center; gap: 0; }
.dp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s; }
.dp-icon-btn:hover { background: var(--dp-bg3); color: var(--dp-text); }
.dp-icon-btn.danger:hover { background: color-mix(in srgb, var(--dp-danger) 10%, transparent); color: var(--dp-danger); }
.dp-icon-btn:focus-visible { outline: 2px solid var(--dp-brand); outline-offset: 1px; }
.dp-icon-btn:disabled { opacity: .5; cursor: not-allowed; }
.dp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 72px 24px; text-align: center; }
.dp-empty-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; margin-bottom: 14px; border-radius: 14px; background: var(--dp-bg2); color: var(--dp-text3); }
.dp-empty h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.dp-empty p { max-width: 380px; margin: 0 0 18px; color: var(--dp-text2); font-size: 13px; }
.dp-skeleton-wrap { padding: 6px 0; }
.dp-skeleton-row { display: flex; align-items: center; gap: 24px; padding: 14px 16px; border-bottom: 1px solid var(--dp-border2); }
.dp-skeleton-row:last-child { border-bottom: 0; }
.dp-skeleton { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--dp-bg2) 25%, var(--dp-bg3) 37%, var(--dp-bg2) 63%); background-size: 400% 100%; animation: dp-shimmer 1.35s ease infinite; }
@keyframes dp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
.dp-foot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 10px; color: var(--dp-text3); font-size: 11px; }
.dp-card-foot { display: flex; justify-content: flex-end; padding: 10px 16px 11px; border-top: 1px solid var(--dp-border); background: var(--dp-bg); }
.dp-pager { display: flex; align-items: center; justify-content: flex-end; gap: 14px; color: var(--dp-text2); font-size: 12.5px; letter-spacing: .03em; }
.dp-pager-total { color: var(--dp-text3); letter-spacing: .05em; }
.dp-pager-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 74px; height: 32px; padding: 0 14px; border: 1px solid var(--dp-border); border-radius: 9px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 12.5px; letter-spacing: .06em; cursor: pointer; transition: background .12s, border-color .12s, color .12s; }
.dp-pager-btn:hover:not(:disabled) { border-color: var(--dp-text3); background: var(--dp-bg2); }
.dp-pager-btn:disabled { color: var(--dp-text3); cursor: not-allowed; opacity: .6; }
.dp-pager-page { display: inline-flex; align-items: center; justify-content: center; min-width: 68px; height: 32px; padding: 0 12px; border: 1px solid var(--dp-border); border-radius: 9px; background: var(--dp-bg2); color: var(--dp-text); font-size: 12.5px; font-variant-numeric: tabular-nums; letter-spacing: .08em; }
.dp-pager-size { display: inline-flex; align-items: center; gap: 8px; letter-spacing: .04em; }
.dp-pager-size select { height: 32px; padding: 0 26px 0 10px; border: 1px solid var(--dp-border); border-radius: 9px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 12.5px; letter-spacing: .04em; outline: none; cursor: pointer; }
.dp-code-body { margin: 0; padding: 14px 16px; max-height: 56vh; overflow: auto; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg2); color: var(--dp-text); font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 12.5px; line-height: 1.7; white-space: pre; tab-size: 2; }
.dp-code-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 34px 16px; border: 1px dashed var(--dp-border); border-radius: 10px; color: var(--dp-text3); font-size: 12px; text-align: center; }
.dp-code-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; color: var(--dp-text3); font-size: 11px; }
.dp-code-meta code { font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; }
.dp-mask { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 18, 24, .36); backdrop-filter: blur(2px); animation: dp-fade .14s ease; }
.dp-modal { display: flex; flex-direction: column; width: min(640px, 100%); max-height: 86vh; overflow: hidden; border: 1px solid var(--dp-border); border-radius: 16px; background: var(--dp-bg); box-shadow: 0 24px 80px rgba(0, 0, 0, .24); animation: dp-pop .16s ease; }
.dp-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 18px 20px 12px; }
.dp-modal-title { margin: 0; font-size: 16px; font-weight: 620; letter-spacing: -.01em; }
.dp-modal-sub { margin: 4px 0 0; color: var(--dp-text2); font-size: 12px; line-height: 1.5; }
.dp-modal-body { padding: 4px 20px 18px; overflow: auto; }
.dp-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--dp-border); background: var(--dp-bg); }
.dp-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 14px; }
.dp-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.dp-field.full { grid-column: 1 / -1; }
.dp-label { color: var(--dp-text2); font-size: 12px; font-weight: 500; }
.dp-label em { margin-left: 2px; color: var(--dp-danger); font-style: normal; }
.dp-hint { color: var(--dp-text3); font-size: 11px; line-height: 1.5; }
.dp-input, .dp-select, .dp-textarea { width: 100%; border: 1px solid var(--dp-border); border-radius: 9px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; outline: none; transition: border-color .15s, box-shadow .15s; }
.dp-input, .dp-select { height: 36px; padding: 0 10px; }
.dp-textarea { min-height: 64px; padding: 8px 10px; line-height: 1.55; resize: vertical; }
.dp-input:focus, .dp-select:focus, .dp-textarea:focus { border-color: var(--dp-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent); }
.dp-input-mono, .dp-textarea.mono { font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 12px; }
.dp-chip-mono { font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 11px; }
.dp-input::placeholder, .dp-textarea::placeholder { color: var(--dp-text3); }
.dp-form .dp-alert { grid-column: 1 / -1; margin: 0; }
.dp-detail { height: 100%; overflow: auto; padding: 18px 18px 40px; background: var(--dp-bg); color: var(--dp-text); font-size: 13px; }
.dp-detail-head { display: flex; flex-direction: column; gap: 9px; padding-bottom: 14px; border-bottom: 1px solid var(--dp-border); }
.dp-detail-kicker { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dp-detail-title { margin: 0; font-size: 20px; font-weight: 650; line-height: 1.35; letter-spacing: -.015em; word-break: break-word; }
.dp-detail-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: var(--dp-text2); font-size: 12px; }
.dp-meta-item { display: inline-flex; align-items: center; gap: 5px; }
.dp-meta-item b { color: var(--dp-text); font-weight: 500; }
.dp-detail-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 14px 0 0; }
.dp-section { margin-top: 18px; }
.dp-section h4 { margin: 0 0 8px; color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.dp-summary { margin: 0; padding: 11px 13px; border-radius: 10px; background: var(--dp-bg2); color: var(--dp-text); line-height: 1.65; white-space: pre-wrap; word-break: break-word; }
.dp-content { margin: 0; padding: 13px 14px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
.dp-detail-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 100%; min-height: 240px; padding: 24px; color: var(--dp-text2); text-align: center; }
.dp-detail-empty h3 { margin: 0; color: var(--dp-text); font-size: 15px; font-weight: 600; }
.dp-detail-empty p { max-width: 280px; margin: 0; font-size: 12px; }
.dp-confirm-text { margin: 0; color: var(--dp-text2); font-size: 13px; line-height: 1.7; }
.dp-confirm-text b { color: var(--dp-text); font-weight: 550; }
.dp-form-detail { grid-template-columns: 1fr; gap: 11px; }
.dp-detail-editor { padding-top: 14px; }
.dp-detail-editor .dp-form { margin-top: 2px; }
.dp-detail-editor-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
@keyframes dp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dp-pop { from { opacity: 0; transform: translateY(6px) scale(.985); } to { opacity: 1; transform: none; } }
@media (max-width: 900px) {
	.dp-table th, .dp-table td { padding: 10px 8px; }
	.dp-type { padding: 1px 6px; font-size: 11px; letter-spacing: 0; }
	.dp-case-id { font-size: 11px; }
	.dp-icon-btn { width: 24px; height: 24px; }
	.dp-pager { gap: 10px; }
	.dp-pager-btn { min-width: 62px; padding: 0 10px; }
}
@media (max-width: 760px) {
	.dp-shell { padding: 18px 16px 40px; }
	.dp-stats { width: 100%; }
	.dp-form { grid-template-columns: 1fr; }
	.dp-modal { max-height: 92vh; }
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-data-panel-style") !== null) return;
			var style = document.createElement("style");
			style.id = "dsh-data-panel-style";
			style.textContent = CSS;
			(document.head || document.documentElement).appendChild(style);
		}
		//#endregion

		//#region helpers
		var TEST_TYPES = {
			functional: { label: "功能测试", tone: "func" },
			boundary: { label: "边界测试", tone: "boundary" },
			performance: { label: "性能测试", tone: "perf" },
			exception: { label: "异常测试", tone: "exception" },
			compat: { label: "兼容性测试", tone: "compat" }
		};
		var TEST_TYPE_KEYS = Object.keys(TEST_TYPES);

		function cn() {
			var parts = [];
			for (var i = 0; i < arguments.length; i += 1) {
				var value = arguments[i];
				if (value) parts.push(value);
			}
			return parts.join(" ");
		}

		function fmtRelative(iso) {
			var time = Date.parse(iso);
			if (!Number.isFinite(time)) return "—";
			var diff = Date.now() - time;
			var abs = Math.abs(diff);
			if (abs < 60 * 1000) return "刚刚";
			if (abs < 3600 * 1000) return Math.floor(abs / (60 * 1000)) + " 分钟前";
			if (abs < 24 * 3600 * 1000) return Math.floor(abs / (3600 * 1000)) + " 小时前";
			if (abs < 7 * 24 * 3600 * 1000) return Math.floor(abs / (24 * 3600 * 1000)) + " 天前";
			return new Date(time).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
		}

		function fmtFull(iso) {
			var time = Date.parse(iso);
			if (!Number.isFinite(time)) return "—";
			return new Date(time).toLocaleString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			});
		}

		function sortRecords(records) {
			return records.slice().sort(function (left, right) {
				return String(right.updatedAt).localeCompare(String(left.updatedAt));
			});
		}

		/**
		 * Parse a stored `codeRef` into a jump target.
		 *
		 * Accepted spellings, all resolved against the case's repository:
		 *   src/RingBuffer.h:42        src/RingBuffer.h#L42
		 *   src/RingBuffer.h#L42-58    C:\repo\src\RingBuffer.h:42
		 *   src/RingBuffer.h:42:7      (line:column)
		 *
		 * The Windows drive colon is safe: the trailing group only matches when
		 * the colon is followed by digits AND nothing but the line/column tail
		 * remains, so `C:` can never be read as a line separator.
		 */
		function parseCodeRef(raw) {
			var ref = typeof raw === "string" ? raw.trim() : "";
			if (!ref) return null;
			var match = /^(.*?)\s*(?:#L(\d+)(?:[-~](\d+))?|:(\d+)(?::(\d+))?)$/.exec(ref);
			if (match === null) return null;
			var path = match[1].trim();
			if (!path) return null;
			var line = Number(match[2] !== undefined ? match[2] : match[4]);
			var end = match[3] !== undefined ? Number(match[3]) : undefined;
			var column = match[5] !== undefined ? Number(match[5]) : undefined;
			if (!Number.isFinite(line) || line < 1) return null;
			return {
				path: path,
				line: Math.floor(line),
				end: end !== undefined && Number.isFinite(end) && end >= line ? Math.floor(end) : undefined,
				column: column !== undefined && Number.isFinite(column) && column >= 1 ? Math.floor(column) : undefined
			};
		}

		/** 盘符绝对路径 / POSIX 绝对路径 / UNC 路径。 */
		function isAbsoluteCodePath(path) {
			return /^[A-Za-z]:[\\/]/.test(path) || path.charAt(0) === "/" || path.slice(0, 2) === "\\\\";
		}

		/** 反斜杠归一为正斜杠，去掉尾随分隔符。 */
		function toPosixPath(path) {
			return String(path).replace(/\\/g, "/").replace(/\/+$/, "");
		}
		//#endregion

		//#region icons
		function Icon(props) {
			var size = props.size || 16;
			var common = {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.7,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false"
			};
			var children = null;
			switch (props.name) {
				case "search":
					children = [h("circle", { key: "c", cx: 11, cy: 11, r: 7 }), h("path", { key: "p", d: "m20 20-3.5-3.5" })];
					break;
				case "plus":
					children = [h("path", { key: "a", d: "M12 5v14" }), h("path", { key: "b", d: "M5 12h14" })];
					break;
				case "edit":
					children = [h("path", { key: "a", d: "M12 20h9" }), h("path", { key: "b", d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" })];
					break;
				case "trash":
					children = [h("path", { key: "a", d: "M3 6h18" }), h("path", { key: "b", d: "M8 6V4h8v2" }), h("path", { key: "c", d: "M19 6l-1 14H6L5 6" }), h("path", { key: "d", d: "M10 11v5M14 11v5" })];
					break;
				case "refresh":
					children = [h("path", { key: "a", d: "M20 11a8 8 0 1 0-2.3 5.7" }), h("path", { key: "b", d: "M20 5v6h-6" })];
					break;
				case "external":
					children = [h("path", { key: "a", d: "M14 4h6v6" }), h("path", { key: "b", d: "M20 4 11 13" }), h("path", { key: "c", d: "M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" })];
					break;
				case "code":
					children = [h("path", { key: "a", d: "m9 8-5 4 5 4" }), h("path", { key: "b", d: "m15 8 5 4-5 4" }), h("path", { key: "c", d: "m13 5-2 14" })];
					break;
				case "copy":
					children = [h("rect", { key: "a", x: 9, y: 9, width: 11, height: 11, rx: 2 }), h("path", { key: "b", d: "M5 15V5a1 1 0 0 1 1-1h9" })];
					break;
				case "location":
					children = [h("circle", { key: "a", cx: 12, cy: 12, r: 3 }), h("path", { key: "b", d: "M12 3v3M12 18v3M3 12h3M18 12h3" })];
					break;
				case "close":
					children = [h("path", { key: "a", d: "m6 6 12 12" }), h("path", { key: "b", d: "m18 6-12 12" })];
					break;
				case "doc":
					children = [h("path", { key: "a", d: "M6 3h8l4 4v14H6z" }), h("path", { key: "b", d: "M14 3v5h5" }), h("path", { key: "c", d: "M9 13h6M9 17h4" })];
					break;
				case "link":
					children = [h("path", { key: "a", d: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" }), h("path", { key: "b", d: "M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" })];
					break;
				default:
					children = [h("circle", { key: "c", cx: 12, cy: 12, r: 8 })];
			}
			return h("svg", common, children);
		}
		//#endregion

		//#region store
		function createStore() {
			var snapshot = { status: "idle", records: [], demoCount: 0, error: "" };
			var listeners = new Set();
			var inflight = null;

			function emit() {
				listeners.forEach(function (listener) {
					listener();
				});
			}

			function publish(patch) {
				snapshot = Object.assign({}, snapshot, patch);
				emit();
			}

			function commit(records) {
				var next = sortRecords(records);
				publish({
					status: "ready",
					records: next,
					demoCount: next.filter(function (record) { return record.demo === true; }).length,
					error: ""
				});
			}

			function request(body) {
				var init = body === undefined
					? { method: "GET", headers: { accept: "application/json" } }
					: {
						method: "POST",
						headers: { "content-type": "application/json", accept: "application/json" },
						body: JSON.stringify(body)
					};
				return fetch("/data-panel/api", init).then(function (response) {
					return response.json().catch(function () { return {}; }).then(function (data) {
						if (!response.ok || data.ok === false) {
							throw new Error(data && data.error ? data.error : "请求失败（HTTP " + response.status + "）");
						}
						return data;
					});
				});
			}

			return {
				subscribe: function (listener) {
					listeners.add(listener);
					return function () {
						listeners.delete(listener);
					};
				},
				getSnapshot: function () {
					return snapshot;
				},
				setError: function (message) {
					publish({ error: message || "" });
				},
				load: function (force) {
					if (!force && snapshot.status === "ready") return Promise.resolve(snapshot);
					if (inflight !== null) return inflight;
					publish({ status: snapshot.status === "ready" ? "refreshing" : "loading", error: "" });
					inflight = request()
						.then(function (data) {
							commit(data.records || []);
							return snapshot;
						})
						.catch(function (error) {
							publish({ status: snapshot.status === "refreshing" ? "ready" : "error", error: error.message });
							throw error;
						})
						.finally(function () {
							inflight = null;
						});
					return inflight;
				},
				create: function (record) {
					return request({ op: "create", record: record }).then(function (data) {
						commit(snapshot.records.concat([data.record]));
						return data.record;
					});
				},
				update: function (id, patch) {
					return request({ op: "update", id: id, patch: patch }).then(function (data) {
						commit(snapshot.records.map(function (record) {
							return record.id === id ? data.record : record;
						}));
						return data.record;
					});
				},
				remove: function (id) {
					return request({ op: "delete", id: id }).then(function () {
						commit(snapshot.records.filter(function (record) { return record.id !== id; }));
					});
				},
				clearDemo: function () {
					return request({ op: "clearDemo" }).then(function () {
						commit(snapshot.records.filter(function (record) { return record.demo !== true; }));
					});
				}
			};
		}

		var store = createStore();
		//#endregion

		//#region primitives
		function Button(props) {
			var variant = props.variant ? "dp-btn-" + props.variant : "";
			return h("button", {
				type: "button",
				className: cn("dp-btn", variant, props.size === "sm" ? "dp-btn-sm" : "", props.className),
				onClick: props.onClick,
				disabled: props.disabled === true,
				title: props.title
			}, props.children);
		}

		function IconButton(props) {
			return h("button", {
				type: "button",
				className: cn("dp-icon-btn", props.danger ? "danger" : "", props.className),
				onClick: props.onClick,
				disabled: props.disabled === true,
				title: props.label,
				"aria-label": props.label
			}, h(Icon, { name: props.name, size: 15 }));
		}

		function Field(props) {
			return h("label", { className: cn("dp-field", props.full ? "full" : "") },
				h("span", { className: "dp-label" }, props.label, props.required ? h("em", null, "*") : null),
				props.children,
				props.hint ? h("span", { className: "dp-hint" }, props.hint) : null
			);
		}

		function TypeTag(props) {
			var meta = TEST_TYPES[props.testType] || TEST_TYPES.functional;
			return h("span", { className: "dp-type", "data-tone": meta.tone }, meta.label);
		}

		function CaseId(props) {
			var value = props.caseId || "";
			return h("span", { className: "dp-case-id", title: value || "未填写用例标识" }, value || "—");
		}

		function CellText(props) {
			var value = props.value || "";
			return h("p", { className: cn("dp-cell-text", value ? "" : "empty") }, value || "—");
		}

		function Modal(props) {
			useEffect(function () {
				function onKey(event) {
					if (event.key === "Escape" && props.busy !== true) props.onClose();
				}
				document.addEventListener("keydown", onKey);
				return function () {
					document.removeEventListener("keydown", onKey);
				};
			}, [props.busy, props.onClose]);

			var content = h("div", {
				className: "dp-mask",
				onMouseDown: function (event) {
					if (event.target === event.currentTarget && props.busy !== true) props.onClose();
				}
			},
				h("div", {
					className: "dp-modal",
					role: "dialog",
					"aria-modal": "true",
					"aria-label": props.title
				},
					h("div", { className: "dp-modal-head" },
						h("div", null,
							h("h3", { className: "dp-modal-title" }, props.title),
							props.subtitle ? h("p", { className: "dp-modal-sub" }, props.subtitle) : null
						),
						h(IconButton, { name: "close", label: "关闭", onClick: props.onClose, disabled: props.busy === true })
					),
					h("div", { className: "dp-modal-body" }, props.children),
					props.footer ? h("div", { className: "dp-modal-foot" }, props.footer) : null
				)
			);
			return ReactDOM.createPortal(content, document.body);
		}

		function ConfirmDialog(props) {
			return h(Modal, {
				title: props.title,
				subtitle: props.message,
				onClose: props.onCancel,
				busy: props.busy,
				footer: [
					h(Button, { key: "cancel", onClick: props.onCancel, disabled: props.busy }, "取消"),
					h(Button, { key: "ok", variant: "danger", onClick: props.onConfirm, disabled: props.busy }, props.busy ? "处理中…" : (props.confirmLabel || "删除"))
				]
			}, props.detail ? h("p", { className: "dp-confirm-text" }, props.detail) : null);
		}

		function Pager(props) {
			var sizes = [5, 10, 20, 50];
			var atFirst = props.page <= 1;
			var atLast = props.page >= props.pageCount;
			return h("div", { className: "dp-pager" },
				h("span", { className: "dp-pager-total" }, "共 " + props.total + " 条"),
				h("span", { className: "dp-pager-size" }, "每页",
					h("select", {
						value: String(props.pageSize),
						onChange: function (event) { props.onPageSize(Number(event.target.value)); },
						"aria-label": "每页条数"
					}, sizes.map(function (size) {
						return h("option", { key: size, value: String(size) }, size + " 条");
					})),
					"条"
				),
				h("button", {
					type: "button",
					className: "dp-pager-btn",
					disabled: atFirst,
					onClick: function () { if (!atFirst) props.onPage(props.page - 1); }
				}, "上一页"),
				h("span", { className: "dp-pager-page" }, props.page + " / " + props.pageCount),
				h("button", {
					type: "button",
					className: "dp-pager-btn",
					disabled: atLast,
					onClick: function () { if (!atLast) props.onPage(props.page + 1); }
				}, "下一页")
			);
		}

		function CodeModal(props) {
			var record = props.record;
			var code = record.code || "";
			var labelState = useState("复制代码");
			var copyLabel = labelState[0];
			var setCopyLabel = labelState[1];

			function copy() {
				try {
					if (typeof navigator === "undefined" || !navigator.clipboard) {
						setCopyLabel("请手动选中复制");
						return;
					}
					navigator.clipboard.writeText(code).then(function () {
						setCopyLabel("已复制");
					}, function () {
						setCopyLabel("复制失败");
					});
				} catch (error) {
					setCopyLabel("复制失败");
				}
			}

			return h(Modal, {
				title: "用例代码",
				subtitle: record.title,
				onClose: props.onClose,
				footer: [
					h(Button, { key: "close", onClick: props.onClose }, "关闭"),
					code ? h(Button, { key: "copy", variant: "primary", onClick: copy },
						h(Icon, { name: "copy", size: 14 }),
						copyLabel
					) : null
				]
			},
				h("div", { className: "dp-code-meta" },
					record.caseId ? h("code", null, record.caseId) : null,
					h(TypeTag, { testType: record.testType })
				),
				code
					? h("pre", { className: "dp-code-body" }, code)
					: h("div", { className: "dp-code-empty" },
						h(Icon, { name: "code", size: 22 }),
						"这条用例还没有关联代码，点「编辑」补充。"
					)
			);
		}
		//#endregion

		//#region table view
		function SearchBox(props) {
			return h("div", { className: "dp-search" },
				h(Icon, { name: "search", size: 15 }),
				h("input", {
					type: "search",
					value: props.value,
					placeholder: "搜索用例名称 / 用例标识 / 测试说明",
					onChange: function (event) { props.onChange(event.target.value); },
					"aria-label": "搜索用例"
				})
			);
		}

		function EmptyState(props) {
			var filtered = props.filtered;
			return h("div", { className: "dp-empty" },
				h("div", { className: "dp-empty-icon" }, h(Icon, { name: "doc", size: 23 })),
				h("h3", null, filtered ? "没有匹配的用例" : "还没有用例"),
				h("p", null, filtered
					? "换个关键词或清除筛选条件试试。"
					: "把需要跟踪的测试用例放进面板，点击用例名称即可在右侧查看详情。"),
				filtered
					? h(Button, { onClick: props.onClear }, "清除筛选")
					: h(Button, { variant: "primary", onClick: props.onCreate },
						h(Icon, { name: "plus", size: 15 }),
						"新增用例"
					)
			);
		}

		function SkeletonTable() {
			var widths = [["14%", "16%", "9%", "20%", "14%", "13%", "6%"], ["18%", "12%", "8%", "22%", "12%", "14%", "6%"], ["12%", "18%", "9%", "19%", "15%", "12%", "6%"], ["16%", "14%", "8%", "21%", "13%", "13%", "6%"]];
			return h("div", { className: "dp-skeleton-wrap" }, widths.map(function (widths, index) {
				return h("div", { className: "dp-skeleton-row", key: index }, widths.map(function (width, column) {
					return h("div", { className: "dp-skeleton", key: column, style: { width: width } });
				}));
			}));
		}

		function RecordFormModal(props) {
			var initial = props.record || {};
			var state = useState(function () {
				return {
					caseId: initial.caseId || "",
					title: initial.title || "",
					testType: initial.testType || "functional",
					description: initial.description || "",
					input: initial.input || "",
					expected: initial.expected || "",
					code: initial.code || "",
					codeRef: initial.codeRef || ""
				};
			});
			var values = state[0];
			var setValues = state[1];
			var errorState = useState("");
			var localError = errorState[0];
			var setLocalError = errorState[1];
			var firstRef = useRef(null);

			useEffect(function () {
				if (firstRef.current !== null) firstRef.current.focus();
			}, []);

			function set(key, value) {
				setValues(function (previous) {
					var next = Object.assign({}, previous);
					next[key] = value;
					return next;
				});
			}

			function submit(event) {
				if (event) event.preventDefault();
				if (!values.title.trim()) {
					setLocalError("用例名称不能为空");
					return;
				}
				setLocalError("");
				props.onSubmit(values);
			}

			var error = localError || props.error || "";
			return h(Modal, {
				title: props.mode === "edit" ? "编辑用例" : "新增用例",
				subtitle: props.mode === "edit"
					? "修改后立即写入本地数据文件，右侧详情会同步更新。"
					: "填写用例标识、类型、说明与输入输出，保存后点击用例名称可查看详情。",
				onClose: props.onClose,
				busy: props.busy,
				footer: [
					h(Button, { key: "cancel", onClick: props.onClose, disabled: props.busy }, "取消"),
					h(Button, { key: "save", variant: "primary", onClick: function () { submit(); }, disabled: props.busy },
						props.busy ? "保存中…" : (props.mode === "edit" ? "保存修改" : "创建用例")
					)
				]
			},
				h("form", { className: "dp-form", onSubmit: submit },
					error ? h("div", { className: "dp-alert" }, error) : null,
					h(Field, { label: "用例名称", required: true, full: true },
						h("input", {
							ref: firstRef,
							className: "dp-input",
							value: values.title,
							maxLength: 200,
							placeholder: "例如：RingBuffer功能测试",
							onChange: function (event) { set("title", event.target.value); }
						})
					),
					h(Field, { label: "用例标识", hint: "留空会自动生成一个 TC-xxxxxxxx。" },
						h("input", {
							className: "dp-input dp-input-mono",
							value: values.caseId,
							maxLength: 80,
							placeholder: "GN-ZZKZ-RINGBUFF-T001",
							onChange: function (event) { set("caseId", event.target.value); }
						})
					),
					h(Field, { label: "测试类型" },
						h("select", {
							className: "dp-select",
							value: values.testType,
							onChange: function (event) { set("testType", event.target.value); }
						}, TEST_TYPE_KEYS.map(function (key) {
							return h("option", { key: key, value: key }, TEST_TYPES[key].label);
						}))
					),
					h(Field, { label: "测试说明", full: true },
						h("textarea", {
							className: "dp-textarea",
							rows: 2,
							value: values.description,
							maxLength: 2000,
							placeholder: "这条用例验证什么行为",
							onChange: function (event) { set("description", event.target.value); }
						})
					),
					h(Field, { label: "输入", hint: "调用参数、前置数据等。" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 4,
							value: values.input,
							maxLength: 4000,
							placeholder: "m_totalCapacity=5",
							onChange: function (event) { set("input", event.target.value); }
						})
					),
					h(Field, { label: "预期输出", hint: "执行后应当观察到的结果。" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 4,
							value: values.expected,
							maxLength: 4000,
							placeholder: "m_size=0",
							onChange: function (event) { set("expected", event.target.value); }
						})
					),
					h(Field, {
						label: "被测源码",
						full: true,
						hint: "这条用例覆盖的源文件位置，形如 src/RingBuffer.h:42（也接受 #L42、#L42-58）。表格操作列的定位按钮据此跳到编辑器。"
					},
						h("input", {
							className: "dp-input mono",
							value: values.codeRef,
							maxLength: 200,
							placeholder: "src/RingBuffer.h:42",
							onChange: function (event) { set("codeRef", event.target.value); }
						})
					),
					h(Field, { label: "代码", full: true, hint: "这条用例的测试代码。填了「被测源码」后表格的定位按钮会跳原件，这里的代码仍可用「</>」按钮查看。" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 8,
							value: values.code,
							maxLength: 20000,
							placeholder: "TEST(RingBufferTest, InitState) {\n  RingBuffer<int> buf(5);\n  EXPECT_EQ(buf.size(), 0);\n}",
							onChange: function (event) { set("code", event.target.value); }
						})
					)
				)
			);
		}

		function DataPanelView(props) {
			var snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			var queryState = useState("");
			var query = queryState[0];
			var setQuery = queryState[1];
			var typeState = useState("all");
			var type = typeState[0];
			var setType = typeState[1];
			var formState = useState(null);
			var form = formState[0];
			var setForm = formState[1];
			var confirmState = useState(null);
			var confirm = confirmState[0];
			var setConfirm = confirmState[1];
			var busyState = useState(false);
			var busy = busyState[0];
			var setBusy = busyState[1];
			var formErrorState = useState("");
			var formError = formErrorState[0];
			var setFormError = formErrorState[1];
			var pageState = useState(1);
			var page = pageState[0];
			var setPage = pageState[1];
			var pageSizeState = useState(5);
			var pageSize = pageSizeState[0];
			var setPageSize = pageSizeState[1];
			var codeState = useState(null);
			var codeRecord = codeState[0];
			var setCodeRecord = codeState[1];

			useEffect(function () {
				store.load().catch(function () {});
			}, []);

			var records = snap.records || [];
			var filtered = useMemo(function () {
				var needle = query.trim().toLowerCase();
				return records.filter(function (record) {
					if (type !== "all" && record.testType !== type) return false;
					if (!needle) return true;
					return [record.caseId, record.title, record.description, record.input, record.expected]
						.join(" ")
						.toLowerCase()
						.indexOf(needle) !== -1;
				});
			}, [records, query, type]);

			var functionalCount = records.filter(function (record) { return record.testType === "functional"; }).length;
			var boundaryCount = records.filter(function (record) { return record.testType === "boundary"; }).length;

			useEffect(function () {
				setPage(1);
			}, [query, type]);

			var pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
			var currentPage = Math.min(Math.max(1, page), pageCount);
			var pageStart = (currentPage - 1) * pageSize;
			var pageRecords = filtered.slice(pageStart, pageStart + pageSize);

			function changePageSize(size) {
				if (!Number.isFinite(size) || size <= 0) return;
				setPageSize(size);
				setPage(1);
			}

			function changePage(next) {
				if (next < 1 || next > pageCount) return;
				setPage(next);
			}

			function openDetail(id) {
				if (typeof props.openDetail !== "function") {
					store.setError("右侧栏服务尚未就绪，请刷新页面后再试。");
					return;
				}
				props.openDetail(id);
			}

			function openCreate() {
				setFormError("");
				setForm({ mode: "create" });
			}

			function openEdit(record) {
				setFormError("");
				setForm({ mode: "edit", record: record });
			}

			function submit(values) {
				setBusy(true);
				setFormError("");
				var action = form && form.mode === "edit"
					? store.update(form.record.id, values)
					: store.create(values);
				action
					.then(function () {
						setForm(null);
					})
					.catch(function (error) {
						setFormError(error.message);
					})
					.finally(function () {
						setBusy(false);
					});
			}

			function confirmAction() {
				if (confirm === null) return;
				setBusy(true);
				var action = confirm.kind === "clearDemo" ? store.clearDemo() : store.remove(confirm.record.id);
				action
					.then(function () {
						setConfirm(null);
					})
					.catch(function (error) {
						store.setError(error.message);
					})
					.finally(function () {
						setBusy(false);
					});
			}

			function refresh() {
				store.load(true).catch(function () {});
			}

			var loading = (snap.status === "idle" || snap.status === "loading") && records.length === 0;
			var filtering = query.trim() !== "" || type !== "all";

			return h("div", { className: "dp-root" },
				h("div", { className: "dp-shell" },
					h("div", { className: "dp-header" },
						h("div", null,
							h("div", { className: "dp-eyebrow" }, "Test Cases"),
							h("h1", { className: "dp-title" }, "测试用例"),
							h("p", { className: "dp-subtitle" }, "会话里的用例台账。点击用例名称在右侧查看详情，表格里直接完成增删改查。")
						),
						h("div", { className: "dp-stats" },
							h("div", { className: "dp-stat" },
								h("b", null, String(records.length)),
								h("span", null, "全部用例")
							),
							h("div", { className: "dp-stat" },
								h("b", null, String(functionalCount)),
								h("span", null, "功能测试")
							),
							h("div", { className: "dp-stat" },
								h("b", null, String(boundaryCount)),
								h("span", null, "边界测试")
							),
							snap.demoCount > 0 ? h("div", { className: "dp-stat" },
								h("b", null, String(snap.demoCount)),
								h("span", null, "示例")
							) : null
						)
					),
					h("div", { className: "dp-toolbar" },
						h(SearchBox, { value: query, onChange: setQuery }),
						h("select", {
							className: "dp-select",
							value: type,
							onChange: function (event) { setType(event.target.value); },
							"aria-label": "按测试类型筛选"
						},
							h("option", { value: "all" }, "全部类型"),
							TEST_TYPE_KEYS.map(function (key) {
								return h("option", { key: key, value: key }, TEST_TYPES[key].label);
							})
						),
						h(Button, { variant: "ghost", onClick: refresh, disabled: snap.status === "refreshing" },
							h(Icon, { name: "refresh", size: 15 }),
							snap.status === "refreshing" ? "刷新中…" : "刷新"
						),
						h(Button, { variant: "primary", onClick: openCreate },
							h(Icon, { name: "plus", size: 15 }),
							"新增用例"
						)
					),
					snap.error ? h("div", { className: "dp-alert" },
						snap.error,
						h("button", { type: "button", onClick: refresh }, "重试")
					) : null,
					snap.demoCount > 0 ? h("div", { className: "dp-demo-banner" },
						h("b", null, "示例数据"),
						h("span", null, "这些用例用于演示面板能力，可直接编辑或删除。"),
						h("button", {
							type: "button",
							onClick: function () { setConfirm({ kind: "clearDemo" }); }
						}, "清空示例")
					) : null,
					h("div", { className: "dp-card" },
						h("div", { className: "dp-card-scroll" },
							loading
								? h(SkeletonTable)
								: filtered.length === 0
									? h(EmptyState, {
										filtered: filtering,
										onClear: function () { setQuery(""); setType("all"); },
										onCreate: openCreate
									})
									: h("table", { className: "dp-table" },
										h("colgroup", null,
											h("col", { style: { width: "14%" } }),
											h("col", { style: { width: "15%" } }),
											h("col", { style: { width: "10%" } }),
											h("col", { style: { width: "19%" } }),
											h("col", { style: { width: "13%" } }),
											h("col", { style: { width: "13%" } }),
											h("col", { style: { width: "16%" } })
										),
										h("thead", null,
											h("tr", null,
												h("th", null, "用例标识"),
												h("th", null, "用例名称"),
												h("th", null, "测试类型"),
												h("th", null, "测试说明"),
												h("th", null, "输入"),
												h("th", null, "预期输出"),
												h("th", { className: "dp-right" }, "操作")
											)
										),
										h("tbody", null, pageRecords.map(function (record) {
											return h("tr", { key: record.id, className: "dp-row" },
												h("td", null, h(CaseId, { caseId: record.caseId })),
												h("td", null,
													h("div", { className: "dp-title-cell" },
														h("button", {
															type: "button",
															className: "dp-title-link",
															title: record.title,
															onClick: function () { openDetail(record.id); }
														},
															h("span", { className: "dp-title-text" }, record.title)
														),
														record.demo ? h("span", { className: "dp-demo-tag" }, "示例") : null
													)
												),
												h("td", null, h(TypeTag, { testType: record.testType })),
												h("td", null, h(CellText, { value: record.description })),
												h("td", null, h(CellText, { value: record.input })),
												h("td", null, h(CellText, { value: record.expected })),
												h("td", null,
													h("div", { className: "dp-actions" },
														h(IconButton, {
															name: record.codeRef ? "location" : "code",
															label: (record.codeRef ? "查看源码 " : "查看代码 ") + record.title,
															onClick: function () {
																// 有用例源码位置就跳编辑器；没有则沿用弹窗看用例代码。
																if (record.codeRef && typeof props.openCode === "function") props.openCode(record.codeRef);
																else setCodeRecord(record);
															}
														}),
														h(IconButton, {
															name: "edit",
															label: "编辑 " + record.title,
															onClick: function () { openEdit(record); }
														}),
														h(IconButton, {
															name: "trash",
															label: "删除 " + record.title,
															danger: true,
															onClick: function () { setConfirm({ kind: "delete", record: record }); }
														})
													)
												)
											);
										}))
									)
						),
						loading || filtered.length === 0 ? null : h("div", { className: "dp-card-foot" },
							h(Pager, {
								total: filtered.length,
								page: currentPage,
								pageCount: pageCount,
								pageSize: pageSize,
								onPage: changePage,
								onPageSize: changePageSize
							})
						)
					)
				),
				form !== null ? h(RecordFormModal, {
					mode: form.mode,
					record: form.record,
					busy: busy,
					error: formError,
					onClose: function () { if (!busy) setForm(null); },
					onSubmit: submit
				}) : null,
				codeRecord !== null ? h(CodeModal, {
					record: codeRecord,
					onClose: function () { setCodeRecord(null); }
				}) : null,
				confirm !== null ? h(ConfirmDialog, {
					title: confirm.kind === "clearDemo" ? "清空示例用例？" : "删除这条用例？",
					message: confirm.kind === "clearDemo"
						? "只会移除标记为示例的用例，你后来新建或编辑过的内容会保留。"
						: "删除后无法恢复，右侧已打开的详情页也会变为空。",
					detail: confirm.kind === "delete" ? h("span", null, "即将删除：", h("b", null, confirm.record.title)) : null,
					confirmLabel: confirm.kind === "clearDemo" ? "清空示例" : "删除",
					busy: busy,
					onCancel: function () { if (!busy) setConfirm(null); },
					onConfirm: confirmAction
				}) : null
			);
		}
		//#endregion

		//#region detail view
		function DetailEditor(props) {
			var record = props.record;
			var state = useState(function () {
				return {
					caseId: record.caseId || "",
					title: record.title || "",
					testType: record.testType || "functional",
					description: record.description || "",
					input: record.input || "",
					expected: record.expected || "",
					code: record.code || "",
					codeRef: record.codeRef || ""
				};
			});
			var values = state[0];
			var setValues = state[1];
			var errorState = useState("");
			var localError = errorState[0];
			var setLocalError = errorState[1];

			function set(key, value) {
				setValues(function (previous) {
					var next = Object.assign({}, previous);
					next[key] = value;
					return next;
				});
			}

			function submit(event) {
				if (event) event.preventDefault();
				if (!values.title.trim()) {
					setLocalError("用例名称不能为空");
					return;
				}
				setLocalError("");
				props.onSave(values);
			}

			var error = localError || props.error || "";
			return h("div", { className: "dp-detail-editor" },
				h("form", { className: "dp-form dp-form-detail", onSubmit: submit },
					error ? h("div", { className: "dp-alert" }, error) : null,
					h(Field, { label: "用例名称", required: true },
						h("input", {
							className: "dp-input",
							value: values.title,
							maxLength: 200,
							onChange: function (event) { set("title", event.target.value); }
						})
					),
					h(Field, { label: "用例标识" },
						h("input", {
							className: "dp-input dp-input-mono",
							value: values.caseId,
							maxLength: 80,
							placeholder: "GN-ZZKZ-RINGBUFF-T001",
							onChange: function (event) { set("caseId", event.target.value); }
						})
					),
					h(Field, { label: "测试类型" },
						h("select", {
							className: "dp-select",
							value: values.testType,
							onChange: function (event) { set("testType", event.target.value); }
						}, TEST_TYPE_KEYS.map(function (key) {
							return h("option", { key: key, value: key }, TEST_TYPES[key].label);
						}))
					),
					h(Field, { label: "测试说明" },
						h("textarea", {
							className: "dp-textarea",
							rows: 2,
							value: values.description,
							maxLength: 2000,
							onChange: function (event) { set("description", event.target.value); }
						})
					),
					h(Field, { label: "输入" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 4,
							value: values.input,
							maxLength: 4000,
							onChange: function (event) { set("input", event.target.value); }
						})
					),
					h(Field, { label: "预期输出" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 4,
							value: values.expected,
							maxLength: 4000,
							onChange: function (event) { set("expected", event.target.value); }
						})
					),
					h(Field, { label: "被测源码", hint: "形如 src/RingBuffer.h:42" },
						h("input", {
							className: "dp-input mono",
							value: values.codeRef,
							maxLength: 200,
							placeholder: "src/RingBuffer.h:42",
							onChange: function (event) { set("codeRef", event.target.value); }
						})
					),
					h(Field, { label: "代码" },
						h("textarea", {
							className: "dp-textarea mono",
							rows: 8,
							value: values.code,
							maxLength: 20000,
							onChange: function (event) { set("code", event.target.value); }
						})
					)
				),
				h("div", { className: "dp-detail-editor-foot" },
					h(Button, { onClick: props.onCancel, disabled: props.busy }, "取消"),
					h(Button, { variant: "primary", onClick: function () { submit(); }, disabled: props.busy }, props.busy ? "保存中…" : "保存")
				)
			);
		}

		function DetailView(props) {
			var record = props.record;
			return h("div", { className: "dp-detail" },
				h("div", { className: "dp-detail-head" },
					h("div", { className: "dp-detail-kicker" },
						record.caseId ? h("span", { className: "dp-chip dp-chip-mono" }, record.caseId) : null,
						h(TypeTag, { testType: record.testType }),
						record.demo ? h("span", { className: "dp-demo-tag" }, "示例数据") : null
					),
					h("h2", { className: "dp-detail-title" }, record.title),
					h("div", { className: "dp-detail-meta" },
						h("span", { className: "dp-meta-item" }, "更新 ", h("b", null, fmtRelative(record.updatedAt))),
						h("span", { className: "dp-meta-item", title: fmtFull(record.createdAt) }, "创建 ", h("b", null, fmtRelative(record.createdAt)))
					)
				),
				h("div", { className: "dp-detail-actions" },
					record.codeRef ? h(Button, { size: "sm", onClick: props.onOpenCode },
						h(Icon, { name: "location", size: 14 }),
						"查看源码"
					) : null,
					h(Button, { size: "sm", onClick: props.onEdit }, h(Icon, { name: "edit", size: 14 }), "编辑"),
					h(Button, { size: "sm", variant: "danger", onClick: props.onDelete }, h(Icon, { name: "trash", size: 14 }), "删除")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "测试说明"),
					record.description
						? h("p", { className: "dp-summary" }, record.description)
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "暂无说明，点击「编辑」补充这条用例验证的行为。")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "输入"),
					record.input
						? h("pre", { className: "dp-content" }, record.input)
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "未填写输入。")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "预期输出"),
					record.expected
						? h("pre", { className: "dp-content" }, record.expected)
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "未填写预期输出。")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "被测源码"),
					record.codeRef
						? h("p", { className: "dp-summary" }, h("code", { className: "dp-chip-mono" }, record.codeRef))
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "未记录代码位置，点击「编辑」补充这条用例覆盖的源文件与行号。")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "代码"),
					record.code
						? h("pre", { className: "dp-content dp-code-body" }, record.code)
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "这条用例还没有关联代码，点击「编辑」补充。")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "元信息"),
					h("div", { className: "dp-detail-meta" },
						h("span", { className: "dp-meta-item" }, "记录 ID ", h("b", null, record.id)),
						h("span", { className: "dp-meta-item" }, "最后更新 ", h("b", null, fmtFull(record.updatedAt)))
					)
				)
			);
		}

		function DetailBody(props) {
			var info = null;
			var infoError = "";
			try {
				info = props.useTabInfo();
			} catch (error) {
				infoError = error instanceof Error ? error.message : String(error);
			}

			var snap = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
			var navigation = info && info.tab && info.tab.navigation ? info.tab.navigation : null;
			var params = navigation && navigation.params ? navigation.params : {};
			var id = typeof params.id === "string" ? params.id : "";
			// 详情 Tab 由表格打开：带上记录所属会话，相对路径才能解析到工作区。
			var sessionId = typeof params.sessionId === "string" ? params.sessionId : "";

			var editingState = useState(false);
			var editing = editingState[0];
			var setEditing = editingState[1];
			var confirmState = useState(false);
			var confirm = confirmState[0];
			var setConfirm = confirmState[1];
			var busyState = useState(false);
			var busy = busyState[0];
			var setBusy = busyState[1];
			var errorState = useState("");
			var error = errorState[0];
			var setError = errorState[1];

			useEffect(function () {
				store.load().catch(function () {});
			}, []);

			useEffect(function () {
				setEditing(false);
				setConfirm(false);
				setError("");
			}, [id]);

			var record = snap.records.find(function (item) { return item.id === id; }) || null;

			function closeTab() {
				try {
					if (info && info.tab && info.tab.actions && typeof info.tab.actions.close === "function") {
						info.tab.actions.close();
					}
				} catch {
					// The tab may already be gone.
				}
			}

			function save(values) {
				setBusy(true);
				setError("");
				store.update(id, values)
					.then(function () {
						setEditing(false);
					})
					.catch(function (failure) {
						setError(failure.message);
					})
					.finally(function () {
						setBusy(false);
					});
			}

			function remove() {
				setBusy(true);
				setError("");
				store.remove(id)
					.then(function () {
						setConfirm(false);
						closeTab();
					})
					.catch(function (failure) {
						setError(failure.message);
					})
					.finally(function () {
						setBusy(false);
					});
			}

			if (infoError) {
				return h("div", { className: "dp-detail" },
					h("div", { className: "dp-detail-empty" },
						h("h3", null, "无法读取标签信息"),
						h("p", null, infoError)
					)
				);
			}

			if ((snap.status === "idle" || snap.status === "loading") && record === null) {
				return h("div", { className: "dp-detail" },
					h("div", { className: "dp-skeleton-wrap" },
						[0, 1, 2].map(function (index) {
							return h("div", { className: "dp-skeleton-row", key: index },
								h("div", { className: "dp-skeleton", style: { width: (60 - index * 10) + "%" } })
							);
						})
					)
				);
			}

			if (record === null && snap.error) {
				return h("div", { className: "dp-detail" },
					h("div", { className: "dp-detail-empty" },
						h("h3", null, "加载失败"),
						h("p", null, snap.error),
						h(Button, { size: "sm", onClick: function () { store.load(true).catch(function () {}); } }, "重试")
					)
				);
			}

			if (record === null) {
				return h("div", { className: "dp-detail" },
					h("div", { className: "dp-detail-empty" },
						h("div", { className: "dp-empty-icon" }, h(Icon, { name: "doc", size: 22 })),
						h("h3", null, "用例不存在"),
						h("p", null, "它可能已经被删除，或这条详情链接来自另一份数据。"),
						h(Button, { size: "sm", onClick: closeTab }, "关闭标签")
					)
				);
			}

			return h("div", { className: "dp-detail" },
				h(DetailView, {
					record: record,
					onEdit: function () { setEditing(true); setError(""); },
					onDelete: function () { setConfirm(true); setError(""); },
					onOpenCode: function () {
						if (typeof props.openCode === "function") props.openCode(record.codeRef, sessionId);
					}
				}),
				editing ? h(DetailEditor, {
					record: record,
					busy: busy,
					error: error,
					onSave: save,
					onCancel: function () { if (!busy) { setEditing(false); setError(""); } }
				}) : null,
				!editing && error ? h("div", { className: "dp-alert", style: { marginTop: "12px" } }, error) : null,
				confirm ? h(ConfirmDialog, {
					title: "删除这条用例？",
					message: "删除后无法恢复，列表和右侧详情都会同步移除。",
					detail: h("span", null, "即将删除：", h("b", null, record.title)),
					confirmLabel: "删除",
					busy: busy,
					onCancel: function () { if (!busy) setConfirm(false); },
					onConfirm: remove
				}) : null
			);
		}
		//#endregion

		//#region plugin
		var sidebarRight = null;
		var sidebarRightTabs = null;
		var sessions = null;
		var workspaces = null;
		/** 挂载时的客户端上下文：betterSidebar 是第三方服务，按需动态取，避免启动顺序问题。 */
		var clientCtx = null;

		/** vscode-mode 的 openTab 判别符（其 officialSidebar.ts 的 OFFICIAL_TAB_KIND）。 */
		var EDITOR_TAB_KIND = "edrvEditor";
		/** dsh-better-sidebar 的编辑器 Tab 类型 id（内置注册表里的 `editor`）。 */
		var BETTER_EDITOR_TAB = "editor";

		function openDetail(id, sessionId) {
			if (sidebarRight === null) {
				store.setError("右侧栏服务尚未就绪，请刷新页面后再试。");
				return;
			}
			try {
				sidebarRight.openTab("data-panel-detail", { params: { id: id, sessionId: sessionId } });
			} catch (error) {
				store.setError(error instanceof Error ? error.message : "打开右侧栏失败");
			}
		}

		/**
		 * 取 dsh-better-sidebar 的客户端服务。
		 * 它不是 DSH 核心服务，未安装时 ctx.get 可能抛错，按需探测且不缓存，
		 * 这样插件后于本插件加载也能被接上。
		 */
		function betterSidebarService() {
			if (clientCtx === null || typeof clientCtx.get !== "function") return null;
			try {
				var service = clientCtx.get("betterSidebar");
				if (!service || typeof service.openTab !== "function") return null;
				return service;
			} catch {
				return null;
			}
		}

		/**
		 * 走 better-sidebar 的编辑器打开并定位。
		 *
		 * 源码（client.js 的 openTab）里有三处会静默 return，必须逐条对上：
		 *   1. `descriptor === undefined`      → tab 类型没注册
		 *   2. `!isTabEnabled(seed.type)`      → 用户在侧栏设置里关掉了
		 *   3. `targetSessionId === undefined` → 目标会话拿不到
		 * 第 3 条最隐蔽：不传 scope 时它退回 `store.getSnapshot().sessionId`，
		 * 而该 store 的初始状态就是 `sessionId: void 0`（未绑定会话时一直是
		 * undefined），于是整次打开变成 no-op、连报错都没有。
		 * 所以这里**必须**把 sessionId 作为 scope 传进去。
		 *
		 * 另外 `target: 'side'` 会被源码里的 `const reveal = seed.reveal !== false && !side`
		 * 强制成 reveal=false —— 即"打开了但不聚焦"，用户看起来就像没反应。
		 * 因此默认走 'right'，让它聚焦并展开右侧栏。
		 */
		function openWithBetterSidebar(service, target, sessionId) {
			try {
				if (typeof service.getTab === "function" && !service.getTab(BETTER_EDITOR_TAB)) return false;
				if (typeof service.isTabEnabled === "function" && !service.isTabEnabled(BETTER_EDITOR_TAB)) return false;

				// openTab 拿不到目标会话时直接 return（no-op），连报错都没有。
				// 这里先自己判一次：scope 给的会话和它 store 里的当前会话都为空时，
				// 调用注定无效，干脆落到下一级去，而不是让按钮点了没反应。
				var scoped = typeof sessionId === "string" && sessionId !== "" ? sessionId : "";
				var active = "";
				if (typeof service.getSnapshot === "function") {
					try {
						var snapshot = service.getSnapshot();
						if (snapshot && typeof snapshot.sessionId === "string") active = snapshot.sessionId;
					} catch {
						// 快照读不到就按空处理。
					}
				}
				if (!scoped && !active) return false;

				// scope 里带上 cwd：它让相对路径能被正确解析到工作区。
				// 统一成正斜杠：否则 Windows 反斜杠要靠它内部再转一次才对齐。
				var scope = scoped !== ""
					? { sessionId: scoped, cwd: toPosixPath(sessionCwd(scoped)) || undefined }
					: undefined;

				// 相对路径交给它自己按 scope.cwd 解析；本来就是绝对路径才原样传。
				var path = isAbsoluteCodePath(toPosixPath(target.path)) ? toPosixPath(target.path) : target.path;

				service.openTab({
					type: BETTER_EDITOR_TAB,
					path: path,
					line: target.line,
					target: "right",
					reveal: true
				}, scope);
				return true;
			} catch {
				return false;
			}
		}

		/** 会话工作区目录（相对路径要拼它才能交给编辑器）。 */
		function sessionCwd(sessionId) {
			if (sessions === null || typeof sessionId !== "string" || !sessionId) return "";
			try {
				var list = sessions.list.getSnapshot();
				var row = list && list.byId ? list.byId[sessionId] : null;
				return row && typeof row.cwd === "string" ? row.cwd : "";
			} catch {
				return "";
			}
		}

		/** 相对路径补上工作区目录；拿不到工作区时返回空串。 */
		function absoluteCodePath(path, sessionId) {
			var posix = toPosixPath(path);
			if (isAbsoluteCodePath(posix)) return posix;
			var cwd = toPosixPath(sessionCwd(sessionId));
			if (!cwd) return "";
			return cwd + "/" + posix.replace(/^(?:\.\/)+/, "").replace(/^\/+/, "");
		}

		/** 一段路径按官方 file 资源语法编码（盘符冒号保持字面）。 */
		function encodeAddressSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}

		/** `dsh-resource://file/…` 地址：绝对路径走 absolute 域，相对路径走 session 域。 */
		function codeFileAddress(path, sessionId) {
			var posix = toPosixPath(path);
			if (isAbsoluteCodePath(posix)) {
				return "dsh-resource://file/absolute/"
					+ posix.replace(/^\/+/, "").split("/").map(encodeAddressSegment).join("/");
			}
			var relative = posix.replace(/^(?:\.\/)+/, "").replace(/^\/+/, "");
			return "dsh-resource://file/session/" + encodeURIComponent(String(sessionId))
				+ "/" + relative.split("/").map(encodeAddressSegment).join("/");
		}

		/**
		 * 侧栏是否具备打开文件的能力。
		 *
		 * 只探测 `register` / `openTab` 这类**一定有**的方法：
		 * vscode-mode 自己的 `detectOfficial` 也是这么判的，它从不调
		 * `sidebarRightTabs.get()` —— 官方注册表不一定提供按 id 查询，
		 * 拿不存在的 `get` 去预检会让整层降级被静默跳过。
		 * 真实可用性交给调用处的 try/catch：openTab 抛错就落到下一级。
		 */
		function hasEditorTab() {
			return sidebarRight !== null
				&& typeof sidebarRight.openTab === "function"
				&& sidebarRightTabs !== null
				&& typeof sidebarRightTabs.register === "function";
		}

		/**
		 * 打开用例覆盖的被测源码并定位到行。
		 *
		 * 四级降级，逐级丢失一点精度而不是直接失败：
		 *   ① dsh-better-sidebar 编辑器 —— 定位到行，可编辑，能落到并排的第二栏
		 *   ② dsh-vscode-mode 编辑器 —— 定位到行/列，可编辑
		 *   ③ 官方 file 资源预览 —— 只读，但能把行号交给查看器
		 *   ④ 系统默认程序 openPath —— 只能打开文件，丢失行号
		 * @param ref 记录里的 codeRef（`path:line` 等形态）
		 * @param sessionId 记录所属会话，用于解析相对路径
		 * @returns 是否成功发起了一次打开
		 */
		function openCode(ref, sessionId) {
			var target = parseCodeRef(ref);
			if (target === null) {
				store.setError("这条用例还没有填代码位置。编辑用例，在「被测源码」里填 src/…:行号。");
				return false;
			}
			var absolute = absoluteCodePath(target.path, sessionId);

			// ① better-sidebar：优先用它，团队以它为主编辑器。
			var better = betterSidebarService();
			if (better !== null && openWithBetterSidebar(better, target, sessionId)) return true;

			if (sidebarRight === null) {
				store.setError("右侧栏服务尚未就绪，请刷新页面后再试。");
				return false;
			}

			// ② vscode-mode。
			if (hasEditorTab()) {
				try {
					sidebarRight.openTab(EDITOR_TAB_KIND, {
						params: { openPath: absolute || target.path, line: target.line, column: target.column }
					});
					return true;
				} catch (error) {
					// 落到下一级，不把用户的点击变成纯报错。
				}
			}

			// ③ 官方 file 资源预览。
			if (typeof sidebarRight.openResource === "function") {
				try {
					sidebarRight.openResource(codeFileAddress(target.path, sessionId), {
						params: { line: target.line }
					});
					return true;
				} catch (error) {
					// 同上。
				}
			}

			// ④ 系统默认程序。
			if (workspaces !== null && typeof workspaces.openPath === "function" && absolute) {
				try {
					workspaces.openPath(absolute);
					store.setError("已用系统默认程序打开，但没能定位到第 " + target.line + " 行。");
					return true;
				} catch (error) {
					// 落到最终提示。
				}
			}

			store.setError("找不到可用的代码打开方式：请确认已启用右侧边栏（dsh-better-sidebar）或 VS Code 工作台（dsh-vscode-mode），或代码位于当前会话工作区内。");
			return false;
		}

		var inject = ["slots"];

		function apply(ctx) {
			ensureStyles();

			// betterSidebar 是第三方服务（dsh-better-sidebar 注册），按需用 ctx.get 取，
			// 故这里只保留上下文引用，不写进 inject——未装该插件时 inject 会一直停等。
			clientCtx = ctx;
			ctx.effect(function () {
				return function () {
					clientCtx = null;
				};
			}, "dsh-data-panel: client context");

			ctx.inject(["sidebarRight"], function (sub) {
				sidebarRight = sub.sidebarRight;
				sub.effect(function () {
					return function () {
						sidebarRight = null;
					};
				}, "dsh-data-panel: sidebar right service");
			});

			ctx.inject(["sidebarRightTabs"], function (sub) {
				sidebarRightTabs = sub.sidebarRightTabs;
				sub.effect(function () {
					return function () {
						sidebarRightTabs = null;
					};
				}, "dsh-data-panel: sidebar right tabs service");
				sub.effect(function () {
					return sub.sidebarRightTabs.register({
						id: "data-panel-detail",
						kind: "data-panel-detail",
						title: function () { return "用例详情"; },
						keepMounted: true
					});
				}, "dsh-data-panel: detail tab type");
			});

			// 相对路径要用会话工作区补全，跳转才能落到仓库里的真实文件。
			ctx.inject(["sessions"], function (sub) {
				sessions = sub.sessions;
				sub.effect(function () {
					return function () {
						sessions = null;
					};
				}, "dsh-data-panel: sessions service");
			});

			ctx.inject(["workspaces"], function (sub) {
				workspaces = sub.workspaces;
				sub.effect(function () {
					return function () {
						workspaces = null;
					};
				}, "dsh-data-panel: workspaces service");
			});

			ctx.slots.inject("conversation.view", function () {
				return ctx.slots.register({
					name: "conversation.view",
					id: "data-panel",
					order: 30,
					label: function () { return "面板"; },
					inject: function (sessionId) {
						return {
							openDetail: function (id) { openDetail(id, sessionId); },
							openCode: function (ref) { openCode(ref, sessionId); }
						};
					}
				}, DataPanelView);
			});

			ctx.slots.inject("sidebar.right.pane.tab", function () {
				return ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: "data-panel-detail",
					inject: function () {
						return { store: store, openCode: openCode };
					}
				}, DetailBody);
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.__test = {
			store: store,
			parseCodeRef: parseCodeRef,
			openCode: openCode,
			/** Test-only: 注入打开代码所需的服务替身（生产路径由 ctx.inject 填充）。 */
			setCodeServices: function (next) {
				var source = next || {};
				sidebarRight = source.sidebarRight === undefined ? null : source.sidebarRight;
				sidebarRightTabs = source.sidebarRightTabs === undefined ? null : source.sidebarRightTabs;
				sessions = source.sessions === undefined ? null : source.sessions;
				workspaces = source.workspaces === undefined ? null : source.workspaces;
				// betterSidebar 走 ctx.get 动态取，替身挂在假上下文上。
				clientCtx = source.betterSidebar === undefined ? null : {
					get: function (name) {
						return name === "betterSidebar" ? source.betterSidebar : undefined;
					}
				};
			},
			DataPanelView: DataPanelView,
			DetailView: DetailView,
			DetailBody: DetailBody,
			RecordFormModal: RecordFormModal,
			CodeModal: CodeModal,
			Pager: Pager
		};
		return module.exports;
	}
});
