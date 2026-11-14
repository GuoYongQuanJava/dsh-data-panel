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
/* 主区 tab 行末尾的「面板」按钮：贴着「工作流」右边，视觉上像 tab 但不是 tab。 */
.dp-tab-btn {
	flex: 0 0 auto;
	align-self: flex-start;
	display: inline-flex;
	align-items: center;
	height: 26px;
	margin-top: -5px;
	margin-left: 6px;
	padding: 0 10px;
	border: 1px solid transparent;
	border-radius: 7px;
	background: transparent;
	color: var(--dsw-alias-label-secondary, #646a73);
	font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
	font-size: 13px;
	line-height: 16px;
	white-space: nowrap;
	cursor: pointer;
	transition: background .14s, color .14s, border-color .14s;
}
.dp-tab-btn:hover {
	background: var(--dsw-alias-bg-layer-3, #f2f3f5);
	color: var(--dsw-alias-label-primary, #1f2329);
}
.dp-tab-btn:active { background: var(--dsw-alias-bg-layer-4, #e9eaee); }
.dp-tab-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 1px; }

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
/* 右侧栏里的面板：容器窄，收紧留白并让工具栏折行，表格靠 .dp-card-scroll 横向滚动。 */
.dp-root.dp-docked .dp-shell { max-width: none; padding: 14px 12px 28px; }
.dp-root.dp-docked .dp-header { gap: 12px; }
.dp-root.dp-docked .dp-title { font-size: 18px; margin: 4px 0 3px; }
.dp-root.dp-docked .dp-subtitle { font-size: 12px; }
.dp-root.dp-docked .dp-toolbar { margin: 14px 0 10px; gap: 6px; }
.dp-root.dp-docked .dp-search { flex: 1 1 150px; max-width: 360px; }
.dp-root.dp-docked .dp-btn { height: 32px; padding: 0 10px; font-size: 12px; }
.dp-root.dp-docked .dp-stat { min-width: 62px; padding: 8px 10px; }
.dp-root.dp-docked .dp-stat b { font-size: 17px; }
.dp-root.dp-docked .dp-card-foot { padding: 8px 10px; }
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
.dp-run-result { margin: 0 0 12px; padding: 9px 12px; border: 1px solid var(--dp-border); border-radius: 10px; color: var(--dp-text); font-size: 12px; white-space: pre-wrap; }
.dp-alert button { margin-left: auto; padding: 0; border: 0; background: none; color: inherit; font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
/* 上拉菜单要能溢出卡片，所以这里不用 overflow:hidden；圆角靠内层各自裁。 */
.dp-card { position: relative; border: 1px solid var(--dp-border); border-radius: 14px; background: var(--dp-bg); }
.dp-card-scroll { overflow-x: auto; overflow-y: hidden; }
.dp-table { width: 100%; min-width: 720px; border-collapse: collapse; table-layout: fixed; }
.dp-table th { padding: 11px 12px; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-align: center; white-space: nowrap; }
/* 表头统一居中：即使某列表头带了 dp-right，也按居中显示。 */
.dp-table th.dp-right { text-align: center; }
.dp-table td { padding: 12px; border-bottom: 1px solid var(--dp-border2); vertical-align: middle; letter-spacing: .02em; }
.dp-table tbody tr:last-child td { border-bottom: 0; }
.dp-row { transition: background .12s; }
.dp-row:hover { background: var(--dp-bg2); }
.dp-title-cell { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
/* 「示例」标签在两行标题里要贴第一行走。 */
.dp-title-cell .dp-demo-tag { flex: 0 0 auto; margin-top: 1px; }
.dp-title-link { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; padding: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-weight: 550; text-align: left; cursor: pointer; }
.dp-title-link:hover { color: var(--dp-brand); }
.dp-title-link:hover .dp-title-text { text-decoration: underline; text-underline-offset: 3px; }
.dp-title-text { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; word-break: break-word; }
.dp-demo-tag { flex: 0 0 auto; padding: 0 6px; border: 1px solid color-mix(in srgb, var(--dp-warning) 36%, transparent); border-radius: 5px; color: var(--dp-warning); font-size: 10px; line-height: 16px; }
.dp-ext { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; color: var(--dp-text3); }
.dp-ext:hover { background: var(--dp-bg3); color: var(--dp-brand); }
.dp-pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px; background: var(--dp-bg3); color: var(--dp-text2); font-size: 12px; font-weight: 500; line-height: 18px; white-space: nowrap; }
.dp-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: currentColor; }
.dp-pill[data-tone="doing"] { background: color-mix(in srgb, var(--dp-brand) 10%, transparent); color: var(--dp-brand); }
.dp-pill[data-tone="done"] { background: color-mix(in srgb, var(--dp-success) 10%, transparent); color: var(--dp-success); }
.dp-pill[data-tone="blocked"] { background: color-mix(in srgb, var(--dp-danger) 10%, transparent); color: var(--dp-danger); }
.dp-chip { display: inline-block; max-width: 100%; overflow: hidden; padding: 1px 8px; border: 1px solid var(--dp-border); border-radius: 6px; color: var(--dp-text2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
/* 用例标识是无空格长串，2 行截断靠 break-all 才断得开。 */
.dp-case-id { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; color: var(--dp-text2); font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 12px; line-height: 1.45; word-break: break-all; }
.dp-cell-text { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0; color: var(--dp-text2); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
/* 要 3 行的列（测试说明 / 输入 / 预期输出）加这个类。 */
.dp-cell-text.dp-cell-3 { -webkit-line-clamp: 3; }
/*
 * 行首展开箭头：收起朝右，展开转 90 度朝下。
 * 尺寸比一行文字（12px × 1.45 ≈ 17.4px）大一些，所以用负 margin-top 把按钮中心
 * 抬到首行文字的中线上 —— 表格单元格是 flex-start 顶对齐，不补偿的话箭头会偏下。
 * 只对齐首行：用例标识最多两行，箭头跟着第一行走，不随整块居中。
 */
.dp-expand-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 26px; height: 26px; margin-top: -5px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s, transform .14s; }
.dp-expand-btn:hover { background: var(--dp-bg3); color: var(--dp-text); }
.dp-expand-btn[data-open="true"] { color: var(--dp-text); transform: rotate(90deg); }
.dp-expand-btn:focus-visible { outline: 2px solid var(--dp-brand); outline-offset: 1px; }
/* 展开出来的执行记录单元格。 */
.dp-run-cell { padding: 0; background: var(--dp-bg2); }
.dp-run-panel { padding: 10px 12px 12px; }
.dp-run-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: var(--dp-text2); font-size: 12px; }
.dp-run-title b { margin-left: 6px; color: var(--dp-text); font-weight: 600; }
.dp-run-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dp-run-table th { padding: 5px 8px; border-bottom: 1px solid var(--dp-border); color: var(--dp-text3); font-weight: 500; text-align: center; white-space: nowrap; }
.dp-run-table td { padding: 5px 8px; border-bottom: 1px solid var(--dp-border2); color: var(--dp-text2); vertical-align: middle; }
.dp-run-table tr:last-child td { border-bottom: 0; }
.dp-run-ops { display: flex; justify-content: flex-end; gap: 2px; }
.dp-run-output pre { margin: 0; max-height: 72px; overflow: auto; white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 11px; line-height: 1.5; color: var(--dp-text2); }
.dp-run-state { display: inline-block; padding: 0 7px; border-radius: 5px; font-size: 11px; line-height: 18px; }
.dp-run-state[data-tone="ok"] { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.dp-run-state[data-tone="bad"] { background: color-mix(in srgb, var(--dp-danger) 12%, transparent); color: var(--dp-danger); }
.dp-run-state[data-tone="idle"] { background: var(--dp-bg3); color: var(--dp-text3); }
.dp-run-empty { padding: 14px 10px; color: var(--dp-text3); font-size: 12px; text-align: center; }
.dp-run-hint { margin: 8px 0 0; color: var(--dp-text3); font-size: 11px; }
/* 「查看」弹窗要更宽：报告是长文本 + 表格。 */
.dp-modal.dp-modal-wide { width: min(1080px, 92vw); max-width: none; height: 80vh; display: flex; flex-direction: column; }
.dp-modal.dp-modal-wide .dp-modal-body { flex: 1 1 auto; overflow: auto; }
/* ── 用例层级：左栏 + 右侧内容 ── */
.dp-board { display: flex; align-items: flex-start; gap: 12px; margin-top: 4px; }
.dp-sidebar { flex: 0 0 auto; width: 128px; max-height: 62vh; overflow: auto; padding: 8px 6px; border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); transition: width .16s ease, padding .16s ease; }
.dp-main { flex: 1 1 auto; min-width: 0; }
.dp-sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }
.dp-sidebar-title { color: var(--dp-text3); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.dp-sidebar-tools { display: flex; align-items: center; gap: 2px; }
/* 「默认」是分组标题：纯文字，不是按钮，也不响应 hover。 */
/* 「默认」：外观是分组标题，但整行可点（点它 = 看全部用例）。 */
.dp-cat-group { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; width: 100%; margin: 0 0 2px; padding: 6px 8px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text3); font: inherit; font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; text-align: left; cursor: pointer; transition: background .12s, color .12s; }
.dp-cat-group:hover { background: var(--dp-bg2); color: var(--dp-text2); }
.dp-cat-group.is-active { color: var(--dp-text); }
.dp-cat-group-count { font-variant-numeric: tabular-nums; font-weight: 500; }
/* 底部操作条里的引导文案。 */
.dp-pick-count { color: var(--dp-text); font-size: 12.5px; font-weight: 500; }
.dp-pick-count b { color: var(--dp-brand); font-weight: 700; }
.dp-pick-hint { color: var(--dp-text3); font-size: 11.5px; }
.dp-cat { display: flex; align-items: center; gap: 2px; margin-bottom: 1px; border-radius: 7px; transition: background .12s; }
.dp-cat:hover { background: var(--dp-bg2); }
.dp-cat.is-active { background: color-mix(in srgb, var(--dp-brand) 9%, transparent); }
.dp-cat-main { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.dp-cat.is-active .dp-cat-main { color: var(--dp-brand); font-weight: 600; }
.dp-cat-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-cat-count { flex: 0 0 auto; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; }
.dp-cat.is-active .dp-cat-count { color: var(--dp-brand); }
.dp-cat-ops { display: none; flex: 0 0 auto; gap: 1px; padding-right: 2px; }
.dp-cat:hover .dp-cat-ops { display: flex; }
.dp-cat-ops.is-visible { display: flex; }
.dp-cat-ops .dp-icon-btn { width: 20px; height: 20px; }
/* 「放入」用品牌色，和改名/删除区分开。 */
.dp-cat-ops .dp-cat-drop { color: var(--dp-brand); }
.dp-cat-ops .dp-cat-drop:hover { background: color-mix(in srgb, var(--dp-brand) 16%, transparent); color: var(--dp-brand); }
.dp-cat-flip { transform: rotate(180deg); }
/* 表格勾选列 */
.dp-pick { width: 30px; padding: 0 4px 0 0; text-align: center; }
.dp-pick input { width: 14px; height: 14px; margin: 0; accent-color: var(--dp-brand); cursor: pointer; vertical-align: middle; }
/* 勾选后浮在表格下方的提示条（不占表格上方空间）。 */
.dp-pick-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 10px 0 0; padding: 8px 10px; border: 1px solid color-mix(in srgb, var(--dp-brand) 30%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--dp-brand) 6%, transparent); color: var(--dp-text); font-size: 12.5px; }
.dp-pick-bar b { font-weight: 600; }
/* 「添加至层级」：贴在底栏，菜单向上展开，不挡住表格行。 */
.dp-picker { position: relative; display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.dp-picker-toggle { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--dp-border); border-radius: 8px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 12px; cursor: pointer; transition: background .12s, border-color .12s; }
.dp-picker-toggle:hover { background: var(--dp-bg2); }
.dp-picker-toggle.is-open { border-color: var(--dp-brand); color: var(--dp-brand); }
.dp-picker-caret { display: inline-flex; transform: rotate(180deg); transition: transform .14s; }
.dp-picker-toggle.is-open .dp-picker-caret { transform: rotate(0deg); }
/* 菜单向上弹出：bottom 定在按钮上沿之上。 */
.dp-picker-menu { position: absolute; bottom: calc(100% + 6px); right: 0; z-index: 20; display: flex; flex-direction: column; min-width: 180px; max-height: 240px; overflow-y: auto; padding: 4px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); box-shadow: 0 8px 24px rgba(15, 18, 24, .18); }
.dp-picker-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.dp-picker-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.dp-picker-item.is-active { background: color-mix(in srgb, var(--dp-brand) 10%, transparent); color: var(--dp-brand); font-weight: 600; }
.dp-picker-item-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-picker-item-count { flex: 0 0 auto; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; }
.dp-picker-item.is-active .dp-picker-item-count { color: var(--dp-brand); }
.dp-picker-empty { margin: 0; padding: 10px; color: var(--dp-text3); font-size: 12px; line-height: 1.5; }
.dp-picker-foot { display: flex; align-items: center; }
/* 右侧栏本来就窄：左栏再收一档，宽度尽量留给表格。 */
.dp-root.dp-docked .dp-board { gap: 8px; }
.dp-root.dp-docked .dp-sidebar { width: 112px; padding: 6px 4px; }
.dp-root.dp-docked .dp-cat-main { padding: 5px 6px; font-size: 12px; }
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
/*
 * 工具栏里的类型筛选：表单里的 .dp-select 是 width:100%（弹窗要撑满），
 * 但工具栏是横向排布，撑满会把整个筛选器挤成独占一行。这里只收敛工具栏内的。
 */
.dp-toolbar .dp-select { width: auto; }
/*
 * 工具栏尾部三个强调按钮：全部执行（绿）/ 报告（蓝）/ 日志（橙）。
 * 容器整体靠右：margin-left:auto 吃掉左侧剩余空间。
 * 单独给按钮加 auto 的话，flex-wrap 换行后位置会飘，所以包一层。
 *
 * 这里不能再给固定宽度（曾经是 docked 下无条件 flex:1 1 100%），
 * 那样不管容器多宽都会把按钮组逼到下一行，和左边「刷新 / 新增用例」错位。
 * 现在恢复成「宽度由内容决定」：容器宽时与左控件同排靠右，
 * 真放不下时 flex-wrap 才让它整体折到下一行（仍靠右）。
 */
.dp-toolbar-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex: 0 0 auto; }
/*
 * 尺寸只在这里定义一次，三色共用，避免各自写一套导致高度不一致。
 */
.dp-run-all-btn,
.dp-report-btn,
.dp-log-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 32px;
	padding: 0 12px;
	border: 1px solid transparent;
	border-radius: 10px;
	font: inherit;
	font-size: 12.5px;
	font-weight: 600;
	line-height: 1;
	white-space: nowrap;
	cursor: pointer;
	color: #F9FAFB;
	transition: background .15s, border-color .15s, filter .15s;
}
.dp-run-all-btn:disabled,
.dp-report-btn:disabled,
.dp-log-btn:disabled { opacity: .55; cursor: not-allowed; }
/* 全部执行：绿色 */
.dp-run-all-btn { background: #16A34A; border-color: #16A34A; }
.dp-run-all-btn:hover:not(:disabled) { background: #22C55E; border-color: #22C55E; }
.dp-run-all-btn:active:not(:disabled) { background: #15803D; border-color: #15803D; }
.dp-run-all-btn:focus-visible { outline: 2px solid #16A34A; outline-offset: 2px; }
/* 报告：蓝色 */
.dp-report-btn { background: #2563EB; border-color: #2563EB; }
.dp-report-btn:hover:not(:disabled) { background: #3B82F6; border-color: #3B82F6; }
.dp-report-btn:active:not(:disabled) { background: #1D4ED8; border-color: #1D4ED8; }
.dp-report-btn:focus-visible { outline: 2px solid #2563EB; outline-offset: 2px; }
/* 日志：橙色 */
.dp-log-btn { background: #FF8800; border-color: #FF8800; }
.dp-log-btn:hover:not(:disabled) { background: #FF9A26; border-color: #FF9A26; }
.dp-log-btn:active:not(:disabled) { background: #E67A00; border-color: #E67A00; }
.dp-log-btn:focus-visible { outline: 2px solid #FF8800; outline-offset: 2px; }
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
.dp-log-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 150px; border: 1px dashed var(--dp-border); border-radius: 10px; color: var(--dp-text3); font-size: 12.5px; text-align: center; }
.dp-log-empty p { margin: 0; }
.dp-log-empty-icon { display: flex; align-items: center; justify-content: center; color: var(--dp-text3); }
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
			var existing = document.getElementById("dsh-data-panel-style");
			if (existing !== null) {
				// 面板 tab 是 keepMounted 的，旧 <style> 会一直挂在 head 里。
				// 只看「有没有」就 return 的话，插件热更新后是「新 JS + 旧 CSS」，
				// 新加的类名永远不生效（表现为按钮有了但样式没跟上）。所以这里同步一次内容。
				if (existing.textContent !== CSS) existing.textContent = CSS;
				return;
			}
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
				// 展开/收起箭头：收起朝右，展开转 90 度朝下。
				case "chevron":
					children = [h("path", { key: "a", d: "m9 6 6 6-6 6" })];
					break;
				// 移出（减号）。
				case "minus":
					children = [h("path", { key: "a", d: "M5 12h14" })];
					break;
				// 层级（信封式文件夹）。
				case "folder":
					children = [
						h("path", { key: "a", d: "M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" })
					];
					break;
				// 选中标记。
				case "check":
					children = [h("path", { key: "a", d: "m4 12 5 5L20 6" })];
					break;
				// 查看执行报告。
				case "eye":
					children = [
						h("path", { key: "a", d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" }),
						h("circle", { key: "b", cx: 12, cy: 12, r: 2.6 })
					];
					break;
				case "doc":
					children = [h("path", { key: "a", d: "M6 3h8l4 4v14H6z" }), h("path", { key: "b", d: "M14 3v5h5" }), h("path", { key: "c", d: "M9 13h6M9 17h4" })];
					break;
				// 执行日志：一本合起来的书（书脊 + 封面 + 两条内容线），
				// 线宽与颜色沿用 common，和 doc/link 等图标同一套视觉。
				case "log":
					children = [
						h("path", { key: "a", d: "M5 4h3v16H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" }),
						h("path", { key: "b", d: "M8 4h11v16H8z" }),
						h("path", { key: "c", d: "M11 9h5M11 13h5" })
					];
					break;
				case "link":
					children = [h("path", { key: "a", d: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" }), h("path", { key: "b", d: "M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" })];
					break;
				case "warning":
					children = [
						h("path", { key: "a", d: "M12 4 2.5 20h19z" }),
						h("path", { key: "b", d: "M12 10v4" }),
						h("path", { key: "c", d: "M12 17h.01" })
					];
					break;
				default:
					children = [h("circle", { key: "c", cx: 12, cy: 12, r: 8 })];
			}
			return h("svg", common, children);
		}
		//#endregion

		//#region store
		function createStore() {
			var getSessionId = function () { return ""; };
			var snapshot = { status: "idle", records: [], demoCount: 0, categories: [], error: "" };
			var loadGeneration = 0;
			// 写次数**按会话**记：A 在加载时 B 详情页写入，不能把 A 的 GET 误判成过期。
			var writeCounts = Object.create(null);
			function writeCountOf(sid) { return writeCounts[sid] || 0; }
			// 本次读取因“期间发生过写入”被丢弃时，置位并在 finally 里补一次重载。
			var staleReloadPending = false;
			var lastSessionId = "";
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

			/** 层级清单：宿主 GET 带 categories，写入路径没带就地从 records 重算。 */
			function categoriesOf(records, fromServer) {
				var seen = Object.create(null);
				(Array.isArray(fromServer) ? fromServer : []).forEach(function (name) {
					if (typeof name === "string" && name.trim() !== "") seen[name.trim()] = true;
				});
				records.forEach(function (record) {
					var name = record && typeof record.category === "string" ? record.category.trim() : "";
					if (name !== "") seen[name] = true;
				});
				return Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); });
			}

			function commit(records, serverCategories) {
				var next = sortRecords(records);
				publish({
					status: "ready",
					records: next,
					demoCount: next.filter(function (record) { return record.demo === true; }).length,
					categories: categoriesOf(next, serverCategories),
					error: ""
				});
			}

			/**
			 * 一个 API 请求。
			 *
			 * @param body 省略 = GET；否则 POST。
			 * @param forcedSessionId 指定会话（详情页可能属于别的会话，不能依赖“当前”）。
			 */
			function request(body, forcedSessionId) {
				var sid = typeof forcedSessionId === "string" && forcedSessionId !== ""
					? forcedSessionId
					: (typeof getSessionId === "function" ? getSessionId() : "");
				if (body === undefined) {
					var url = "/data-panel/api";
					if (sid) url += "?sessionId=" + encodeURIComponent(sid);
					var init = { method: "GET", headers: { accept: "application/json" } };
					return fetch(url, init).then(function (response) {
						return response.json().catch(function () { return {}; }).then(function (data) {
							if (!response.ok || data.ok === false) {
								throw new Error(data && data.error ? data.error : "请求失败（HTTP " + response.status + "）");
							}
							return data;
						});
					});
				}
				var postBody = Object.assign({}, body, { sessionId: sid });
				var init = {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(postBody)
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

			/**
			 * 写请求（新建 / 编辑 / 删除 / 清空示例）。
			 *
			 * 请求发出时就固定它属于哪个会话；响应回来时如果用户已经切到别的会话，
			 * 就**不碰**当前快照 —— 否则 A 会话的写结果会被画到 B 会话的列表上。
			 * 服务端写的本来就是 A 的文件，这里只负责不污染界面。
			 *
			 * @param body 请求体。
			 * @param apply 只在本会话仍为当前会话时执行的快照更新。
			 * @param forcedSessionId 指定会话（详情页用），默认取当前会话。
			 */
			function mutate(body, apply, forcedSessionId) {
				var sid = typeof forcedSessionId === "string" && forcedSessionId !== ""
					? forcedSessionId
					: (typeof getSessionId === "function" ? getSessionId() : "");
				if (sid === "") {
					return Promise.reject(new Error("还没有取得当前会话，稍后再试"));
				}
				return request(body, sid).then(function (data) {
					// 写成功了：只递增“这个会话”的写计数，让它的在途 GET 知道自己过期。
					writeCounts[sid] = writeCountOf(sid) + 1;
					if (sid === lastSessionId) apply(data);
					return data;
				});
			}

			/**
			 * 加载当前会话的记录。
			 *
			 * 三件事：会话变了就清空并重拉；会话未就绪就不请求；读取期间本会话发生过
			 * 写入就把结果丢掉并补一次重载（否则界面会停在 loading）。
			 *
			 * 写成具名函数是因为 `finally` 里要重新调它 —— 不能引用对象字面量里的键。
			 */
			function loadSession(force) {
				var currentSid = typeof getSessionId === "function" ? getSessionId() : "";
				// 会话还没就绪：不发请求，也不保留上一个会话的数据。
				if (currentSid === "") {
					if (lastSessionId !== "" || snapshot.status !== "waiting-session") {
						lastSessionId = "";
						loadGeneration += 1;
						inflight = null;
						publish({ status: "waiting-session", records: [], demoCount: 0, error: "" });
					}
					return Promise.resolve(snapshot);
				}
				var sessionChanged = currentSid !== lastSessionId;
				if (sessionChanged) {
					lastSessionId = currentSid;
					// 切会话：先把 epoch 推上去，让旧会话的在途请求即使回来也被丢弃。
					loadGeneration += 1;
					inflight = null;
					publish({ status: "idle", records: [], demoCount: 0, error: "" });
					force = true;
				}
				if (!force && snapshot.status === "ready") return Promise.resolve(snapshot);
				if (inflight !== null) return inflight;
				publish({ status: snapshot.status === "ready" ? "refreshing" : "loading", error: "" });
				var gen = loadGeneration;
				var loadSid = currentSid;
				// 记住“本会话”当时已完成多少次写入：刷新期间如果发生写入，
				// 这份 GET 的结果就已经旧了（它可能拿到写之前的数据）。
				var writesAtStart = writeCountOf(loadSid);
				inflight = request()
					.then(function (data) {
						if (gen !== loadGeneration) return; // 会话已切，丢弃
						if (writesAtStart !== writeCountOf(loadSid)) {
							// 本会话在读取期间写了数据：结果已旧，丢弃并标记补拉。
							staleReloadPending = true;
							return;
						}
						commit(data.records || [], data.categories);
						return snapshot;
					})
					.catch(function (error) {
						if (gen !== loadGeneration) return; // stale error, discard
						publish({ status: snapshot.status === "refreshing" ? "ready" : "error", error: error.message });
						throw error;
					})
					.finally(function () {
						if (gen !== loadGeneration) return; // stale, don't touch inflight
						inflight = null;
						if (staleReloadPending) {
							staleReloadPending = false;
							// 异步再拉一次：不在 finally 里同步递归，避免重入。
							setTimeout(function () { loadSession(true).catch(function () {}); }, 0);
						}
					});
				return inflight;
			}

			return {
				setSessionId: function (fn) {
					if (typeof fn === "function") getSessionId = fn;
				},
				/** 当前快照对应的会话（尚未加载过时为 ""）。订阅回调据此判断要不要重载。 */
				loadedSessionId: function () {
					return lastSessionId;
				},
				/** 拉某个会话的记录（详情页属于别的会话时用它，不碰当前快照）。 */
				fetchRecords: function (sessionId) {
					return request(undefined, sessionId).then(function (data) {
						return data.records || [];
					});
				},
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
				load: loadSession,
				/** @param forcedSessionId 详情页传它自己的会话，避免写到当前会话。 */
				create: function (record, forcedSessionId) {
					return mutate({ op: "create", record: record }, function (data) {
						commit(snapshot.records.concat([data.record]));
					}, forcedSessionId).then(function (data) {
						return data.record;
					});
				},
				update: function (id, patch, forcedSessionId) {
					return mutate({ op: "update", id: id, patch: patch }, function (data) {
						commit(snapshot.records.map(function (record) {
							return record.id === id ? data.record : record;
						}));
					}, forcedSessionId).then(function (data) {
						return data.record;
					});
				},
				remove: function (id, forcedSessionId) {
					return mutate({ op: "delete", id: id }, function () {
						commit(snapshot.records.filter(function (record) { return record.id !== id; }));
					}, forcedSessionId);
				},
				clearDemo: function (forcedSessionId) {
					return mutate({ op: "clearDemo" }, function () {
						commit(snapshot.records.filter(function (record) { return record.demo !== true; }));
					}, forcedSessionId);
				},
				/** 先建层级（不要求先有勾选）；建完再挑用例放进去。 */
				createCategory: function (category, forcedSessionId) {
					return mutate({ op: "createCategory", category: category }, function (data) {
						// 服务端已落盘，本地把新层级并进清单即可（records 不变）。
						var name = data && typeof data.category === "string" ? data.category : category;
						var list = Array.isArray(snapshot.categories) ? snapshot.categories.slice() : [];
						if (list.indexOf(name) === -1) list.push(name);
						list.sort(function (a, b) { return a.localeCompare(b, "zh-CN"); });
						commit(snapshot.records, list);
					}, forcedSessionId);
				},

				assignCategory: function (ids, category, forcedSessionId) {
					return mutate({ op: "assignCategory", ids: ids, category: category }, function () {
						var wanted = Object.create(null);
						(ids || []).forEach(function (id) { wanted[id] = true; });
						var next = typeof category === "string" ? category.trim() : "";
						commit(snapshot.records.map(function (record) {
							return wanted[record.id] ? Object.assign({}, record, { category: next }) : record;
						}));
					}, forcedSessionId);
				},
				renameCategory: function (from, to, forcedSessionId) {
					return mutate({ op: "renameCategory", from: from, to: to }, function () {
						commit(snapshot.records.map(function (record) {
							return record.category === from ? Object.assign({}, record, { category: to }) : record;
						}));
					}, forcedSessionId);
				},
				deleteCategory: function (category, forcedSessionId) {
					return mutate({ op: "deleteCategory", category: category }, function () {
						commit(snapshot.records.map(function (record) {
							return record.category === category ? Object.assign({}, record, { category: "" }) : record;
						}));
					}, forcedSessionId);
				}
			};
		}

		var store = createStore();

		/** 调一个 /data-panel/* 的 JSON 接口（统一错误处理）。 */
		function callApi(path, init) {
			// 本地宿主正常都是毫秒级；加超时避免某次请求挂住，界面一直停在“正在查找…”。
			var controller = typeof AbortController === "function" ? new AbortController() : null;
			var timer = controller !== null ? setTimeout(function () { controller.abort(); }, 8000) : null;
			var options = init || {};
			if (controller !== null) options = Object.assign({}, options, { signal: controller.signal });
			function clearTimer() {
				if (timer !== null) { clearTimeout(timer); timer = null; }
			}
			return fetch(path, options).then(function (response) {
				return response.json().catch(function () { return {}; }).then(function (data) {
					if (!response.ok || data.ok === false) {
						throw new Error(data && data.error ? data.error : "请求失败（HTTP " + response.status + "）");
					}
					return data;
				});
			}).catch(function (error) {
				if (error && error.name === "AbortError") throw new Error("请求超时（8 秒），请稍后重试");
				throw error;
			}).finally(clearTimer);
		}

		/** 某会话的项目目录（会话资产就在它下面）。 */
		function cwdOf(sessionId) {
			var cwd = sessionCwd(sessionId);
			return typeof cwd === "string" ? cwd : "";
		}

		/**
		 * 请宿主准备一次执行：导出用例、铺好 runner、分配 runId，返回可直接运行的命令。
		 *
		 * 面板不再让模型自己跑测试再回传日志 —— 那样漏调/超时/超长都会丢。
		 * 现在模型只负责执行返回的命令，输出由 runner 边跑边写进 run.log。
		 */
		function prepareRun(sessionId, scope, caseId) {
			if (typeof sessionId !== "string" || sessionId === "") {
				return Promise.reject(new Error("还没有取得当前会话"));
			}
			var cwd = cwdOf(sessionId);
			if (cwd === "") {
				return Promise.reject(new Error("无法确定当前会话的项目目录"));
			}
			// cwd 只作为兜底：宿主会用会话自身的项目目录，并校验它确实存在。
			var body = { sessionId: sessionId, cwd: cwd, scope: scope };
			if (scope === "case") body.caseId = caseId || "";
			return callApi("/data-panel/run/prepare", {
				method: "POST",
				headers: { "content-type": "application/json", accept: "application/json" },
				body: JSON.stringify(body),
			});
		}

		/** 该会话/该用例最近一次执行（exists=false 表示还没跑过）。 */
		function fetchLatestRun(sessionId, scope, caseId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("scope", scope);
			if (scope === "case") params.set("caseId", caseId || "");
			return callApi("/data-panel/run/latest?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 某条用例（或问题整批）的历史执行列表，最新在前。 */
		function fetchRunList(sessionId, scope, caseId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("scope", scope);
			if (scope === "case") params.set("caseId", caseId || "");
			return callApi("/data-panel/run/list?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 删除某次执行记录（只删 runs/<runId>/，不动用例）。 */
		function deleteRun(sessionId, runId) {
			return callApi("/data-panel/run/delete", {
				method: "POST",
				headers: { "content-type": "application/json", accept: "application/json" },
				body: JSON.stringify({ sessionId: sessionId, cwd: cwdOf(sessionId), runId: runId }),
			});
		}

		/** 某次执行的结构化结果（result.json：status / counts / tests[]）。 */
		function fetchRunResult(sessionId, runId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("runId", runId);
			return callApi("/data-panel/run/result?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 某次执行的原始日志。 */
		function fetchRunLog(sessionId, runId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("runId", runId);
			return callApi("/data-panel/run/log?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 本会话各 runId 下的报告文件（只读）。 */
		function fetchReportList(sessionId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			return callApi("/data-panel/run/report?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 某次 run 的报告数据与文件列表。 */
		function fetchReportOf(sessionId, runId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("runId", runId);
			return callApi("/data-panel/run/report?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}

		/** 最近一次执行的报告（一次请求直接拿 docx，少一步链路）。 */
		function fetchReportLatest(sessionId, scope, caseId) {
			var params = new URLSearchParams();
			params.set("sessionId", sessionId);
			params.set("cwd", cwdOf(sessionId));
			params.set("scope", scope);
			if (scope === "case") params.set("caseId", caseId || "");
			return callApi("/data-panel/run/report/latest?" + params.toString(), { method: "GET", headers: { accept: "application/json" } });
		}
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

		/**
		 * 操作列的日志按钮。
		 * 直接复用 IconButton + "log" 图标，尺寸/悬停/线条风格与源码、执行、编辑、删除四个按钮完全一致——
		 * 不用 emoji 是因为彩色字形和这套 1.7px stroke 图标不是一套视觉。
		 */
		function LogButton(props) {
			return h(IconButton, {
				name: "log",
				label: props.label,
				onClick: props.onClick
			});
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

		/** 单元格文本。默认截断 2 行，传 lines={3} 截断 3 行。 */
		function CellText(props) {
			var value = props.value || "";
			return h("p", {
				className: cn("dp-cell-text", props.lines === 3 ? "dp-cell-3" : "", value ? "" : "empty")
			}, value || "—");
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
					className: cn("dp-modal", props.wide === true ? "dp-modal-wide" : ""),
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

		/**
		 * 执行日志弹窗。
		 *
		 * 日志由 runner 在执行时写进会话目录的 runs/<runId>/run.log：
		 *   props.record 为空 → 工具栏那一个，读本会话最近一次「整体执行」；
		 *   props.record 有值 → 某条用例，读它最近一次执行。
		 * 找不到就明确说「还没有执行过」，不再用空白弹窗冒充“日志丢了”。
		 */
		function LogModal(props) {
			var record = props.record || null;
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var runId = typeof props.runId === "string" ? props.runId : "";
			var state = useState({ status: "loading", content: "", error: "", updatedAt: "", result: null, runId: "" });
			var view = state[0];
			var setView = state[1];
			var copyState = useState("复制日志");
			var copyLabel = copyState[0];
			var setCopyLabel = copyState[1];

			useEffect(function () {
				if (sessionId === "") {
					setView({ status: "error", content: "", error: "还没拿到当前会话，稍后再试。", updatedAt: "", result: null, runId: "" });
					return undefined;
				}
				var alive = true;
				setView({ status: "loading", content: "", error: "", updatedAt: "", result: null, runId: "" });
				if (runId !== "") {
					// 从执行记录点进来：直接读这一条 run，不再按用例找最近一次。
					Promise.all([fetchRunResult(sessionId, runId), fetchRunLog(sessionId, runId)]).then(function (both) {
						if (!alive) return;
						var resultData = both[0];
						var logData = both[1];
						setView({
							status: "ready",
							content: logData && logData.exists ? (logData.content || "") : "",
							error: "",
							updatedAt: (logData && logData.updatedAt) || "",
							result: resultData && resultData.exists ? resultData.result : null,
							runId: runId,
						});
					}).catch(function (failure) {
						if (!alive) return;
						setView({ status: "error", content: "", error: failure && failure.message ? failure.message : "读取日志失败", updatedAt: "", result: null, runId: runId });
					});
					return function () {
						alive = false;
					};
				}
				var scope = record ? "case" : "all";
				fetchLatestRun(sessionId, scope, record ? record.caseId : "").then(function (latest) {
					if (!alive) return;
					if (!latest || latest.exists !== true || !latest.runId) {
						setView({ status: "empty", content: "", error: "", updatedAt: "", result: null, runId: "" });
						return null;
					}
					return fetchRunLog(sessionId, latest.runId).then(function (log) {
						if (!alive) return;
						setView({
							status: "ready",
							content: log && log.exists ? (log.content || "") : "",
							error: "",
							updatedAt: (log && log.updatedAt) || "",
							result: latest.result || null,
							runId: latest.runId || "",
						});
					});
				}).catch(function (failure) {
					if (!alive) return;
					setView({ status: "error", content: "", error: failure && failure.message ? failure.message : "读取日志失败", updatedAt: "", result: null, runId: "" });
				});
				return function () {
					alive = false;
				};
			}, [sessionId, record ? record.id : "", record ? record.caseId : "", runId]);

			function copy() {
				try {
					if (typeof navigator === "undefined" || !navigator.clipboard) {
						setCopyLabel("请手动选中复制");
						return;
					}
					navigator.clipboard.writeText(view.content).then(function () {
						setCopyLabel("已复制");
					}, function () {
						setCopyLabel("复制失败");
					});
				} catch (error) {
					setCopyLabel("复制失败");
				}
			}

			var body = null;
			if (view.status === "loading") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "refresh", size: 26 })),
					h("p", null, "正在读取日志…")
				);
			} else if (view.status === "error") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "warning", size: 26 })),
					h("p", null, view.error)
				);
			} else if (view.status === "empty") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "log", size: 26 })),
					h("p", null, record
						? "这条用例还没有执行过。点它的「执行」按钮，run 完再回来看。"
						: "还没有整体执行记录。点「全部执行」跑一次就会有了。")
				);
			} else {
				var summary = summarizeRun(view.result);
				body = h("div", null,
					summary ? h("div", { className: "dp-run-result" }, summary) : null,
					h("div", { className: "dp-code-meta" },
						view.runId ? h("span", null, "运行 ", h("code", null, view.runId)) : null,
						view.updatedAt ? h("span", null, " · 日志时间 ", h("code", null, fmtFull(view.updatedAt))) : null
					),
					view.content
						? h("pre", { className: "dp-code-body" }, view.content)
						: h("div", { className: "dp-log-empty" }, h("p", null, "这次执行没有产生输出。"))
				);
			}

			return h(Modal, {
				title: "执行日志",
				subtitle: record
					? (record.caseId ? record.caseId + " · " : "") + (record.title || "")
					: "全部用例（最近一次整体执行）",
				onClose: props.onClose,
				footer: [
					view.status === "ready" ? h(Button, { key: "copy", onClick: copy }, copyLabel) : null,
					h(Button, { key: "close", variant: "primary", onClick: props.onClose }, "关闭")
				]
			}, body);
		}

		/** 新建 / 重命名层级的输入弹窗。 */
		function CategoryPrompt(props) {
			var valueState = useState(props.initialValue || "");
			var value = valueState[0];
			var setValue = valueState[1];
			var errorState = useState("");
			var error = errorState[0];
			var setError = errorState[1];

			function submit() {
				var name = value.trim();
				if (name === "") { setError("层级名不能为空"); return; }
				if (name === "默认") { setError("「默认」是内置层级，换个名字"); return; }
				props.onSubmit(name);
			}

			return h(Modal, {
				title: props.title,
				subtitle: props.subtitle,
				onClose: props.onClose,
				footer: [
					h(Button, { key: "cancel", onClick: props.onClose }, "取消"),
					h(Button, { key: "ok", variant: "primary", onClick: submit }, "确定")
				]
			},
				h(Field, { label: "层级名称", full: true, hint: "填已有的名字就是把用例并进那个层级；填新名字就是新建一个层级。" },
					h("input", {
						className: "dp-input",
						value: value,
						maxLength: 60,
						placeholder: "例如：RingBuffer 模块",
						onChange: function (event) { setValue(event.target.value); setError(""); },
						onKeyDown: function (event) { if (event.key === "Enter") submit(); }
					})
				),
				error ? h("p", { className: "dp-hint", style: { color: "var(--dp-danger)" } }, error) : null
			);
		}

		/** 一次执行的状态文案与色调。 */
		function runStateOf(run) {
			var status = run && typeof run.status === "string" ? run.status : "";
			var labels = {
				passed: "通过",
				failed: "失败",
				partial: "部分通过",
				error: "出错",
				timeout: "超时",
				interrupted: "被中断",
				running: "执行中",
				"no-tests": "没收集到测试",
				"no-test-file": "缺测试代码"
			};
			var tone = status === "passed" ? "ok" : (status === "failed" || status === "error" || status === "timeout" ? "bad" : "idle");
			return { label: labels[status] || (status || "未知"), tone: tone };
		}

		/**
		 * 表格行展开出来的「执行记录」。
		 * 数据来自 /data-panel/run/list（只读会话资产目录里已有的 runs/），
		 * 一次执行一条，最新在前；查看/删除都只影响这一条记录，不动用例。
		 */
		function RunRecords(props) {
			var record = props.record;
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var state = useState({ status: "loading", runs: [], error: "" });
			var view = state[0];
			var setView = state[1];
			var reloadState = useState(0);
			var reloadTick = reloadState[0];
			var setReloadTick = reloadState[1];

			useEffect(function () {
				if (sessionId === "") {
					setView({ status: "error", runs: [], error: "还没拿到当前会话。" });
					return undefined;
				}
				var alive = true;
				setView({ status: "loading", runs: [], error: "" });
				fetchRunList(sessionId, "case", record.caseId).then(function (data) {
					if (!alive) return;
					var runs = (data && data.runs) || [];
					setView({ status: runs.length === 0 ? "empty" : "ready", runs: runs, error: "" });
				}).catch(function (failure) {
					if (!alive) return;
					setView({ status: "error", runs: [], error: failure && failure.message ? failure.message : "读取执行记录失败" });
				});
				return function () {
					alive = false;
				};
			}, [sessionId, record.caseId, reloadTick]);

			function remove(runId) {
				props.onRemove(runId, function (done) {
					if (done) setReloadTick(function (n) { return n + 1; });
				});
			}

			var body = null;
			if (view.status === "loading") {
				body = h("div", { className: "dp-run-empty" }, "正在读取执行记录…");
			} else if (view.status === "error") {
				body = h("div", { className: "dp-run-empty" }, view.error);
			} else if (view.status === "empty") {
				body = h("div", { className: "dp-run-empty" }, "这条用例还没有执行过。点它的「执行」按钮，跑完再回来看。");
			} else {
				var outcomeLabels = { passed: "通过", failed: "未通过", error: "错误", skipped: "跳过", unknown: "未确认" };
				var outcomeTones = { passed: "ok", failed: "bad", error: "bad", skipped: "idle", unknown: "idle" };
				body = h("table", { className: "dp-run-table" },
					h("thead", null,
						h("tr", null,
							h("th", { style: { width: "42px" } }, "#"),
							h("th", { style: { width: "150px" } }, "执行时间"),
							h("th", { style: { width: "82px" } }, "结果"),
							h("th", { style: { width: "70px" } }, "耗时"),
							h("th", null, "实际输出"),
							h("th", { className: "dp-right", style: { width: "112px" } }, "操作")
						)
					),
					h("tbody", null, view.runs.map(function (run, index) {
						var outcome = run.caseOutcome || run.status || "";
						var label = outcomeLabels[outcome] || outcome || "—";
						var tone = outcomeTones[outcome] || "idle";
						var actualText = run.actual || run.message || "未记录实际值";
						return h("tr", { key: run.runId },
							h("td", null, String(view.runs.length - index)),
							h("td", { title: run.runId }, fmtFull(run.startedAt)),
							h("td", null, h("span", { className: "dp-run-state", "data-tone": tone }, label)),
							h("td", null, run.durationMs > 0 ? (run.durationMs / 1000).toFixed(1) + "s" : "—"),
							h("td", { className: "dp-run-output" },
								h("pre", { title: actualText }, actualText)
							),
							h("td", null,
								h("div", { className: "dp-run-ops" },
									h(IconButton, {
										name: "doc",
										label: "报告 " + record.caseId + " 第 " + (view.runs.length - index) + " 次执行",
										onClick: function () { props.onReport(run); }
									}),
									h(IconButton, {
										name: "log",
										label: "日志 " + record.caseId + " 第 " + (view.runs.length - index) + " 次执行",
										onClick: function () { props.onLog(run); }
									}),
									h(IconButton, {
										name: "trash",
										danger: true,
										label: "删除 " + record.caseId + " 第 " + (view.runs.length - index) + " 次执行记录",
										onClick: function () { remove(run.runId); }
									})
								)
							)
						);
					}))
				);
			}

			return h("div", { className: "dp-run-panel" },
				h("div", { className: "dp-run-title" },
					h("span", null, "执行记录", h("b", null, record.caseId)),
					h("span", { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
						"共 " + view.runs.length + " 次",
						h(IconButton, {
							name: "refresh",
							label: "刷新执行记录",
							onClick: function () { setReloadTick(function (n) { return n + 1; }); }
						})
					)
				),
				body
			);
		}

		/**
		 * 一次执行的「查看」弹窗：宽弹窗，逐条结果 + 原始日志。
		 * 只读 result.json 的 tests[] 与 run.log，不碰 reports/<runId>/。
		 */
		function RunReportModal(props) {
			var run = props.run;
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var state = useState({ status: "loading", result: null, log: "", error: "" });
			var view = state[0];
			var setView = state[1];

			useEffect(function () {
				if (sessionId === "") {
					setView({ status: "error", result: null, log: "", error: "还没拿到当前会话。" });
					return undefined;
				}
				var alive = true;
				setView({ status: "loading", result: null, log: "", error: "" });
				Promise.all([
					fetchRunResult(sessionId, run.runId),
					fetchRunLog(sessionId, run.runId)
				]).then(function (both) {
					if (!alive) return;
					var resultData = both[0];
					var logData = both[1];
					setView({
						status: "ready",
						result: resultData && resultData.exists ? resultData.result : null,
						log: logData && logData.exists ? (logData.content || "") : "",
						error: ""
					});
				}).catch(function (failure) {
					if (!alive) return;
					setView({ status: "error", result: null, log: "", error: failure && failure.message ? failure.message : "读取报告失败" });
				});
				return function () {
					alive = false;
				};
			}, [sessionId, run.runId]);

			var tests = view.result && Array.isArray(view.result.tests) ? view.result.tests : [];
			var outcomeLabel = { passed: "通过", failed: "失败", error: "错误", skipped: "跳过" };
			var outcomeTone = { passed: "ok", failed: "bad", error: "bad", skipped: "idle" };

			var body = null;
			if (view.status === "loading") {
				body = h("div", { className: "dp-log-empty" }, h("p", null, "正在读取这次执行的报告…"));
			} else if (view.status === "error") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "warning", size: 26 })),
					h("p", null, view.error)
				);
			} else {
				var summary = view.result ? summarizeRun(view.result) : "";
				body = h("div", null,
					summary ? h("div", { className: "dp-run-result" }, summary) : null,
					h("div", { className: "dp-code-meta" },
						h("span", null, "运行 ", h("code", null, run.runId)),
						view.result && view.result.finishedAt ? h("span", null, " · 结束 ", h("code", null, fmtFull(view.result.finishedAt))) : null
					),
					tests.length > 0
						? h("table", { className: "dp-run-table" },
							h("thead", null, h("tr", null,
								h("th", { style: { width: "45%" } }, "测试函数"),
								h("th", { style: { width: "80px" } }, "结果"),
								h("th", null, "说明")
							)),
							h("tbody", null, tests.map(function (item, index) {
								return h("tr", { key: String(index) },
									h("td", { style: { fontFamily: "ui-monospace, Consolas, monospace" } }, item.func || "—"),
									h("td", null, h("span", { className: "dp-run-state", "data-tone": outcomeTone[item.outcome] || "idle" }, outcomeLabel[item.outcome] || item.outcome || "—")),
									h("td", null, item.message || "—")
								);
							}))
						)
						: h("p", { className: "dp-run-hint" }, "这次执行没有逐条测试结果（可能没收集到测试，或结果文件缺失）。"),
					h("div", { className: "dp-code-meta", style: { marginTop: "14px" } }, "原始输出"),
					view.log
						? h("pre", { className: "dp-code-body" }, view.log)
						: h("div", { className: "dp-log-empty" }, h("p", null, "这次执行没有产生输出。"))
				);
			}

			return h(Modal, {
				title: "执行报告",
				subtitle: (props.record ? (props.record.caseId ? props.record.caseId + " · " : "") + (props.record.title || "") : "") + "　" + fmtFull(run.startedAt),
				wide: true,
				onClose: props.onClose,
				footer: h(Button, { variant: "primary", onClick: props.onClose }, "关闭")
			}, body);
		}

		/**
		 * 报告弹窗（只读）。
		 *
		 * 报告由 Skill / 命令行调 bridge.py 生成，落在会话目录的 reports/<runId>/。
		 * 面板不生成报告，只负责列出来并展示摘要，避免两处逻辑各算一次。
		 */
		function ReportModal(props) {
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var initialRunId = typeof props.initialRunId === "string" ? props.initialRunId : "";
			var state = useState({ status: "loading", error: "", runs: [], detail: null });
			var view = state[0];
			var setView = state[1];

			useEffect(function () {
				if (sessionId === "") {
					setView({ status: "error", error: "还没拿到当前会话，稍后再试。", runs: [], detail: null });
					return undefined;
				}
				var alive = true;
				setView({ status: "loading", error: "", runs: [], detail: null });
				if (initialRunId !== "") {
					// 单条执行：只读这一条 run 的报告，不再列其他 run。
					fetchReportOf(sessionId, initialRunId).then(function (detail) {
						if (!alive) return;
						var files = (detail && detail.files) || [];
						var hasData = !!(detail && detail.data);
						if (!detail || detail.exists === false || (files.length === 0 && !hasData)) {
							setView({ status: "empty", error: "", runs: [], detail: null, runId: initialRunId });
						} else {
							setView({ status: "ready", error: "", runs: [], detail: detail });
						}
					}).catch(function (failure) {
						if (!alive) return;
						setView({ status: "error", error: failure && failure.message ? failure.message : "读取报告失败", runs: [], detail: null });
					});
				} else {
					fetchReportList(sessionId).then(function (data) {
						if (!alive) return;
						var runs = (data && data.runs) || [];
						if (runs.length === 0) {
							setView({ status: "empty", error: "", runs: [], detail: null });
							return null;
						}
						// 默认展开最新一份。
						return fetchReportOf(sessionId, runs[0].runId).then(function (detail) {
							if (!alive) return;
							setView({ status: "ready", error: "", runs: runs, detail: detail });
						});
					}).catch(function (failure) {
						if (!alive) return;
						setView({ status: "error", error: failure && failure.message ? failure.message : "读取报告失败", runs: [], detail: null });
					});
				}
				return function () {
					alive = false;
				};
			}, [sessionId, initialRunId]);

			function openRun(runId) {
				fetchReportOf(sessionId, runId).then(function (detail) {
					setView(function (previous) { return Object.assign({}, previous, { detail: detail }); });
				}).catch(function () {
					store.setError("读取该次报告失败");
				});
			}

			var body = null;
			if (view.status === "loading") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "refresh", size: 26 })),
					h("p", null, "正在读取报告…")
				);
			} else if (view.status === "error") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "warning", size: 26 })),
					h("p", null, view.error)
				);
			} else if (view.status === "empty") {
				body = h("div", { className: "dp-log-empty" },
					h("span", { className: "dp-log-empty-icon" }, h(Icon, { name: "doc", size: 26 })),
					h("p", null, initialRunId !== ""
						? "这次执行还没有生成报告（runId " + initialRunId + "）。执行后请让 AI 按 Skill 的 Step 6 生成。"
						: "还没有生成过报告。执行完测试后，按 Skill 的步骤跑 bridge.py 就会出现在这里。")
				);
			} else {
				var detail = view.detail;
				var data = detail && detail.data;
				var summary = data && data.summary ? data.summary : null;
				var meta = data && data.meta ? data.meta : null;
				var reportDoc = null;
				if (detail && detail.files) {
					for (var fileIndex = 0; fileIndex < detail.files.length; fileIndex++) {
						if (/\.docx$/i.test(detail.files[fileIndex].name)) { reportDoc = detail.files[fileIndex]; break; }
					}
				}
				body = h("div", null,
					h("div", { className: "dp-code-meta" },
						view.runs.map(function (run) {
							var active = detail && detail.runId === run.runId;
							return h("button", {
								key: run.runId,
								type: "button",
								className: "dp-pager-btn",
								style: active ? { borderColor: "var(--dp-brand)", color: "var(--dp-brand)" } : null,
								onClick: function () { openRun(run.runId); },
							}, run.runId)
						})
					),
					summary ? h("div", { className: "dp-run-result" },
						"runId " + (meta ? meta.runId : "")
						+ "　状态 " + (meta ? meta.statusText : "—")
						+ "　共 " + summary.total
						+ " 条，通过 " + summary.passed
						+ "，失败 " + summary.failed
						+ "，未执行 " + summary.notRun
						+ (typeof summary.unconfirmed === "number" ? "，未确认 " + summary.unconfirmed : "")
					) : null,
					summary ? null : h("p", { className: "dp-hint" }, "这次 run 还没有 report-data.json（只生成了报告文件）。"),
					reportDoc && reportDoc.path
						? h(Button, {
							variant: "primary",
							style: "margin-bottom: 10px",
							onClick: function () { openReportFile(reportDoc.path, sessionId); }
						}, "打开 Word 报告")
						: null,
					detail && detail.files && detail.files.length > 0
						? h("div", { className: "dp-code-meta" }, detail.files.map(function (file) {
							return h("span", { key: file.name, style: { display: "inline-flex", alignItems: "center", gap: "6px" } },
								h("code", null, file.name + "  (" + Math.round(file.size / 1024) + " KB)"),
								// 只对确实存在的文件才给“打开”；用系统默认程序（Word）打开。
								file.path ? h("button", {
									type: "button",
									className: "dp-icon-btn",
									title: "用系统默认程序打开",
									"aria-label": "用系统默认程序打开 " + file.name,
									onClick: function () { openReportFile(file.path, sessionId); },
								}, h(Icon, { name: "external", size: 14 })) : null
							);
						}))
						: null
				);
			}

			return h(Modal, {
				title: props.title || "测试报告",
				subtitle: initialRunId !== ""
					? "单条用例执行报告 · runId " + initialRunId
					: "只读：由 bridge.py 生成在 reports/<runId>/",
				onClose: props.onClose,
				footer: h(Button, { variant: "primary", onClick: props.onClose }, "关闭"),
			}, body);
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

		/**
		 * 空状态。三种情形分开说清楚：
		 *   category — 当前层级里没有用例 → 引导去「默认」挑用例加进来
		 *   filtered — 有筛选条件但没命中 → 清筛选
		 *   都没有   — 面板里一条用例都没有 → 新增
		 */
		function EmptyState(props) {
			var filtered = props.filtered;
			var category = typeof props.category === "string" ? props.category : "";
			var inCategory = category !== "" && !filtered;
			return h("div", { className: "dp-empty" },
				h("div", { className: "dp-empty-icon" },
					h(Icon, { name: inCategory ? "folder" : "doc", size: 23 })
				),
				h("h3", null, inCategory
					? "「" + category + "」层级还是空的"
					: (filtered ? "没有匹配的用例" : "还没有用例")),
				h("p", null, inCategory
					? "去「默认」层级勾选要放进这个层级的用例，再用下方的「添加至层级」归入。"
					: (filtered
						? "换个关键词或清除筛选条件试试。"
						: "把需要跟踪的测试用例放进面板，点击用例名称即可在右侧查看详情。")),
				inCategory
					? h(Button, { variant: "primary", onClick: props.onGoDefault },
						h(Icon, { name: "folder", size: 15 }),
						"去「默认」挑选用例"
					)
					: (filtered
						? h(Button, { onClick: props.onClear }, "清除筛选")
						: h(Button, { variant: "primary", onClick: props.onCreate },
							h(Icon, { name: "plus", size: 15 }),
							"新增用例"
						))
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
					codeRef: initial.codeRef || "",
					category: initial.category || ""
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
					// 层级：选了就归到那一层，但用例本身永远在「默认」里可见。
					h(Field, { label: "所属层级", hint: "留空表示只在「默认」层；选一个层级会同时把它归到那一层。" },
						h("select", {
							className: "dp-select",
							value: values.category,
							onChange: function (event) { set("category", event.target.value); }
						},
							h("option", { value: "" }, "不归入层级（仅默认）"),
							(props.categories || []).map(function (name) {
								return h("option", { key: name, value: name }, name);
							})
						)
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
			// 本组件只作为右侧栏的「测试用例」tab 渲染（apply 里带 dock: true 注册）。
			// 主区那个入口已经改成 tab 行末尾的按钮（见 startPanelButton）。
			var docked = props.dock === true;
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
			var runResultState = useState("");
			var runResult = runResultState[0];
			var setRunResult = runResultState[1];
			// 执行日志弹窗：null = 关闭；{ record: null } = 工具栏整批日志；{ record } = 某条用例。
			var logState = useState(null);
			var logView = logState[0];
			var setLogView = logState[1];
			// 报告弹窗（只读）。
			var reportState = useState(false);
			var reportView = reportState[0];
			var setReportView = reportState[1];
			// 报告列表入口暂时隐藏（代码保留，改回 true 即可恢复）。
			var SHOW_REPORT_LIST = false;
			// 当前展开执行记录的用例 id（一次只展开一行）。
			var expandedState = useState("");
			var expandedId = expandedState[0];
			var setExpandedId = expandedState[1];
			// 正在查看的那次执行（{ record, run }）。
			var runViewState = useState(null);
			var runView = runViewState[0];
			var setRunView = runViewState[1];
			// 删除执行记录的二次确认。
			var removeRunState = useState(null);
			var removeRun = removeRunState[0];
			var setRemoveRun = removeRunState[1];
			// 用例层级：当前选中的层级（"" = 默认层，含全部）。
			var categoryState = useState("");
			var activeCategory = categoryState[0];
			var setActiveCategory = categoryState[1];
			// 左栏常驻显示，不再提供折叠。
			// 表格勾选（存 record.id）。
			var pickedState = useState([]);
			var picked = pickedState[0];
			var setPicked = pickedState[1];
			// 「添加至层级」上拉菜单：pickerOpen 控制展开，pickerChoice 是暂选但未确认的层级。
			var pickerState = useState({ open: false, choice: "" });
			var picker = pickerState[0];
			var setPicker = pickerState[1];
			// 层级弹窗：{ mode: "create" | "rename", from? }。
			var categoryPromptState = useState(null);
			var categoryPrompt = categoryPromptState[0];
			var setCategoryPrompt = categoryPromptState[1];

			function openLatestReport(scope, caseId, noDocMessage, noRunMessage) {
				var sid = panelSessionId(props);
				if (sid === "") { store.setError("还没取得当前会话"); return; }
				setRunResult(scope === "case" ? "正在查找 " + caseId + " 的报告…" : "正在查找最近的测试报告…");
				var finished = false;
				var timer = setTimeout(function () {
					if (finished) return;
					finished = true;
					setRunResult("");
					store.setError("读取报告超时，请稍后重试。");
				}, 10000);
				function finish() {
					if (finished) return false;
					finished = true;
					clearTimeout(timer);
					return true;
				}
				try {
					fetchReportLatest(sid, scope, caseId).then(function (result) {
						if (!finish()) return;
						setRunResult("");
						if (!result || !result.exists) { store.setError(noRunMessage); return; }
						if (!result.docx || !result.docx.path) { store.setError(noDocMessage); return; }
						openReportFile(result.docx.path, sid, function () { setRunResult("已打开报告。"); });
					}).catch(function (failure) {
						if (!finish()) return;
						setRunResult("");
						store.setError("读取报告失败：" + (failure && failure.message ? failure.message : String(failure)));
					});
				} catch (error) {
					finish();
					setRunResult("");
					store.setError("读取报告失败：" + (error && error.message ? error.message : String(error)));
				}
			}

			function openCaseReport(record) {
				openLatestReport("case", record.caseId, "这条用例最近一次单独执行还没有生成 Word 报告。", "这条用例还没有单独执行记录，先点「执行」再查看报告。");
			}

			function openRunReport(record, run) {
				var sid = panelSessionId(props);
				if (sid === "") { store.setError("还没取得当前会话"); return; }
				setRunResult("正在查找这次执行的报告…");
				fetchReportOf(sid, run.runId).then(function (detail) {
					setRunResult("");
					var doc = docxOf(detail);
					if (!doc) { store.setError("这次执行还没有生成 Word 报告。"); return; }
					openReportFile(doc.path, sid, function () { setRunResult("已打开报告。"); });
				}).catch(function (failure) {
					setRunResult("");
					store.setError("读取报告失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			function openLatestTotalReport() {
				openLatestReport("all", "", "最近一次整体执行还没有生成 Word 报告。", "还没有生成总报告。");
			}

			useEffect(function () {
				// 面板打开是一个明确信号：至少此刻要确保会话订阅已经建立，
				// 否则用户切换会话时这里不会自动刷新（重启后曾出现过）。
				ensureSessionSubscription(true);
				store.load().catch(function () {});
			}, []);

			var records = snap.records || [];
			var filtered = useMemo(function () {
				var needle = query.trim().toLowerCase();
				return records.filter(function (record) {
					// 默认层（空串）看全部，其它层只看自己名下的。
					if (activeCategory !== "") {
						var owned = typeof record.category === "string" ? record.category.trim() : "";
						if (owned !== activeCategory) return false;
					}
					if (type !== "all" && record.testType !== type) return false;
					if (!needle) return true;
					return [record.caseId, record.title, record.description, record.input, record.expected]
						.join(" ")
						.toLowerCase()
						.indexOf(needle) !== -1;
				});
			}, [records, query, type, activeCategory]);


			// 层级行：「默认」固定第一（含全部用例），其余按名字排。
			var categoryRows = useMemo(function () {
				var names = Array.isArray(snap.categories) ? snap.categories : [];
				var rows = [{ key: "__all__", value: "", label: "默认", count: records.length }];
				names.forEach(function (name) {
					var count = records.filter(function (record) {
						return (typeof record.category === "string" ? record.category.trim() : "") === name;
					}).length;
					rows.push({ key: name, value: name, label: name, count: count });
				});
				return rows;
			}, [records, snap.categories]);

			var pickedSet = useMemo(function () {
				var map = Object.create(null);
				picked.forEach(function (id) { map[id] = true; });
				return map;
			}, [picked]);

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
				// 带上本面板自己的会话：详情页要用它解析相对路径、并且只能改它自己的数据。
				props.openDetail(id, props.sessionId);
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
				var action = null;
				if (confirm.kind === "clearDemo") {
					action = store.clearDemo();
				} else if (confirm.kind === "deleteCategory") {
					// 只解散层级：里面的用例退回默认层，一条都不删。
					action = store.deleteCategory(confirm.category).then(function () {
						if (activeCategory === confirm.category) setActiveCategory("");
					});
				} else if (confirm.kind === "removeFromCategory") {
					// 只把这一条移出层级（category 置空 → 回到默认层），用例本体不动。
					var removing = confirm.record;
					action = store.assignCategory([removing.id], "").then(function () {
						setPicked(function (previous) {
							return previous.filter(function (item) { return item !== removing.id; });
						});
					});
				} else {
					action = store.remove(confirm.record.id);
				}
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

			function togglePick(id) {
				setPicked(function (previous) {
					var at = previous.indexOf(id);
					if (at === -1) return previous.concat([id]);
					return previous.filter(function (item) { return item !== id; });
				});
			}

			/**
			 * 表头全选框：只作用**当前页**，但不能覆盖别的页已勾的。
			 *
			 * 勾选时把本页 id 并进已有集合；取消时只移除本页的 id。
			 * 之前直接 `setPicked(ids.slice())` 会把前几页的选择整片丢掉。
			 */
			function togglePickAll(ids) {
				var allPicked = ids.length > 0 && ids.every(function (id) { return pickedSet[id] === true; });
				setPicked(function (previous) {
					if (!allPicked) {
						// 本页还没全选 → 并集（保留其它页已勾的）。
						var merged = previous.slice();
						ids.forEach(function (id) {
							if (merged.indexOf(id) === -1) merged.push(id);
						});
						return merged;
					}
					// 本页已全选 → 只移除本页的，其它页保持不动。
					var pageSet = Object.create(null);
					ids.forEach(function (id) { pageSet[id] = true; });
					return previous.filter(function (id) { return pageSet[id] !== true; });
				});
			}

			function assignPicked(category) {
				if (picked.length === 0) return;
				var ids = picked.slice();
				setBusy(true);
				store.assignCategory(ids, category).then(function () {
					setPicked([]);
					setPicker({ open: false, choice: "" });
					store.setError("");
				}).catch(function (failure) {
					store.setError("归类失败：" + (failure && failure.message ? failure.message : String(failure)));
				}).finally(function () {
					setBusy(false);
				});
			}

			function submitCategoryName(name) {
				var pending = categoryPrompt;
				if (pending === null) return;
				setCategoryPrompt(null);
				setBusy(true);
				var action = null;
				if (pending.mode === "rename") {
					action = store.renameCategory(pending.from, name).then(function () {
						setActiveCategory(name);
					});
				} else {
					// 不要求先勾选：先建层级，之后再挑用例放进去。
					// 若此刻正好勾了用例，就顺手一起归入，省一步操作。
					var ids = picked.slice();
					action = store.createCategory(name).then(function () {
						setActiveCategory(name);
						if (ids.length === 0) {
							// 从服务端重拉一次，确保左栏拿到的是落盘后的真实清单。
							return store.load(true).catch(function () {});
						}
						return store.assignCategory(ids, name).then(function () {
							setPicked([]);
							return store.load(true).catch(function () {});
						});
					});
				}
				action.then(function () {
					store.setError("");
				}).catch(function (failure) {
					store.setError("操作失败：" + (failure && failure.message ? failure.message : String(failure)));
				}).finally(function () {
					setBusy(false);
				});
			}

			var loading = (snap.status === "idle" || snap.status === "loading") && records.length === 0;
			// 还没拿到当前会话：不能去读任何数据，界面直接说清楚在等什么。
			var waitingSession = snap.status === "waiting-session";
			var filtering = query.trim() !== "" || type !== "all";

			// 面板只作为右侧栏的「测试用例」tab 存在（见 apply 里的注册）。
			// 本组件现在只由右侧栏那个 tab 装载，不再有"主区形态"。
			return h("div", { className: cn("dp-root", docked ? "dp-docked" : "") },
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
						),
						// 执行 / 报告 / 日志：三个同高、同规格，顺序固定为 全部执行 → 报告 → 日志。
						h("div", { className: "dp-toolbar-actions" },
								h(Button, {
									className: "dp-run-all-btn",
								disabled: snap.status === "refreshing",
								title: "准备全部用例的执行命令，填进当前会话",
								onClick: function () {
									// 先让宿主准备（导出用例 + 生成 runId + 给命令），再把命令预填到面板所属会话。
									var currentRecords = snap.records || [];
									var targetSession = panelSessionId(props);
									if (currentRecords.length === 0) {
										store.setError("当前面板里还没有用例，先新增或生成用例后再执行。");
										return;
									}
									setRunResult("正在准备执行…");
									prepareRun(targetSession, "all", "").then(function (prep) {
										var outcome = prefillDraft(targetSession, runAllPrompt(currentRecords, targetSession, prep));
										if (!outcome.ok) { setRunResult(""); store.setError("执行：" + outcome.message); return; }
										store.setError("");
										setRunResult(outcome.message + "  运行编号：" + prep.runId + "  框架：" + (prep.framework || prep.frameworkId || "未知"));
									}).catch(function (failure) {
										setRunResult("");
										store.setError("执行准备失败：" + (failure && failure.message ? failure.message : String(failure)));
									});
								},
							}, "全部执行"),
							h(Button, {
								className: "dp-report-btn",
								onClick: function () { openLatestTotalReport(); },
								title: "打开最近一次整体执行的 Word 报告"
							}, "报告"),
							SHOW_REPORT_LIST ? h(Button, {
								onClick: function () { setReportView(true); },
								title: "查看已生成的测试报告列表"
							}, "报告列表") : null,
							h(Button, {
								className: "dp-log-btn",
								onClick: function () { setLogView({ record: null }); },
								title: "查看本节全部用例的执行日志"
							}, "日志")
						)
					),
					// 勾选反馈放在表格下方（不占表格上方的空间）。
					runResult ? h("div", { className: "dp-run-result" }, runResult) : null,
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
				// 左栏只与表格平齐：标题、统计卡、工具栏都在它上面。
				h("div", { className: "dp-board" },
					h("aside", { className: "dp-sidebar" },
						h("div", { className: "dp-sidebar-head" },
							h("span", { className: "dp-sidebar-title" }, "用例层级"),
							h("div", { className: "dp-sidebar-tools" },
								h(IconButton, { name: "plus", label: "新建层级", onClick: function () { setCategoryPrompt({ mode: "create" }); } })
							)
						),
						// 勾选的引导文案统一放在表格下方的操作条里，左栏不再重复。
						categoryRows.map(function (row) {
							// 「默认」= 看全部用例。外观是分组标题，但可点击切回全部。
							if (row.value === "") {
								return h("button", {
									key: row.key,
									type: "button",
									className: cn("dp-cat-group", activeCategory === "" ? "is-active" : ""),
									title: "显示全部 " + row.count + " 条用例",
									onClick: function () { setActiveCategory(""); },
								},
									h("span", { className: "dp-cat-group-name" }, row.label),
									h("span", { className: "dp-cat-group-count" }, String(row.count))
								);
							}
							return h("div", {
								key: row.key,
								className: cn("dp-cat", activeCategory === row.value ? "is-active" : ""),
							},
								h("button", {
									type: "button",
									className: "dp-cat-main",
									title: row.label + "（" + row.count + " 条）",
									onClick: function () { setActiveCategory(row.value); },
								},
									h("span", { className: "dp-cat-name" }, row.label),
									h("span", { className: "dp-cat-count" }, String(row.count))
								),
								// 有勾选时，这个层级右侧出现「放入」；没有勾选时显示改名/删除。
								picked.length > 0
									? h("span", { className: "dp-cat-ops is-visible" },
										h("span", {
											role: "button",
											className: "dp-icon-btn dp-cat-drop",
											title: "把已选的 " + picked.length + " 条用例放入「" + row.label + "」",
											onClick: function () { assignPicked(row.value); }
										}, h(Icon, { name: "plus", size: 12 }))
									)
									: h("span", { className: "dp-cat-ops" },
										h("span", { role: "button", className: "dp-icon-btn", title: "重命名层级", onClick: function () { setCategoryPrompt({ mode: "rename", from: row.value }); } }, h(Icon, { name: "edit", size: 12 })),
										h("span", { role: "button", className: "dp-icon-btn danger", title: "删除层级（用例退回默认层）", onClick: function () { setConfirm({ kind: "deleteCategory", category: row.value }); } }, h(Icon, { name: "trash", size: 12 }))
									)
							);
						})
					),
					h("div", { className: "dp-main" },
						h("div", { className: "dp-card" },
							h("div", { className: "dp-card-scroll" },
								waitingSession
									? h("div", { className: "dp-empty" },
										h("div", { className: "dp-empty-icon" }, h(Icon, { name: "time", size: 22 })),
										h("h3", null, "正在取得当前会话"),
										h("p", null, "用例按会话存储，拿到当前会话后会自动加载它自己的用例。稍等一下；如果一直停在这里，点「刷新」重试。")
									)
									: loading
									? h(SkeletonTable)
									: filtered.length === 0
										? h(EmptyState, {
											filtered: filtering,
											category: activeCategory,
											onClear: function () { setQuery(""); setType("all"); },
											onGoDefault: function () { setActiveCategory(""); setPicked([]); },
											onCreate: openCreate
										})
										: h("table", { className: "dp-table" },
											h("colgroup", null,
												h("col", { style: { width: "30px" } }),
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
													h("th", { className: "dp-pick" },
												h("input", {
													type: "checkbox",
													"aria-label": "全选当前页",
													checked: pageRecords.length > 0 && pageRecords.every(function (record) { return pickedSet[record.id] === true; }),
													onChange: function () { togglePickAll(pageRecords.map(function (record) { return record.id; })); }
												})
											),
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
												var isOpen = expandedId === record.id;
												return h(React.Fragment, { key: record.id },
													h("tr", { className: cn("dp-row", isOpen ? "is-open" : "") },
													h("td", { className: "dp-pick" },
													h("input", {
														type: "checkbox",
														"aria-label": "选择 " + record.caseId,
														checked: pickedSet[record.id] === true,
														onChange: function () { togglePick(record.id); }
													})
												),
												h("td", null,
													h("div", { className: "dp-title-cell" },
														h("button", {
															type: "button",
															className: "dp-expand-btn",
															"data-open": isOpen ? "true" : "false",
															title: isOpen ? "收起执行记录" : "展开执行记录",
															"aria-label": (isOpen ? "收起 " : "展开 ") + record.caseId + " 的执行记录",
															"aria-expanded": isOpen,
															onClick: function () { setExpandedId(expandedId === record.id ? "" : record.id); }
														}, h(Icon, { name: "chevron", size: 16 })),
														h(CaseId, { caseId: record.caseId })
													)
												),
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
													h("td", null, h(CellText, { value: record.description, lines: 3 })),
													h("td", null, h(CellText, { value: record.input, lines: 3 })),
													h("td", null, h(CellText, { value: record.expected, lines: 3 })),
													h("td", null,
														h("div", { className: "dp-actions" },
															h(IconButton, {
																name: record.codeRef ? "location" : "code",
																label: (record.codeRef ? "查看源码 " : "查看代码 ") + record.title,
																onClick: function () {
																	// 有用例源码位置就跳编辑器；没有则沿用弹窗看用例代码。
															if (record.codeRef && typeof props.openCode === "function") props.openCode(record.codeRef, props.sessionId);
																	else setCodeRecord(record);
																}
															}),
															h(IconButton, {
																name: "external",
																label: "执行 " + record.title,
																onClick: function () {
															// 点执行 = 宿主准备好命令，再预填到面板所属会话的输入框。
															var targetSession2 = panelSessionId(props);
															setRunResult("正在准备执行 " + record.caseId + "…");
															prepareRun(targetSession2, "case", record.caseId).then(function (prep) {
																var outcome = prefillDraft(targetSession2, runPrompt(record, targetSession2, prep));
																if (!outcome.ok) { setRunResult(""); store.setError("执行：" + outcome.message); return; }
																store.setError("");
																setRunResult(outcome.message + "  运行编号：" + prep.runId + "  框架：" + (prep.framework || prep.frameworkId || "未知"));
															}).catch(function (failure) {
																setRunResult("");
																store.setError("执行准备失败：" + (failure && failure.message ? failure.message : String(failure)));
															});
																}
															}),
															h(IconButton, {
																name: "edit",
																label: "编辑 " + record.title,
																onClick: function () { openEdit(record); }
															}),
															// 在某个层级里看时，这个按钮是「移出层级」——用例本身不删。
															// 只有「默认」层（看全部）才是真的删用例。
															activeCategory !== ""
																? h(IconButton, {
																	name: "minus",
																	label: "从「" + activeCategory + "」移出 " + record.title,
																	onClick: function () { setConfirm({ kind: "removeFromCategory", record: record }); }
																})
																: h(IconButton, {
																	name: "trash",
																	label: "删除 " + record.title,
																	danger: true,
																	onClick: function () { setConfirm({ kind: "delete", record: record }); }
																}),
														)
													)
											),
											isOpen
												? h("tr", { className: "dp-row-expand" },
													h("td", { colSpan: 8, className: "dp-run-cell" },
														h(RunRecords, {
															record: record,
															sessionId: panelSessionId(props),
											onReport: function (run) { openRunReport(record, run); },
											onLog: function (run) { setLogView({ record: record, runId: run.runId }); },
															onRemove: function (runId, done) { setRemoveRun({ record: record, runId: runId, done: done }); }
														})
													)
												)
												: null
										);
										}))
										)
							),
							// 勾选反馈放在表格下方，不顶在表格上方。
							picked.length > 0 ? h("div", { className: "dp-pick-bar" },
								// 文案从「已选 N 条」换成操作引导；条数在按钮里体现。
								// 条数放在最前面，独立成块，一眼能看到。
								h("span", { className: "dp-pick-count" }, "已选 ", h("b", null, String(picked.length)), " 条"),
								h("span", { className: "dp-pick-hint" }, "在下方选择层级，点确定把选中的用例加入该层级"),
								// 添加至层级：点开列出全部层级，选一个再确认。
								h("div", { className: "dp-picker" },
									h("button", {
										type: "button",
										className: cn("dp-picker-toggle", picker.open ? "is-open" : ""),
										"aria-haspopup": "listbox",
										"aria-expanded": picker.open,
										onClick: function () { setPicker({ open: !picker.open, choice: picker.choice }); },
									},
										h("span", null, picker.choice === "" ? "添加至层级（" + picked.length + " 条）" : picker.choice + "（" + picked.length + " 条）"),
										h("span", { className: "dp-picker-caret" }, h(Icon, { name: "chevron", size: 12 }))
									),
									picker.open ? h("div", { className: "dp-picker-menu", role: "listbox" },
										// 只列自定义层级；「默认」= 全部用例，不是可归入的目标。
										categoryRows.filter(function (row) { return row.value !== ""; }).length === 0
											? h("p", { className: "dp-picker-empty" }, "还没有层级。先在左上角「用例层级」旁点 ＋ 新建一个。")
											: categoryRows.filter(function (row) { return row.value !== ""; }).map(function (row) {
												return h("button", {
													key: row.key,
													type: "button",
													role: "option",
													"aria-selected": picker.choice === row.value,
													className: cn("dp-picker-item", picker.choice === row.value ? "is-active" : ""),
													onClick: function () { setPicker({ open: true, choice: row.value }); },
												},
													h("span", { className: "dp-picker-item-name" }, row.label),
													h("span", { className: "dp-picker-item-count" }, String(row.count)),
													picker.choice === row.value ? h(Icon, { name: "check", size: 12 }) : null
												);
											})
									) : null,
									// 选中后才可确认。
									h("div", { className: "dp-picker-foot" },
										picker.open ? h(Button, {
											size: "sm",
											disabled: picker.choice === "" || busy,
											onClick: function () { assignPicked(picker.choice); },
										}, "确定") : null
									)
								),
								h(Button, { variant: "ghost", size: "sm", onClick: function () { setPicked([]); setPicker({ open: false, choice: "" }); } }, "取消选择")
							) : null,
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
					),
				)
				)
				),
				form !== null ? h(RecordFormModal, {
					mode: form.mode,
					record: form.record,
					categories: snap.categories || [],
					busy: busy,
					error: formError,
					onClose: function () { if (!busy) setForm(null); },
					onSubmit: submit
				}) : null,
				codeRecord !== null ? h(CodeModal, {
					record: codeRecord,
					onClose: function () { setCodeRecord(null); }
				}) : null,
				logView !== null ? h(LogModal, {
					record: logView.record,
					runId: logView.runId || "",
					// 日志按面板所属会话读，不跟着主区会话飘。
					sessionId: panelSessionId(props),
					onClose: function () { setLogView(null); }
				}) : null,
				reportView ? h(ReportModal, {
					sessionId: panelSessionId(props),
					onClose: function () { setReportView(false); }
				}) : null,
				// 某次执行的「查看」：宽弹窗，读 result.json 的 tests[] 与 run.log。
				runView !== null ? h(RunReportModal, {
					record: runView.record,
					run: runView.run,
					sessionId: panelSessionId(props),
					onClose: function () { setRunView(null); }
				}) : null,
				// 新建 / 重命名层级。
				categoryPrompt !== null ? h(CategoryPrompt, {
					title: categoryPrompt.mode === "rename" ? "重命名层级" : "新建层级",
					subtitle: categoryPrompt.mode === "rename" ? "当前：" + categoryPrompt.from : "从表格里勾选用例，再给它起个层级名。",
					initialValue: categoryPrompt.mode === "rename" ? categoryPrompt.from : "",
					onSubmit: submitCategoryName,
					onClose: function () { setCategoryPrompt(null); }
				}) : null,
				// 删除执行记录：不可恢复，先确认（只删 runs/<runId>/，不动用例）。
				removeRun !== null ? h(ConfirmDialog, {
					title: "删除这次执行记录？",
					message: "只会删掉这次执行的日志与结果（" + removeRun.runId + "），用例本身不受影响。",
					detail: h("span", null, "删除后无法恢复：", h("b", null, removeRun.record.caseId)),
					confirmLabel: "删除记录",
					busy: busy,
					onCancel: function () { setRemoveRun(null); },
					onConfirm: function () {
						var pending = removeRun;
						if (pending === null) return;
						setBusy(true);
						deleteRun(panelSessionId(props), pending.runId).then(function () {
							setRemoveRun(null);
							store.setError("");
							if (typeof pending.done === "function") pending.done(true);
						}).catch(function (failure) {
							store.setError("删除执行记录失败：" + (failure && failure.message ? failure.message : String(failure)));
							setRemoveRun(null);
						}).finally(function () {
							setBusy(false);
						});
					}
				}) : null,
				confirm !== null ? h(ConfirmDialog, {
					title: confirm.kind === "clearDemo"
						? "清空示例用例？"
						: (confirm.kind === "deleteCategory"
							? "删除层级「" + confirm.category + "」？"
							: (confirm.kind === "removeFromCategory"
								? "把这条用例移出层级？"
								: "删除这条用例？")),
					message: confirm.kind === "clearDemo"
						? "只会移除标记为示例的用例，你后来新建或编辑过的内容会保留。"
						: (confirm.kind === "deleteCategory"
							? "层级会消失，里面的用例退回「默认」层，一条都不会被删。"
							: (confirm.kind === "removeFromCategory"
								? "只是把它从这个层级移回「默认」，用例本身还在，不会被删除。"
								: "删除后无法恢复，右侧已打开的详情页也会变为空。")),
					detail: confirm.kind === "delete"
						? h("span", null, "即将删除：", h("b", null, confirm.record.title))
						: (confirm.kind === "removeFromCategory"
							? h("span", null, "移出层级：", h("b", null, confirm.record.title), "（用例保留）")
							: null),
					confirmLabel: confirm.kind === "clearDemo"
						? "清空示例"
						: (confirm.kind === "deleteCategory"
							? "删除层级"
							: (confirm.kind === "removeFromCategory" ? "移出层级" : "删除")),
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

			// 详情页可能属于“另一个会话”（右侧栏 keepMounted，用户已切走）。
			// 这时不能读当前共享 store 的记录，否则会显示成别会话的记录。
			var ownState = useState(null);
			// 重试按钮要能真的重新拉取：effect 的依赖里必须有它。
			var reloadState = useState(0);
			var reloadKey = reloadState[0];
			var setReloadKey = reloadState[1];
			var own = ownState[0];
			var setOwn = ownState[1];
			var loadedSid = store.loadedSessionId();
			var sameSession = sessionId !== "" && sessionId === loadedSid;

			useEffect(function () {
				// 进详情页时确保会话订阅已建立，并拉一次当前会话数据（供会话一致时复用）。
				ensureSessionSubscription(true);
				store.load().catch(function () {});
			}, []);

			// 详情页所属会话 ≠ 当前会话时，单独把这个会话的记录拉一遍。
			useEffect(function () {
				if (sessionId === "" || sameSession) {
					setOwn(null);
					return undefined;
				}
				var alive = true;
				setOwn({ status: "loading", records: [], error: "" });
				store.fetchRecords(sessionId).then(function (records) {
					if (!alive) return;
					setOwn({ status: "ready", records: records, error: "" });
				}).catch(function (failure) {
					if (!alive) return;
					setOwn({ status: "error", records: [], error: failure && failure.message ? failure.message : "加载失败" });
				});
				return function () {
					alive = false;
				};
			}, [sessionId, sameSession, reloadKey]);

			useEffect(function () {
				setEditing(false);
				setConfirm(false);
				setError("");
			}, [id]);

			var records = sameSession ? (snap.records || []) : (own && own.records ? own.records : []);
			var record = records.find(function (item) { return item.id === id; }) || null;

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
				store.update(id, values, sessionId)
					.then(function (updated) {
						// 会话不一致时 store 不会动快照，这里补一份本地更新，界面才不会显得没保存。
						if (!sameSession && updated) {
							setOwn(function (previous) {
								if (previous === null || !previous.records) return previous;
								return Object.assign({}, previous, {
									records: previous.records.map(function (item) { return item.id === id ? updated : item; })
								});
							});
						}
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
				store.remove(id, sessionId)
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

			// 当前会话还在加载，或者这条详情属于自己的另一个会话且还在拉取。
			var stillLoading = sameSession
				? (snap.status === "idle" || snap.status === "loading" || snap.status === "waiting-session")
				: (own !== null && own.status === "loading");
			if (stillLoading && record === null) {
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

			var loadError = sameSession ? snap.error : (own && own.error ? own.error : "");
			if (record === null && loadError) {
				return h("div", { className: "dp-detail" },
					h("div", { className: "dp-detail-empty" },
						h("h3", null, "加载失败"),
						h("p", null, loadError),
						h(Button, {
							size: "sm",
							onClick: function () {
								if (sameSession) { store.load(true).catch(function () {}); return; }
								// 换个 key 让负责请求的 effect 重新跑一遗（只 setOwn(null) 不会触发它）。
								setReloadKey(function (n) { return n + 1; });
							}
						}, "重试")
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
		var remote = null;
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
		 * 定位链路的诊断轨迹。
		 * 这些分支以前都是静默 return，出了问题在界面上完全看不出来。
		 * 现在统一记为错误提示，让"点了没反应"变成一句可读的原因。
		 */
		function codeTrace(message) {
			try {
				store.setError("查看源码：" + message);
			} catch {
				// store 不可用时不至于再抛。
			}
		}

		/**
		 * 取 dsh-better-sidebar 的客户端服务。
		 * 它不是 DSH 核心服务，未安装时 ctx.get 可能抛错，按需探测且不缓存，
		 * 这样插件后于本插件加载也能被接上。
		 *
		 * @param quiet 探测性质（比如等它加载完再订阅）时传 true：
		 *   此时不应往界面写红色错误，否则重试会反复弹“服务未注册”。
		 */
		function betterSidebarService(quiet) {
			var trace = quiet === true ? function () {} : codeTrace;
			if (clientCtx === null || typeof clientCtx.get !== "function") {
				trace("客户端上下文未就绪");
				return null;
			}
			try {
				var service = clientCtx.get("betterSidebar");
				// 订阅只需要 subscribeState；openTab 是打开标签用的，
				// 只暴露订阅能力的服务也算可用。
				if (!service || (typeof service.openTab !== "function" && typeof service.subscribeState !== "function")) {
					trace("better-sidebar 服务未注册（可能未启用）");
					return null;
				}
				return service;
			} catch (error) {
				trace("读取 betterSidebar 失败: " + (error instanceof Error ? error.message : String(error)));
				return null;
			}
		}

		/**
		 * 当前活跃会话 ID（拿不到就返回空串）。
		 * 每次都现取，不缓存 —— 插件加载顺序不确定，缓存会把“还没就绪”冻住。
		 */
		function activeSessionIdOf() {
			var service = betterSidebarService(true);
			if (service !== null && typeof service.getSnapshot === "function") {
				try {
					return service.getSnapshot().sessionId || "";
				} catch {
					// 快照读不到就按空处理。
				}
			}
			return "";
		}

		/** 会话订阅句柄（一个客户端实例只需一份）。 */
		var sessionSubscription = null;
		var sessionSubscribeTimer = null;
		var sessionSubscribeDeadline = 0;
		var SESSION_SUBSCRIBE_RETRY_MS = 400;
		var SESSION_SUBSCRIBE_WINDOW_MS = 30000;

		/**
		 * 幂等地建立“会话切换 → 重新加载”的订阅。
		 *
		 * better-sidebar 不是 DSH 核心服务，插件加载顺序不保证：它可能晚于本插件
		 * 注册，重启后尤其容易变。所以这里在拿不到服务时按短间隔重试一段窗口，
		 * 而不是探测一次就放弃（探测一次会让切会话静默地不再刷新）。
		 *
		 * @param retry 显式触发（比如用户打开面板）时传 true：重置重试窗口。
		 * @returns 是否已建立订阅。
		 */
		function ensureSessionSubscription(retry) {
			if (sessionSubscription !== null) return true;
			if (retry === true) {
				sessionSubscribeDeadline = 0;
				if (sessionSubscribeTimer !== null) {
					clearTimeout(sessionSubscribeTimer);
					sessionSubscribeTimer = null;
				}
			}
			var service = betterSidebarService(true);
			if (service === null || typeof service.subscribeState !== "function") {
				var now = Date.now();
				if (sessionSubscribeDeadline === 0) sessionSubscribeDeadline = now + SESSION_SUBSCRIBE_WINDOW_MS;
				if (sessionSubscribeTimer === null && now < sessionSubscribeDeadline) {
					sessionSubscribeTimer = setTimeout(function () {
						sessionSubscribeTimer = null;
						ensureSessionSubscription();
					}, SESSION_SUBSCRIBE_RETRY_MS);
				}
				return false;
			}
			try {
				var reconcile = function () {
					// 状态变化也包括开关标签、改设置，只有会话真变了才重拉，
					// 否则每次点标签都会打一次全量请求。
					if (activeSessionIdOf() !== store.loadedSessionId()) {
						store.load(true).catch(function () {});
					}
				};
				sessionSubscription = service.subscribeState(reconcile);
				// 订阅刚建立时立即对账一次：之前可能因为服务未就绪而停在等待态，
				// 不能只等下一次状态变化才把数据拉回来。
				reconcile();
			} catch (error) {
				return false;
			}
			sessionSubscribeDeadline = 0;
			return true;
		}

		/** 退订并清掉重试定时器（插件卸载时调）。 */
		function stopSessionSubscription() {
			if (sessionSubscribeTimer !== null) {
				clearTimeout(sessionSubscribeTimer);
				sessionSubscribeTimer = null;
			}
			sessionSubscribeDeadline = 0;
			if (sessionSubscription !== null) {
				var dispose = sessionSubscription;
				sessionSubscription = null;
				try {
					if (typeof dispose === "function") dispose();
				} catch {
					// 已经拆掉就算了。
				}
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
				if (typeof service.getTab === "function" && !service.getTab(BETTER_EDITOR_TAB)) {
					codeTrace("better-sidebar: editor 类型未注册");
					return false;
				}
				if (typeof service.isTabEnabled === "function" && !service.isTabEnabled(BETTER_EDITOR_TAB)) {
					codeTrace("better-sidebar: editor 被侧栏设置禁用");
					return false;
				}

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
				if (!scoped && !active) {
					codeTrace("better-sidebar: 拿不到会话 id（scope 与 store 都为空）");
					return false;
				}

				// scope 里带上 cwd：它让相对路径能被正确解析到工作区。
				// 统一成正斜杠：否则 Windows 反斜杠要靠它内部再转一次才对齐。
				var scope = scoped !== ""
					? { sessionId: scoped, cwd: toPosixPath(sessionCwd(scoped)) || undefined }
					: undefined;

				// 相对路径交给它自己按 scope.cwd 解析；本来就是绝对路径才原样传。
				var path = isAbsoluteCodePath(toPosixPath(target.path)) ? toPosixPath(target.path) : target.path;

				// 先用“同步握手”问一次已经挂着的编辑器：
				//   已打开过同一文件 → 由编辑器认领并跳转，面板不再新开面板；
				//   没人认领（该文件还没打开）→ 才用 target:"side" 落到右侧栏。
				var revealHandled = false;
				try {
					if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
						window.__dshPanelRevealHandled = false;
						window.dispatchEvent(new CustomEvent("dsh-data-panel:reveal-line", { detail: { path: path, line: target.line } }));
						revealHandled = window.__dshPanelRevealHandled === true;
					}
				} catch (error) { revealHandled = false; }
				if (!revealHandled) {
					// 告诉编辑器这次是面板发起的（启用居中/高亮），5 秒后自动回收。
					try { window.__dshPanelRevealPending = path; } catch (error) {}
					service.openTab({
						type: "editor",
						path: path,
						line: target.line,
						target: "side",
						reveal: true
					}, scope);
					try {
						if (typeof setTimeout === "function") {
							setTimeout(function () {
								if (window.__dshPanelRevealPending === path) window.__dshPanelRevealPending = null;
							}, 5000);
						}
					} catch (error) {}
				}
				// 成功就清掉可能残留的提示——这条路径以前会留一条红色横幅。
				store.setError("");
				return true;
			} catch (error) {
				codeTrace("better-sidebar 抛错: " + (error instanceof Error ? error.message : String(error)));
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

		/**
		 * 当前会话的工作区目录。
		 * 执行入口改成「把指令填进对话」以后，前端暂时没有调用点；
		 * 但执行结果要回流面板（读 .dsh/testcases/results.json）时还得靠它定位项目，故先保留。
		 */
		function runWorkspaceCwd() {
			var service = betterSidebarService();
			if (service !== null && typeof service.getSnapshot === "function") {
				try {
					var activeId = service.getSnapshot().sessionId;
					var activeCwd = sessionCwd(activeId);
					if (activeCwd) return activeCwd;
				} catch {}
			}
			if (sessions === null) return "";
			try {
				var byId = sessions.list.getSnapshot().byId || {};
				var cwds = [];
				Object.keys(byId).forEach(function (id) {
					var cwd = byId[id] && byId[id].cwd;
					if (typeof cwd === "string" && cwd && cwds.indexOf(cwd) === -1) cwds.push(cwd);
				});
				return cwds.length === 1 ? cwds[0] : "";
			} catch {
				return "";
			}
		}

		/** 主区正在看的会话 id（better-sidebar 记录的当前会话）；没装该插件时为空。 */
		function activeSessionId() {
			if (clientCtx === null || typeof clientCtx.get !== "function") return "";
			try {
				var service = clientCtx.get("betterSidebar");
				if (!service || typeof service.getSnapshot !== "function") return "";
				var snapshot = service.getSnapshot();
				return snapshot && typeof snapshot.sessionId === "string" ? snapshot.sessionId : "";
			} catch {
				return "";
			}
		}

		/**
		 * 执行指令要填进哪个会话：**面板自己所属的那个**。
		 *
		 * 面板显示的是哪个会话的用例，指令就要进哪个会话 —— 否则 A 会话的用例
		 * 会被填进 B 会话的对话，模型在 B 的工作区里跑，跑的就不是这些用例了。
		 * 面板所属会话取宿主 slot 注入的 sessionId；拿不到时才退回活跃会话。
		 */
		function panelSessionId(props) {
			if (props && typeof props.sessionId === "string" && props.sessionId !== "") return props.sessionId;
			return activeSessionId();
		}

		/**
		 * 取某个会话的输入框服务（conversation.input）。
		 * conversation 是**会话作用域**服务，必须先经 sessions.scope(id) 拿到该会话的上下文。
		 */
		function draftHubOf(sessionId) {
			if (typeof sessionId !== "string" || sessionId === "") return null;
			// ① 会话作用域：conversation 是按会话取的服务，正常路径走这条。
			if (sessions !== null && typeof sessions.scope === "function") {
				try {
					var actx = sessions.scope(sessionId);
					var scoped = actx && typeof actx.get === "function" ? actx.get("conversation") : null;
					if (scoped && scoped.input) return scoped.input;
				} catch {
					// 落到下一级。
				}
			}
			// ② 根上下文兜底：input.shell(id) 内部自己按 id 找 binding，不依赖调用方作用域。
			if (clientCtx !== null && typeof clientCtx.get === "function") {
				try {
					var root = clientCtx.get("conversation");
					if (root && root.input) return root.input;
				} catch {
					return null;
				}
			}
			return null;
		}

		var DRAFT_FILLED = "已把执行指令填进对话输入框（原有草稿会被替换），切到对话按回车发送。";
		var DRAFT_APPENDED = "已把执行指令追加到输入框末尾；切到对话按回车发送。";

		/**
		 * 把一段指令预填进会话输入框，**不发送**。
		 *
		 * 为什么不再自己跑测试：测试文件与测试目标原先靠 client.js 里写死的
		 * Python 路径猜，文件不存在就直接 ENOENT。交给会话里的模型，
		 * 它自己能按宿主生成的命令执行，输出由 runner 写成日志与结果。
		 *
		 * 两条通道都在插件边界内：
		 *   ① conversation.input.requestDraftInitialization(binding, { prompt })
		 *      官方「程序化预填草稿」入口，已有草稿默认保留（dsh-client-ui-workspace 同款）
		 *   ② shell.appendDraft(text)  直接写输入框 shell，草稿为空时它内部等价 setDraft
		 * 服务未就绪或版本不同就逐级退让，最后给一句能读懂的失败原因，
		 * 不要变成「点了没反应」。
		 */
		function prefillDraft(sessionId, text) {
			var hub = draftHubOf(sessionId);
			if (hub === null) return { ok: false, message: "当前会话还没就绪，切到对话再点一次。" };

			// 先走官方预填接口：它会在“输入框正在发送”时返回 blocked —— 这是覆盖行为的闸门。
			// 只有它说“已有草稿（preserved）”时，才接着用 setDraft 覆盖。
			var shell = null;
			try {
				if (typeof hub.shell === "function") shell = hub.shell(sessionId);
			} catch {
				shell = null;
			}

			// 官方「程序化预填草稿」入口：它负责“正在发送”的闸门（返回 blocked）。
			// 拿不到这个入口就不能确定当前是否在发送 —— 这时候不强行覆盖，
			// 否则可能在用户发消息的瞬间把草稿改掉。
			var officialUsable = false;
			if (sessions !== null && typeof hub.requestDraftInitialization === "function" && typeof sessions.binding === "function") {
				try {
					var binding = sessions.binding(sessionId);
					if (binding) {
						officialUsable = true;
						var outcome = hub.requestDraftInitialization(binding, { prompt: text, whenDraftExists: "keep" });
						if (outcome === "applied") return { ok: true, message: DRAFT_FILLED };
						if (outcome === "blocked") return { ok: false, message: "输入框正在发送中，等这一轮结束再点。" };
						// "preserved" = 用户已经写了草稿。按约定这里要覆盖，走下面的 setDraft。
					}
				} catch {
					officialUsable = false;
				}
			}

			// 覆盖写：执行指令会替掉原有草稿（这是约定好的行为）。
			// 但只有在官方接口确认过“不在发送中”后才允许 —— 没有这个闸门就不覆盖。
			if (officialUsable && shell !== null && typeof shell.setDraft === "function") {
				try {
					shell.setDraft(text);
					return { ok: true, message: DRAFT_FILLED };
				} catch (error) {
					return { ok: false, message: "填进输入框失败：" + (error instanceof Error ? error.message : String(error)) };
				}
			}

			// 拿不到“是否在发送”的闸门就不写，把原因说清楚，而不是冒险改用户草稿。
			if (!officialUsable) {
				return { ok: false, message: "当前 DSH 版本不支持安全地预填草稿（拿不到发送状态），请手动复制指令后再发送。" };
			}

			return { ok: false, message: "当前 DSH 版本不支持把指令填进输入框。" };
		}

		/**
		 * 执行指令里“怎么跑”的那一段。
		 *
		 * 关键：命令由宿主生成（已含项目目录、会话资产目录、runId），模型只需原样执行。
		 * 日志由 runner 边跑边写，不再靠模型回传 —— 漏调/超时/超长都会丢。
		 */
		function runInstruction(prep) {
			var framework = prep && prep.framework ? prep.framework : "测试框架";
			var lines = [
				"执行方式（只需要跑下面这一条命令，不要自己另拼其他测试命令）：",
				"",
				"    " + prep.command,
				"",
				"这条命令会自己做完下面几件事，不需要你另外处理：",
				"1. 把 " + framework + " 的原始输出实时打印出来（我能直接看到）；",
				"2. 把完整输出写进本会话的 runs/" + prep.runId + "/run.log；",
				"3. 结束时写 result.json（退出码 / 通过失败数 / 耗时 / 状态）。",
				"",
				"要求：",
				"1. 原样执行上面的命令，不要新建或修改测试文件，也不要改成跑别的用例。",
				"2. 跑完后先按 Skill 的 Step 6，用本次 runId 生成 Word 报告到 reports/<runId>/（单条执行也要，文件名带 caseId）；如果项目还没配置报告模板，就明确告诉我缺什么，不要跳过不说。然后再总结。",
				"3. 总结时用一两句话说明：通过还是失败、失败的是哪条用例、失败原因是什么。",
				"4. 如果命令本身起不来（找不到运行时、测试文件缺失、权限问题），把报错原文告诉我，不要自己另找测试文件重跑。",
				"5. 如果命令告诉你“测试文件在准备后被修改”，停下来告诉我要重新点一次执行，不要自己重跑。"
			];
			if (Array.isArray(prep.missingTestFunc) && prep.missingTestFunc.length > 0) {
				lines.push("6. 注意：以下用例没有关联测试函数/测试名，这次不会被执行：" + prep.missingTestFunc.join("、"));
			}
			return lines.join("\n");
		}
		/** 单条用例的执行指令：说清是什么用例，然后给出宿主编好的命令。 */
		function runPrompt(record, sessionId, prep) {
			var typeLabel = TEST_TYPES[record.testType] ? TEST_TYPES[record.testType].label : "测试";
			var lines = ["请执行测试用例 " + record.caseId + "（" + record.title + "）这条" + typeLabel + "用例。", ""];
			if (record.description) lines.push("用例说明：" + record.description);
			if (record.input) lines.push("输入：" + record.input);
			if (record.expected) lines.push("预期输出：" + record.expected);
			if (lines.length > 2) lines.push("");
			lines.push(runInstruction(prep));
			return lines.join("\n");
		}

		/**
		 * 「全部执行」的执行指令。
		 *
		 * 范围就是**本会话用例面板里的这些用例**；命令由宿主拼好，只跑这些测试函数。
		 *
		 * @param records 本会话面板里的用例。
		 * @param prep 宿主准备的结果（含命令与 runId）。
		 */
		function runAllPrompt(records, sessionId, prep) {
			var list = Array.isArray(records) ? records : [];
			if (list.length === 0) {
				return ["当前面板里还没有用例，先新增或用工作流生成用例后再执行。"].join("\n");
			}
			var named = list.map(function (record) {
				return "- " + record.caseId + "（" + record.title + "）";
			});
			return [
				"请执行本会话用例面板里的全部用例（共 " + list.length + " 条）：",
				""
			].concat(named).concat([
				"",
				runInstruction(prep)
			]).join("\n");
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


		/** 把 result.json 摘要成一句可读的话（状态 / 通过失败 / 耗时）。 */

		/**
		 * 用系统默认程序打开一个已存在的文件（报告）。
		 *
		 * 面板不内联渲染 docx：交给宿主打开。打不开就把原因说清楚，
		 * 而不是“点了没反应”。
		 */
		function docxOf(detail) {
			if (!detail || !Array.isArray(detail.files)) return null;
			for (var index = 0; index < detail.files.length; index++) {
				var file = detail.files[index];
				if (file && typeof file.name === "string" && /\.docx$/i.test(file.name) && file.path) return file;
			}
			return null;
		}

		/** 优先把报告开在右侧栏（better-sidebar 会把 docx 交给 DSH 的文档预览）。 */
		function openReportInSidebar(path, sessionId) {
			var service = betterSidebarService(true);
			if (service === null || typeof service.openFile !== "function") return false;
			if (typeof sessionId !== "string" || sessionId === "") return false;
			try {
				var scope = { sessionId: sessionId };
				var cwd = toPosixPath(sessionCwd(sessionId));
				if (cwd !== "") scope.cwd = cwd;
				var title = path.split(/[\\/]/).pop();
				service.openFile(scope, toPosixPath(path), title);
				store.setError("");
				return true;
			} catch (error) {
				codeTrace("better-sidebar 打开报告失败: " + (error instanceof Error ? error.message : String(error)));
				return false;
			}
		}

		/** 打开报告：优先走 host 的 /data-panel/open（不依赖前端 remote/workspaces）。 */
		function openReportFile(path, sessionId, onOpened) {
			if (typeof path !== "string" || path === "") {
				store.setError("报告文件路径为空");
				return;
			}
			if (openReportInSidebar(path, sessionId)) {
				if (typeof onOpened === "function") onOpened();
				return;
			}
			if (typeof sessionId === "string" && sessionId !== "") {
				callApi("/data-panel/open", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ sessionId: sessionId, cwd: cwdOf(sessionId), path: path }),
				}).then(function () {
					store.setError("");
					if (typeof onOpened === "function") onOpened();
				}).catch(function (failure) {
					// 旧宿主没有 /data-panel/open 时，退回原来的打开方式。
					if (failure && failure.message && failure.message.indexOf("HTTP 404") !== -1) {
						fallbackOpenReportFile(path, onOpened);
						return;
					}
					store.setError("打开报告失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
				return;
			}
			fallbackOpenReportFile(path, onOpened);
		}
		function fallbackOpenReportFile(path, onOpened) {
			if (typeof path !== "string" || path === "") {
				store.setError("报告文件路径为空");
				return;
			}
			// 优先用 DSH 官方的“用系统默认程序打开”RPC（openWorkspacePath）。
			// 面板里的 workspaces.openPath 在部分宿主上不存在/不落原生应用，会表现为点了没反应。
			var remoteSession = remote !== null && remote.session ? remote.session : null;
			if (remoteSession !== null && typeof remoteSession.openWorkspacePath === "function") {
				try {
					remoteSession.openWorkspacePath({ path: path }).then(function (result) {
						if (result && (result.ok === false || result.opened === false)) {
							store.setError("打开报告失败，请确认文件还存在：" + path);
							return;
						}
						store.setError("");
						if (typeof onOpened === "function") onOpened();
					}).catch(function (error) {
						store.setError("打开报告失败：" + (error && error.message ? error.message : String(error)));
					});
				} catch (error) {
					store.setError("打开报告失败：" + (error instanceof Error ? error.message : String(error)));
				}
				return;
			}
			if (workspaces === null || typeof workspaces.openPath !== "function") {
				store.setError("当前环境不支持用系统默认程序打开：" + path);
				return;
			}
			try {
				workspaces.openPath(path);
				store.setError("");
				if (typeof onOpened === "function") onOpened();
			} catch (error) {
				store.setError("打开失败：" + (error instanceof Error ? error.message : String(error)));
			}
		}
		function summarizeRun(result) {
			if (!result || typeof result !== "object") return "";
			var statusText = {
				passed: "全部通过",
				failed: "有失败",
				"build-failed": "构建失败",
				timeout: "执行超时",
				interrupted: "执行被中断",
				"no-cases": "本会话没有用例",
				"no-case": "找不到这条用例",
				"no-test-file": "找不到测试代码",
				"no-tests": "没有收集到测试",
				running: "执行中",
			}[result.status] || String(result.status || "未知");
			var parts = [statusText];
			if (typeof result.passed === "number" || typeof result.failed === "number") {
				parts.push("通过 " + (result.passed || 0) + " / 失败 " + (result.failed || 0));
			}
			if (typeof result.durationMs === "number") {
				parts.push((result.durationMs / 1000).toFixed(1) + " 秒");
			}
			if (typeof result.startedAt === "string" && result.startedAt) {
				parts.push(result.startedAt);
			}
			var line = parts.join(" · ");
			if (typeof result.note === "string" && result.note) line += "\n" + result.note;
			return line;
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
			if (better !== null && typeof better.openFile === "function" && sessionId !== "") {
				try {
					var codeScope = { sessionId: sessionId };
					var codeCwd = toPosixPath(sessionCwd(sessionId));
					if (codeCwd !== "") codeScope.cwd = codeCwd;
					better.openFile(codeScope, toPosixPath(absolute || target.path), String(target.path).split(/[\\/]/).pop(), { line: target.line, lineEnd: target.end });
					store.setError("");
					return true;
				} catch (error) {
					// 落到下一级。
				}
			}

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

		/**
		 * 主区 tab 行右边的「面板」按钮。
		 *
		 * DSH 的 tab 行（`[data-conversation-tabs]`）只渲染宿主自己注册的 view tab，
		 * 没有给第三方插按钮的 slot——`conversation.view` 注册出来的一定是 tab，
		 * 而我们需要的是「点了只开右侧栏、不切主区」的按钮。所以这里直接往
		 * tab 行末尾追加一个原生按钮，并用 MutationObserver 跟随 React 重渲染。
		 *
		 * 幂等：同一行里已经存在按钮就不再插；点击永远只调 openBoardTab()，
		 * 面板已经在右侧栏时 openTab 自身会聚焦而不是新开，表现就是"再点没反应"。
		 */
		var panelButtonObserver = null;
		var panelButtonTimer = null;
		var panelButtonPoller = null;

		function openBoardTab() {
			if (sidebarRight === null || typeof sidebarRight.openTab !== "function") {
				store.setError("右侧栏服务尚未就绪，请刷新页面后再试。");
				return false;
			}
			try {
				sidebarRight.openTab("data-panel-board", { params: {} });
				store.setError("");
				return true;
			} catch (error) {
				store.setError(error instanceof Error ? error.message : "打开右侧栏失败");
				return false;
			}
		}

		function createPanelButton() {
			var button = document.createElement("button");
			button.type = "button";
			button.className = "dp-tab-btn";
			button.textContent = "面板";
			button.title = "打开测试用例面板";
			button.setAttribute("aria-label", "打开测试用例面板");
			button.addEventListener("click", function (event) {
				event.preventDefault();
				event.stopPropagation();
				openBoardTab();
			});
			return button;
		}

		function syncPanelButton() {
			if (typeof document === "undefined") return 0;
			var rows = [];
			// 只认宿主给会话 tab 行打的标记，app.asar 的 viewTabs 同时带 role="tablist" 和
			// data-conversation-tabs，一个选择器就够。
			// 原先还兜底收集所有 [role="tablist"]，结果把按钮也插进了设置页/插件市场那排 tab，故删除。
			var marked = document.querySelectorAll("[data-conversation-tabs]");
			for (var m = 0; m < marked.length; m += 1) rows.push(marked[m]);
			var inserted = 0;
			for (var i = 0; i < rows.length; i += 1) {
				var row = rows[i];
				if (row.querySelector(".dp-tab-btn") !== null) continue;
				row.appendChild(createPanelButton());
				inserted += 1;
			}
			return inserted;
		}

		function schedulePanelButtonSync() {
			if (panelButtonTimer !== null) return;
			panelButtonTimer = setTimeout(function () {
				panelButtonTimer = null;
				try {
					syncPanelButton();
				} catch {
					// 页面结构异常时静默跳过，不影响插件其它功能。
				}
			}, 60);
		}

		/**
		 * 起两条路互补：
		 *  - MutationObserver：React 重建 tab 行时立刻补回；
		 *  - 低频轮询：兜住"插件先于 tab 行挂载"以及 observer 漏事件的情况。
		 * 轮询只在还没插上按钮时插入，插上后就是一次 querySelectorAll 的开销。
		 */
		function startPanelButton() {
			if (typeof document === "undefined") return;
			try {
				syncPanelButton();
			} catch {
				// 忽略首帧异常，交给下面的轮询。
			}
			if (typeof MutationObserver !== "undefined" && document.body !== null) {
				panelButtonObserver = new MutationObserver(schedulePanelButtonSync);
				panelButtonObserver.observe(document.body, { childList: true, subtree: true });
			}
			if (panelButtonPoller === null) {
				panelButtonPoller = setInterval(function () {
					try {
						syncPanelButton();
					} catch {
						// 单次失败不打断轮询。
					}
				}, 1000);
			}
		}

		function stopPanelButton() {
			if (panelButtonObserver !== null) {
				panelButtonObserver.disconnect();
				panelButtonObserver = null;
			}
			if (panelButtonTimer !== null) {
				clearTimeout(panelButtonTimer);
				panelButtonTimer = null;
			}
			if (panelButtonPoller !== null) {
				clearInterval(panelButtonPoller);
				panelButtonPoller = null;
			}
			if (typeof document === "undefined") return;
			var buttons = document.querySelectorAll(".dp-tab-btn");
			for (var i = 0; i < buttons.length; i += 1) {
				if (buttons[i].parentNode !== null) buttons[i].parentNode.removeChild(buttons[i]);
			}
		}

		var inject = ["slots"];

		function apply(ctx) {
			ensureStyles();
			if (typeof window !== "undefined") {
				var previousOpenPanel = window.__dshOpenDataPanel;
				window.__dshOpenDataPanel = openBoardTab;
				ctx.effect(function () {
					return function () {
						if (window.__dshOpenDataPanel === openBoardTab) {
							if (previousOpenPanel === undefined) delete window.__dshOpenDataPanel;
							else window.__dshOpenDataPanel = previousOpenPanel;
						}
					};
				}, "dsh-data-panel: open board from workflow");
			}

			// betterSidebar 是第三方服务（dsh-better-sidebar 注册），按需用 ctx.get 取，
			// 故这里只保留上下文引用，不写进 inject——未装该插件时 inject 会一直停等。
			clientCtx = ctx;
			ctx.effect(function () {
				return function () {
					clientCtx = null;
				};
			}, "dsh-data-panel: client context");

			// 会话跟踪：订阅 better-sidebar 的状态变化，
			// 用户切换会话时自动清空旧数据并加载新会话的用例。
			//
			// 关键：apply 执行时 better-sidebar 很可能还没注册（插件加载顺序不固定，
			// 重启后尤其明显）。早期版本在这里只探测一次，拿不到就不订阅 ——
			// 于是切会话不再自动刷新，旧会话的用例一直被当成当前会话的。
			// 现在改成可重试的幂等订阅，面板挂载时也会再催一次。
			ctx.effect(function () {
				ensureSessionSubscription();
				return function () {
					stopSessionSubscription();
				};
			}, "dsh-data-panel: session subscription");
			// getSessionId 是动态取值：哪个服务实例在、哪个会话就是真的，不受加载顺序影响。
			store.setSessionId(activeSessionIdOf);

			// tab 行的「面板」按钮：挂载时插、卸载时收。
			ctx.effect(function () {
				startPanelButton();
				return function () {
					stopPanelButton();
				};
			}, "dsh-data-panel: panel tab button");

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
				// 面板本身也要进右侧栏：conversation.view 只能渲染在主区，
				// 想在右侧栏出现就必须作为独立 tab 类型注册。
				sub.effect(function () {
					return sub.sidebarRightTabs.register({
						id: "data-panel-board",
						kind: "data-panel-board",
						title: function () { return "测试用例"; },
						keepMounted: true
					});
				}, "dsh-data-panel: board tab type");
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

			ctx.inject(["remote"], function (sub) {
				remote = sub.remote || null;
				sub.effect(function () {
					return function () {
						remote = null;
					};
				}, "dsh-data-panel: remote service");
			});

			// 主区只保留宿主自己的三个 tab（对话 / 轨迹 / 工作流）。
			// 「面板」不再注册成 conversation.view：那个 slot 只能产出**tab**，
			// 而我们要的是一个放在「工作流」右边的**按钮**（点了开右侧栏，
			// 不切换主区视图）。tab 行没有给第三方的插槽，只能 DOM 注入，
			// 见 startPanelButton()。
			ctx.slots.inject("sidebar.right.pane.tab", function () {
				return ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: "data-panel-detail",
					inject: function () {
						return { store: store, openCode: openCode };
					}
				}, DetailBody);
			});

			// 面板正文（右侧栏里的「测试用例」tab）。
			// 窄容器下表格会有横向滚动，见 .dp-card-scroll。
			ctx.slots.inject("sidebar.right.pane.tab", function () {
				return ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: "data-panel-board",
					// 宿主 slot 的 inject 第一个参数就是会话 id（dsh-client-ui-renderer 的 runInject），
					// 以前这里整个丢掉了，执行按钮就不知道该把指令填进哪个会话。
					inject: function (sessionId) {
						var ownSessionId = typeof sessionId === "string" ? sessionId : "";
						return {
							// 详情 tab 必须带上本面板的会话：不带的话详情页拿到的 sessionId 是空串，
							// 会被判成「另一个会话」，而那条分支在 sessionId === "" 时直接不发请求，
							// 于是 record 恒为 null，界面上永远是「用例不存在」。
							openDetail: function (id) { openDetail(id, ownSessionId); },
							openCode: function (ref, refSessionId) { openCode(ref, refSessionId || ownSessionId); },
							sessionId: ownSessionId,
							dock: true
						};
					}
				}, DataPanelView);
			});
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		exports.__test = {
			store: store,
			parseCodeRef: parseCodeRef,
			openCode: openCode,
			prefillDraft: prefillDraft,
			runPrompt: runPrompt,
			runAllPrompt: runAllPrompt,
			panelSessionId: panelSessionId,
			/** Test-only: 注入打开代码所需的服务替身（生产路径由 ctx.inject 填充）。 */
			setCodeServices: function (next) {
				var source = next || {};
				sidebarRight = source.sidebarRight === undefined ? null : source.sidebarRight;
				sidebarRightTabs = source.sidebarRightTabs === undefined ? null : source.sidebarRightTabs;
				sessions = source.sessions === undefined ? null : source.sessions;
				workspaces = source.workspaces === undefined ? null : source.workspaces;
				// betterSidebar 走 ctx.get 动态取，替身挂在假上下文上。
				var noStub = source.betterSidebar === undefined ? source.conversation === undefined : false;
				clientCtx = noStub ? null : {
					get: function (name) {
						if (name === "betterSidebar") return source.betterSidebar;
						if (name === "conversation") return source.conversation;
						return undefined;
					}
				};
			},
			openBoardTab: openBoardTab,
			syncPanelButton: syncPanelButton,
			stopPanelButton: stopPanelButton,
			DataPanelView: DataPanelView,
			DetailView: DetailView,
			DetailBody: DetailBody,
			RecordFormModal: RecordFormModal,
			ReportModal: ReportModal,
			LogButton: LogButton,
			LogModal: LogModal,
			LogButton: LogButton,
			LogModal: LogModal,
			ReportModal: ReportModal,
			RunRecords: RunRecords,
			RunReportModal: RunReportModal,
			CategoryPrompt: CategoryPrompt,
			runStateOf: runStateOf,
			CodeModal: CodeModal,
			Pager: Pager
		};
		return module.exports;
	}
});
