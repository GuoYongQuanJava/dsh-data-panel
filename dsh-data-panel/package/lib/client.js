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
.dp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.dp-header > :first-child { flex: 0 0 auto; }
.dp-title { margin: 5px 0 5px; font-size: 24px; font-weight: 650; letter-spacing: -.015em; line-height: 1.25; }
.dp-subtitle { margin: 0; max-width: 620px; color: var(--dp-text2); font-size: 13px; }
.dp-stats { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; min-width: 0; max-width: 100%; margin-left: auto; }
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
 *
 * 上一版是 26px / -5px，用户反馈「再往下放、再大一点」，所以：
 * 按钮放大到 30px、图标放大到 19px，负 margin 收到 -2px（整体比原来低 3px）。
 */
.dp-expand-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 30px; height: 30px; margin-top: -2px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s, transform .14s; }
.dp-expand-btn:hover { background: var(--dp-bg3); color: var(--dp-text); }
.dp-expand-btn[data-open="true"] { color: var(--dp-text); transform: rotate(90deg); }
.dp-expand-btn:focus-visible { outline: 2px solid var(--dp-brand); outline-offset: 1px; }
/* 展开出来的执行记录单元格。 */
.dp-run-cell { padding: 0; background: var(--dp-bg2); }
.dp-run-panel { padding: 10px 12px 12px; }
.dp-run-scroll { overflow: auto; }
.dp-run-scroll .dp-run-table thead th { position: sticky; top: 0; z-index: 1; background: var(--dp-bg2); }
.dp-run-table th { padding: 5px 8px; border-bottom: 1px solid var(--dp-border); color: var(--dp-text3); font-weight: 500; text-align: center; white-space: nowrap; }
/*
 * 表头与内容对齐：
 *   短列（# / 时间 / 结果 / 操作）：th 和 td 都居中，天然对齐。
 *   「实际输出」：**表头居中、内容靠左** —— 长文本左对齐才好读，
 *     而表头只有四个字，放在这一列（很宽）的正中间才像正常表头。
 *     两者对齐基准不同是刻意的，不是 bug。
 *
 * 宽度策略（实测四种写法后的结论）：
 * 表格整体 width:100% 铺满整行，配合 table-layout:fixed 让各列严格按
 * 指定宽度分配。之前不给「实际输出」设宽、靠 width:1% 想「按内容取宽」
 * 是无效的 —— 表格剩余空间仍会全部塞给它，内容一短右侧就是一大片空白。
 * fixed 布局下必须显式给百分比，剩余空间才按比例摊开。
 */
.dp-run-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 12px; }
.dp-run-table th.dp-grow { width: 42%; }
/*
 * 报告弹窗那张表（测试函数 / 说明）仍然整列左对齐 —— 两列都是长文本，
 * 表头也左对齐才不会和内容错开。
 * 执行记录表的「实际输出」不用这条：按用户要求是「表头居中、内容靠左」。
 */
.dp-run-table th.dp-left { text-align: left; }
.dp-run-table td { padding: 5px 8px; border-bottom: 1px solid var(--dp-border2); color: var(--dp-text2); vertical-align: middle; text-align: center; }
.dp-run-table td.dp-left { text-align: left; }
.dp-run-table tr:last-child td { border-bottom: 0; }
/* 操作列内容也居中，和它的表头对齐（表头已经是 text-align:center）。 */
.dp-run-ops { display: flex; justify-content: center; gap: 2px; }
/* 「实际输出」单元格里的原始文本。挂在 dp-left 上，和表头的对齐类保持一致。 */
.dp-run-table td.dp-left pre { margin: 0; max-height: 72px; overflow: auto; white-space: pre-wrap; word-break: break-all; font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 11px; line-height: 1.5; color: var(--dp-text2); }
.dp-run-state { display: inline-block; padding: 0 7px; border-radius: 5px; font-size: 11px; line-height: 18px; }
.dp-run-state[data-tone="ok"] { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.dp-run-state[data-tone="bad"] { background: color-mix(in srgb, var(--dp-danger) 12%, transparent); color: var(--dp-danger); }
.dp-run-state[data-tone="idle"] { background: var(--dp-bg3); color: var(--dp-text3); }
.dp-run-empty { padding: 14px 10px; color: var(--dp-text3); font-size: 12px; text-align: center; }
/*
 * 「等这一轮对话出结果」的提示条。
 * 对话结束前保留旧执行记录，用计时提示当前仍在等待。
 */
.dp-run-wait { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; padding: 7px 10px; border: 1px solid color-mix(in srgb, var(--dp-brand) 30%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--dp-brand) 6%, transparent); color: var(--dp-text); font-size: 12px; font-variant-numeric: tabular-nums; }
.dp-run-wait-dot { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; background: var(--dp-brand); animation: dp-pulse 1.1s ease-in-out infinite; }
@keyframes dp-pulse { 0%, 100% { opacity: .35; transform: scale(.85); } 50% { opacity: 1; transform: scale(1); } }
.dp-run-hint { margin: 8px 0 0; color: var(--dp-text3); font-size: 11px; }
/* 「查看」弹窗要更宽：报告是长文本 + 表格。 */
.dp-modal.dp-modal-wide { width: min(1080px, 92vw); max-width: none; height: 80vh; display: flex; flex-direction: column; }
.dp-modal.dp-modal-wide .dp-modal-body { flex: 1 1 auto; overflow: auto; }
/* ── 用例层级：左栏 + 右侧内容 ── */
/*
 * 左栏高度跟着表格走：行数多时被压到表格高度并内部滚动，行数少时就是内容高度。
 * max-height 由 JS 量出来写进 style（见 CategorySidebar），这里只给一个兜底值。
 * 底部固定一条 .dp-cat-pager，列表区自己滚动，两者互不影响。
 */
.dp-board { display: flex; align-items: flex-start; gap: 12px; margin-top: 4px; }
.dp-sidebar { display: flex; flex-direction: column; flex: 0 0 auto; width: 128px; max-height: 62vh; padding: 8px 6px; border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); transition: width .16s ease, padding .16s ease; }
/* 层级列表：唯一可滚动区，撑满除表头/分页外的剩余高度。 */
.dp-cat-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
/* 分页条：不分页时整条不渲染，所以不会留空。 */
.dp-cat-pager { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 4px; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--dp-border2); }
.dp-cat-pager-btn { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s; }
.dp-cat-pager-btn:hover:not(:disabled) { background: var(--dp-bg3); color: var(--dp-text); }
.dp-cat-pager-btn:disabled { opacity: .4; cursor: not-allowed; }
.dp-cat-pager-page { flex: 1 1 auto; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; text-align: center; white-space: nowrap; }
.dp-sidebar-head { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }
.dp-main { flex: 1 1 auto; min-width: 0; }
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
/* 只有「性能测试」保留一点暖色，其余测试类型统一使用品牌色。 */
.dp-type[data-tone="perf"] { border-color: color-mix(in srgb, var(--dp-warning) 36%, transparent); background: color-mix(in srgb, var(--dp-warning) 7%, transparent); color: var(--dp-warning); }
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
 * 工具栏尾部三个按钮：全部执行 / 报告 / 日志。
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
 * 三个按钮与工具栏里的「全部类型」下拉（.dp-select）同一套观感：
 * 细边框 + 主题背景 + 主题文字色，尺寸也取 36px，同排基线才齐。
 *
 * 原来这里是「1px 黑边框 + 白底黑字」，在浅色主题下比旁边的下拉重得多，
 * 一条工具栏里两种视觉强度，看着像两套控件拼起来的。
 * 唯一的颜色强调留给「新增用例」（primary，蓝底白字）。
 */
.dp-run-all-btn,
.dp-report-btn,
.dp-log-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	height: 36px;
	padding: 0 14px;
	border: 1px solid var(--dp-border);
	border-radius: 10px;
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	line-height: 1;
	white-space: nowrap;
	cursor: pointer;
	background: var(--dp-bg);
	color: var(--dp-text);
	transition: background .15s, border-color .15s, box-shadow .15s;
}
.dp-run-all-btn:disabled,
.dp-report-btn:disabled,
.dp-log-btn:disabled { opacity: .55; cursor: not-allowed; }
.dp-run-all-btn:hover:not(:disabled),
.dp-report-btn:hover:not(:disabled),
.dp-log-btn:hover:not(:disabled),
.dp-run-all-btn:active:not(:disabled),
.dp-report-btn:active:not(:disabled),
.dp-log-btn:active:not(:disabled) { background: var(--dp-bg2); border-color: var(--dp-border); }
/* focus 与 .dp-select:focus 一致，键盘操作时同一套高亮 */
.dp-run-all-btn:focus-visible,
.dp-report-btn:focus-visible,
.dp-log-btn:focus-visible {
	outline: none;
	border-color: var(--dp-brand);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent);
}
/*
 * 集成测试的按钮同样对齐「全部类型」：细边框 + 主题色 + 13px 常规字重。
 * 这里做的是「同款」而不是引用 —— 选择器作用于 .it-root 内部，不污染单元测试。
 * primary（新增用例）保持蓝底白字，是工具栏里唯一的颜色强调。
 */
.it-root .dp-btn {
	border: 1px solid var(--dp-border);
	border-radius: 10px;
	background: var(--dp-bg);
	color: var(--dp-text);
	font-weight: 500;
	height: 32px;
	padding: 0 12px;
	font-size: 13px;
	line-height: 1;
	white-space: nowrap;
}
.it-root .dp-btn:hover:not(:disabled) { background: var(--dp-bg2); border-color: var(--dp-border); }
.it-root .dp-btn:active:not(:disabled) { background: var(--dp-bg2); }
.it-root .dp-btn:focus-visible {
	outline: none;
	border-color: var(--dp-brand);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent);
}
.it-root .dp-btn:disabled { opacity: .55; cursor: not-allowed; }
/* 尺寸对齐工具栏里的下拉/搜索（36px 一行看起来才齐） */
.it-toolbar .dp-btn { height: 36px; }
.it-root .dp-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }
/*
 * docked（右侧栏）形态下 .dp-root.dp-docked .dp-btn 会把按钮压成 32px / 12px，
 * 比同排的搜索框和「全部类型」下拉（36px / 13px）矮一截，一行里高低不齐。
 * 那条规则是三个 class，优先级高于上面这些单类选择器，所以这里用更长的
 * 选择器把「工具栏这一行」重新拉回 36px —— 只作用于工具栏，弹窗里的按钮不受影响，
 * 批量条里的 .dp-btn-sm 也不受影响（不在工具栏内）。
 */
.dp-root.dp-docked .dp-toolbar .dp-btn { height: 36px; padding: 0 14px; font-size: 13px; }
/*
 * 工具栏里的 ghost 按钮（刷新等）默认是「透明边框 + 透明底色」，和「全部类型」下拉
 * 摆在一起就是一个没框的字。这里只收敛工具栏内的 ghost，弹窗里的取消按钮保持原样。
 */
.dp-toolbar .dp-btn-ghost { border-color: var(--dp-border); background: var(--dp-bg); color: var(--dp-text); }
.dp-toolbar .dp-btn-ghost:hover { background: var(--dp-bg2); border-color: var(--dp-border); }
/* 工具栏内的类型下拉圆角与按钮/搜索框取齐（.dp-input,.dp-select 通用规则给的是 9px） */
.dp-toolbar .dp-select { border-radius: 10px; }
/*
 * 层级只在 primary 上体现，其余全部走上面那条细边框基样式：
 *   primary  —— 新增用例，蓝底白字，工具栏里唯一的颜色强调
 *   ghost    —— 刷新 / 全部执行 / 总体报告 / 取消 …… 与「全部类型」下拉同款
 *   danger   —— 删除，只把边框和文字染成危险色，尺寸风格仍是细边框
 * 之前 primary 和 ghost 都被压成白底黑字，层级全靠边框粗细区分，
 * 结果整个工具栏没有一个可扫读的主操作。
 */
.it-root .dp-btn-primary { border-color: var(--dp-brand); background: var(--dp-brand); color: var(--dp-on-brand); }
.it-root .dp-btn-primary:hover:not(:disabled) { background: var(--dp-brand); border-color: var(--dp-brand); filter: brightness(1.06); }
.it-root .dp-btn-ghost { border-color: var(--dp-border); background: var(--dp-bg); color: var(--dp-text); }
.it-root .dp-btn-ghost:hover:not(:disabled) { background: var(--dp-bg2); border-color: var(--dp-border); }
.it-root .dp-btn-danger { border-color: color-mix(in srgb, var(--dp-danger) 30%, transparent); background: var(--dp-bg); color: var(--dp-danger); }
.it-root .dp-btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-danger) 8%, transparent); border-color: color-mix(in srgb, var(--dp-danger) 38%, transparent); }
.dp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 72px 24px; text-align: center; }
.dp-empty-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; margin-bottom: 14px; border-radius: 14px; background: var(--dp-bg2); color: var(--dp-text3); }
.dp-empty h3 { margin: 0 0 6px; font-size: 15px; font-weight: 600; }
.dp-empty p { max-width: 380px; margin: 0 0 18px; color: var(--dp-text2); font-size: 13px; }
/* 末尾的补充说明：跟在按钮后面，语气更轻，不再吃 18px 的下边距。 */
.dp-empty .dp-empty-note { margin: 14px 0 0; color: var(--dp-text3); font-size: 12px; }
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
	.dp-form { grid-template-columns: 1fr; }
	.dp-modal { max-height: 92vh; }
}
/* ── 单元测试 / 集成测试 切换 ── */
.it-tabs { display: flex; align-items: center; gap: 4px; margin: 2px 0 0; }
.it-tab { padding: 4px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--dp-text3); font: inherit; font-size: 15px; font-weight: 600; line-height: 1.4; cursor: pointer; transition: background .12s, color .12s; }
.it-tab:hover { background: var(--dp-bg2); color: var(--dp-text2); }
.it-tab.is-active { color: var(--dp-text); }
.it-tab.is-active::after { content: ""; display: block; height: 2px; margin-top: 3px; border-radius: 2px; background: var(--dp-brand); }

/*
 * 集成测试整体套用单元测试的 .dp-shell / .dp-header / .dp-toolbar 骨架，
 * 这样两个页面的留白、看板位置、工具栏节奏完全一致，切过去不会有「页面往上跳」的感觉。
 * 原来自带一套 it-subtabs 横排页签，占了一整行且只有三个词，浪费高度；
 * 现在改成工具栏里一个下拉按钮，把那一行还给内容。
 */
.it-root { display: block; }
/*
 * 集成测试根节点同时带 .dp-root：只有这样才能继承 --dp-bg / --dp-text 等 CSS 变量。
 * （变量只定义在 .dp-root 上；不加的话 background: var(--dp-bg) 解析失败 → 菜单和卡片全透明，
 *  就是之前截图里「下拉菜单透出后面场景文字」的原因。）
 *
 * 滚动：必须让根节点自己滚（沿用 .dp-root 的 height:100% + overflow:auto），
 * 和单元测试的 DataPanelView 一致。
 *
 * 曾经这里复位成 height:auto + overflow:visible，理由是「多一层滚动条、
 * 并把菜单裁掉」。结果是把滚动的责任推给了宿主右侧栏 —— 一旦宿主那一层
 * 不滚（DSH 右侧栏就是 overflow:hidden 的固定高容器），集成页的用例 / 步骤 /
 * 报告三页就完全滑不动，长表格直接被切掉。
 * 菜单裁切与横向滚动改由下面几条各自解决，不再靠放弃纵向滚动来换。
 */
.it-root.dp-root {
	height: 100%;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	background: transparent;
	/* 触屏 / 触控板惯性滚动；同时保证内部横向容器仍能接管水平手势 */
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;
}
.it-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }

/* 子页切换：下拉按钮（与「全部类型」下拉同款细边框：边框/背景/文字都取主题色） */
.it-switch { position: relative; display: inline-flex; }
.it-switch-btn { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s; }
.it-switch-btn:hover { background: var(--dp-bg2); border-color: var(--dp-border); }
.it-switch-btn.is-open { background: var(--dp-bg2); border-color: var(--dp-brand); }
.it-switch-caret { display: inline-flex; transform: rotate(90deg); transition: transform .14s; }
.it-switch-btn.is-open .it-switch-caret { transform: rotate(-90deg); }
/*
 * 下拉菜单面板。
 *
 * 定位用的是 position: fixed + 行内 left/top（由 ItMenu 按触发按钮的矩形算出来），
 * 所以这里不再写 left/right/top —— 否则会和行内样式打架。
 * 用 fixed 的原因：面板嵌在 DSH 右侧栏里，祖先带 overflow:auto，
 * absolute 菜单会被裁掉，看着像"跑到面板外面去了"。
 *
 * 背景必须是实色：菜单浮在表格上方，半透明会透出下面内容，文字叠在一起看不清。
 */
.it-switch-menu { position: absolute; z-index: 9999; display: flex; flex-direction: column; padding: 4px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); box-shadow: 0 10px 28px rgba(0,0,0,.45); min-width: 140px; max-height: 200px; overflow-y: auto; }
.it-switch-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.it-switch-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-switch-item.is-active { background: color-mix(in srgb, var(--dp-brand) 12%, transparent); color: var(--dp-brand); font-weight: 600; }
.it-switch-count { color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; }
.it-switch-item.is-active .it-switch-count { color: var(--dp-brand); }
.it-switch-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; padding: 6px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.it-switch-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-switch-item.is-active { background: color-mix(in srgb, var(--dp-brand) 10%, transparent); color: var(--dp-brand); font-weight: 600; }
.it-switch-count { color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; }
.it-switch-item.is-active .it-switch-count { color: var(--dp-brand); }

/* 版本菜单（工具栏右侧，与「全部类型」下拉同款细边框） */
.it-version { position: relative; display: inline-flex; }
.it-version-btn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s; }
.it-version-btn:hover { background: var(--dp-bg2); border-color: var(--dp-border); }
/* 面板样式统一在上面 .it-switch-menu 规则里 */
.it-version-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.it-version-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-version-item.is-active { background: color-mix(in srgb, var(--dp-brand) 12%, transparent); color: var(--dp-brand); font-weight: 600; }
.it-version-name { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.it-version-meta { flex: 1 1 auto; color: var(--dp-text3); font-size: 11px; text-align: right; }

/*
 * 工具栏的元素上同时挂了 .dp-toolbar 和 .it-toolbar：
 * 尺寸、间距、docked 收紧全部继承单元测试那套规则，
 * 搜索框和类型筛选因此和单元测试一模一样 —— 不再自己维护一份度量。
 *
 * 只有一处刻意不同：不换行。
 * 面板嵌在右侧栏里（约 560~900px），换成两行会把下面的表格顶下去，
 * 切页签时看起来就是「页面往上跳」。固定一行，让搜索框收缩让位。
 */
.it-toolbar { flex-wrap: nowrap; }
/*
 * 搜索框的 flex / max-width 全部走 .dp-search 原生规则（含 .dp-root.dp-docked 变体），
 * 这里只兜一个最小可用宽度：nowrap 下没有收缩下限的话，
 * 极窄容器会把它压到只剩图标。
 */
.it-toolbar .dp-search { min-width: 132px; }
.it-toolbar .dp-select { flex: 0 0 auto; width: auto; }
/* 下拉的包裹层默认 flex-shrink:1，nowrap 下会被压扁；锁成固有宽度，只让搜索框收缩 */
.it-toolbar .it-switch,
.it-toolbar .it-version { flex: 0 0 auto; }
.it-toolbar-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; flex: 0 0 auto; }
.it-toolbar .it-version-btn { height: 36px; border-radius: 10px; padding: 0 10px; }
.it-toolbar .it-switch-btn { height: 36px; }
.it-toolbar .dp-btn { flex: 0 0 auto; }
/* 极窄容器：允许换行，避免搜索框被挤到不可用 */
@media (max-width: 560px) {
	.it-toolbar { flex-wrap: wrap; }
	.it-toolbar .dp-search { flex: 1 1 100%; min-width: 0; }
	.it-toolbar-actions { margin-left: 0; }
}
.it-notice { margin-bottom: 12px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--dp-brand) 30%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--dp-brand) 6%, transparent); color: var(--dp-text); font-size: 12px; }

/* 场景侧栏 + 表格 */
.it-board { display: flex; align-items: flex-start; gap: 10px; }
.it-side { flex: 0 0 auto; width: 118px; padding: 7px 5px; border: 1px solid var(--dp-border); border-radius: 11px; background: var(--dp-bg); }
.it-side-title { padding: 0 6px 6px; color: var(--dp-text3); font-size: 10.5px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
.it-side-item { display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%; padding: 5px 7px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.it-side-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-side-item.is-active { background: color-mix(in srgb, var(--dp-brand) 9%, transparent); color: var(--dp-brand); font-weight: 600; }
.it-side-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.it-side-count { flex: 0 0 auto; color: var(--dp-text3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.it-side-item.is-active .it-side-count { color: var(--dp-brand); }
.it-main { flex: 1 1 auto; min-width: 0; }

/* 集成测试表：复用 dp-table 观感，列少、可横向滚动 */
.it-table-wrap { border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); overflow-x: auto; overscroll-behavior-x: contain; }
.it-table { width: 100%; min-width: 520px; border-collapse: collapse; font-size: 12px; }
.it-table th { padding: 8px 7px; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .04em; text-align: center; white-space: nowrap; }
.it-table td { padding: 9px 7px; border-bottom: 1px solid var(--dp-border2); color: var(--dp-text2); vertical-align: middle; text-align: center; }
.it-table td.it-left { text-align: left; }
.it-table tbody tr:last-child td { border-bottom: 0; }
.it-table tr.is-open > td { background: color-mix(in srgb, var(--dp-brand) 4%, transparent); }
.it-case-id { color: var(--dp-text2); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11.5px; }
.it-name-btn { padding: 0; border: 0; background: none; font: inherit; font-weight: 550; color: var(--dp-text); text-align: left; cursor: pointer; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.it-name-btn:hover { color: var(--dp-brand); text-decoration: underline; text-underline-offset: 3px; }
.it-cell-2 { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0; color: var(--dp-text2); font-size: 11.5px; line-height: 1.5; text-align: left; }
/* 用例名称后面的小标签：用例表里放用例标识，步骤表里放步骤数 */
.it-case-tag { display: inline-block; margin-left: 5px; padding: 0 6px; border-radius: 5px; background: var(--dp-bg3); color: var(--dp-text3); font-size: 10.5px; line-height: 16px; font-variant-numeric: tabular-nums; vertical-align: 1px; }
/* 用例名称是内容而不是入口：用纯文本，不再做成按钮 */
.it-name-text { color: var(--dp-text); font-weight: 550; word-break: break-word; }
/*
 * 步骤页的序号格：箭头 + 数字。箭头是整行唯一的下拉入口，
 * 放在序号左边才不会和右侧操作列抢注意力。
 */
.it-no-cell { display: inline-flex; align-items: center; gap: 3px; }
.it-row-toggle { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s, transform .14s; }
.it-row-toggle:hover { background: var(--dp-bg3); color: var(--dp-text); }
.it-row-toggle svg { transition: transform .14s; }
.it-row-toggle.is-open svg { transform: rotate(90deg); }
/* 展开行：整行是一格，里面挂执行结果子表 */
.it-expand-row > td { padding: 0; background: var(--dp-bg2); }
.it-expand-box { padding: 8px 10px 10px; }
/* 子表用 .it-mini 的紧凑度量，但列多，给它自己的最小宽度 */
.it-mini-runs { min-width: 560px; }
.it-mini-runs th { background: var(--dp-bg3); }
.it-muted { color: var(--dp-text3); }
/*
 * 步骤表的「输入步骤 / 预期结果」列：一格内是整条链路的全部步骤。
 * 用有序列表自带 1. 2. 3. 编号，与原型一致；行距收紧，避免一行占太高。
 */
.it-steps-cell { margin: 0; padding-left: 17px; color: var(--dp-text2); font-size: 11.5px; line-height: 1.62; text-align: left; }
.it-steps-cell li { margin: 0; word-break: break-word; }
/* 步骤表列多，给一个更大的最小宽度，窄面板时横向滚动而不是把列压扁 */
.it-table-steps { min-width: 680px; }
.it-pill { display: inline-block; padding: 0 7px; border-radius: 5px; font-size: 11px; line-height: 18px; white-space: nowrap; }
.it-pill[data-tone="ok"] { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.it-pill[data-tone="bad"] { background: color-mix(in srgb, var(--dp-danger) 12%, transparent); color: var(--dp-danger); }
.it-pill[data-tone="idle"] { background: var(--dp-bg3); color: var(--dp-text3); }
.it-pill[data-tone="brand"] { background: color-mix(in srgb, var(--dp-brand) 12%, transparent); color: var(--dp-brand); }
.it-ops { display: flex; justify-content: center; gap: 1px; }
.it-empty { padding: 34px 16px; color: var(--dp-text3); font-size: 12.5px; text-align: center; }

/* 展开区 / 明细小表：步骤明细（ItStepTable）和报告弹窗仍在用，最多约五行高度后滚动 */
.it-scroll-5 { max-height: 132px; overflow-y: auto; }
.it-mini { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.it-mini th { padding: 4px 7px; border-bottom: 1px solid var(--dp-border); color: var(--dp-text3); font-weight: 500; text-align: center; white-space: nowrap; }
.it-mini td { padding: 4px 7px; border-bottom: 1px solid var(--dp-border2); color: var(--dp-text2); text-align: center; }
.it-mini td.it-left { text-align: left; }
.it-mini tr:last-child td { border-bottom: 0; }

/* 勾选列 */
.it-pick { width: 26px; padding: 0 2px 0 0; }
.it-pick input { width: 13px; height: 13px; margin: 0; accent-color: var(--dp-brand); cursor: pointer; vertical-align: middle; }
.it-batch { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 7px 9px; border: 1px solid color-mix(in srgb, var(--dp-brand) 30%, transparent); border-radius: 9px; background: color-mix(in srgb, var(--dp-brand) 6%, transparent); color: var(--dp-text); font-size: 12px; }
.it-batch b { color: var(--dp-brand); font-weight: 700; }

/* 详情层：覆盖内容区，内部滚动 */
.it-detail { display: flex; flex-direction: column; gap: 10px; }
.it-detail-head { display: flex; align-items: center; gap: 8px; }
.it-field { display: flex; flex-direction: column; gap: 5px; }
.it-field-label { color: var(--dp-text2); font-size: 12.5px; font-weight: 500; }
/* 必填星标：原型里是标题前的红色 *，放在 label 内部第一个位置 */
.it-required { margin-right: 3px; color: var(--dp-danger); font-style: normal; font-weight: 700; }
.it-field-hint { color: var(--dp-text3); font-size: 11.5px; line-height: 1.5; }
.it-field-error { color: var(--dp-danger); font-size: 11.5px; }
.it-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
/*
 * 输入框外壳：字数计数要贴在右下方（原型里计数在框内右下角），
 * 所以用相对定位包一层，计数用绝对定位压在框里，不额外占高度。
 */
.it-input-wrap { position: relative; display: block; }
.it-input-wrap.is-area .it-count { bottom: 8px; }
.it-count { position: absolute; right: 9px; bottom: 6px; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; pointer-events: none; }
.it-count b { color: var(--dp-brand); font-weight: 600; }
.it-input, .it-area { width: 100%; padding: 7px 9px; border: 1px solid var(--dp-border); border-radius: 8px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 13px; }
/* 有计数的输入框右侧留出计数位，长文本不会压到数字底下 */
.it-input-wrap .it-input { padding-right: 62px; }
.it-area { min-height: 62px; resize: vertical; line-height: 1.6; }
/* 文本域的计数在右下角，正文多留一行高度避免最后一行被压住 */
.it-input-wrap.is-area .it-area { padding-bottom: 20px; }
.it-input:focus, .it-area:focus { border-color: var(--dp-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent); outline: none; }
.it-input.is-error { border-color: var(--dp-danger); }
.it-input.is-error:focus { box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-danger) 13%, transparent); }
.it-detail-foot { display: flex; justify-content: flex-end; gap: 7px; }
.it-section { padding: 9px 10px; border: 1px solid var(--dp-border); border-radius: 10px; background: var(--dp-bg); }
.it-section-title { margin: 0 0 6px; color: var(--dp-text3); font-size: 10.5px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
.it-kv { display: grid; grid-template-columns: 72px 1fr; gap: 4px 8px; font-size: 12px; }
.it-kv dt { color: var(--dp-text3); }
.it-kv dd { margin: 0; color: var(--dp-text2); word-break: break-word; }

/* 步骤编辑行 */
.it-step-row { display: grid; grid-template-columns: 22px 1fr 1fr 1fr auto; gap: 6px; align-items: start; padding: 6px 0; border-bottom: 1px dashed var(--dp-border2); }
.it-step-row:last-child { border-bottom: 0; }
.it-step-no { padding-top: 6px; color: var(--dp-text3); font-size: 11px; text-align: center; font-variant-numeric: tabular-nums; }
.it-step-ops { display: flex; gap: 1px; padding-top: 3px; }

/* 总体报告 */
.it-overview { display: flex; flex-direction: column; gap: 9px; }
.it-overview-stat { display: flex; flex-wrap: wrap; gap: 12px; color: var(--dp-text2); font-size: 12px; }
.it-overview-stat b { color: var(--dp-text); font-weight: 650; }

/*
 * 报告页：按场景分组的卡片列表（对齐原型）。
 * 每组一张卡片：可折叠的标题行 + 组内表格，标题行右侧是「通过 X / 失败 Y」。
 */
.it-report-groups { display: flex; flex-direction: column; gap: 9px; }
.it-report-group { border: 1px solid var(--dp-border); border-radius: 11px; background: var(--dp-bg); overflow: hidden; }
/* 组内表格自己带一层边框，和卡片边框叠在一起会显粗，这里让表格贴边无框 */
.it-report-group .it-table-wrap { border: 0; border-radius: 0; }
.it-report-head { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 11px; border: 0; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text); font: inherit; text-align: left; cursor: pointer; transition: background .12s; }
.it-report-head:hover { background: var(--dp-bg3); }
.it-report-head.is-collapsed { border-bottom: 0; }
.it-report-caret { display: inline-flex; color: var(--dp-text3); transform: rotate(90deg); transition: transform .14s; }
.it-report-head.is-collapsed .it-report-caret { transform: rotate(0deg); }
.it-report-name { flex: 0 0 auto; font-size: 13px; font-weight: 650; }
.it-report-badge { flex: 0 0 auto; padding: 0 7px; border-radius: 5px; background: color-mix(in srgb, var(--dp-brand) 11%, transparent); color: var(--dp-brand); font-size: 11px; line-height: 17px; }
.it-report-sum { flex: 1 1 auto; color: var(--dp-text3); font-size: 11.5px; text-align: right; }
.it-report-sum b { color: var(--dp-text2); font-weight: 600; }

/* 分页：复用单元测试 .dp-pager 的度量，只补集成页需要的间距 */
.it-pager { margin-top: 10px; }

/*
 * 用例编辑弹窗：原型是单列、约 700px、字段间距宽松。
 * Modal 默认 640px 偏窄（用例描述一行放不下几个字），wide 的 1080px 又太宽，
 * 所以单独给一个宽度。
 */
.dp-modal.it-case-modal { width: min(720px, 94vw); max-width: none; }
.it-case-modal .dp-modal-body { padding: 6px 22px 20px; }
.it-case-modal .it-detail { gap: 14px; }
/*
 * 弹窗里的字段按原型放大一档：原型是「标签 14px、输入框 14px」的填单形态，
 * 面板内联处那套 12.5/13px 是给窄卡片用的，放进 720px 的弹窗里会显得袖珍。
 */
.it-case-modal .it-field-label { font-size: 14px; font-weight: 500; }
.it-case-modal .it-input,
.it-case-modal .it-area { height: 42px; padding: 0 12px; font-size: 14px; border-radius: 9px; }
.it-case-modal .it-area { height: auto; min-height: 72px; padding: 10px 12px; }
.it-case-modal .it-field-hint { font-size: 12.5px; }
.it-case-modal .it-count { right: 12px; bottom: 12px; font-size: 12px; }
.it-case-modal .it-input-wrap.is-area .it-area { padding-bottom: 24px; }
.it-case-modal .it-input-wrap.is-area .it-count { bottom: 9px; }

/* 窄面板：侧栏进一步收窄，工具栏两行 */
.it-root.is-narrow .it-side { width: 96px; }
.it-root.is-narrow .it-grid-2 { grid-template-columns: 1fr; }
.it-root.is-narrow .it-step-row { grid-template-columns: 20px 1fr auto; }
.it-root.is-narrow .it-step-row .it-step-col-3 { display: none; }
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
		// 测试类型及下拉框顺序：功能 → 接口 → 边界 → 逻辑 → 性能。
var TEST_TYPES = {
	functional: { label: "功能测试", tone: "func" },
	api: { label: "接口测试", tone: "func" },
	boundary: { label: "边界测试", tone: "func" },
	logic: { label: "逻辑测试", tone: "func" },
	performance: { label: "性能测试", tone: "perf" }
};
var TEST_TYPE_KEYS = ["functional", "api", "boundary", "logic", "performance"];
		function testTypeOptions(value) {
			var options = TEST_TYPE_KEYS.map(function (key) {
				return h("option", { key: key, value: key }, TEST_TYPES[key].label);
			});
			if (value === "") options.unshift(h("option", { key: "empty", value: "", disabled: true }, "请选择测试类型"));
			return options;
		}

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
		 * 毫秒转「人话」时长：0.8s / 12.3s / 1m04s / 12m30s。
		 * 整轮耗时常见是几十秒到几分钟，固定一位小数在分钟级就不好读了。
		 */
		function fmtDuration(ms) {
			var value = Number(ms);
			if (!Number.isFinite(value) || value <= 0) return "—";
			if (value < 60000) return (value / 1000).toFixed(1) + "s";
			var total = Math.round(value / 1000);
			var minutes = Math.floor(total / 60);
			var seconds = total % 60;
			return minutes + "m" + (seconds < 10 ? "0" : "") + seconds + "s";
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

		//#region integration demo data
		/*
		 * 集成测试演示数据。
		 *
		 * 全部是前端示例，不写后端、不发请求 —— 集成测试的执行/报告链路还没接，
		 * 这一轮只要求「能看到页面、点得动」。数据按会话隔离（见 buildIntegrationSeed），
		 * 与单元测试的 records 完全分开。
		 *
		 * 字段取自原型（自动化测试原型(3).html）：
		 *   用例：id / caseId / title / scenario / type / description / precondition /
		 *        expectedResult / steps[] / status / lastRunAt / records[]
		 *   步骤：action（动作）/ operation（输入步骤）/ expected（预期结果）
		 *   报告：一个用例可有多份历史报告，用 records[] 承载
		 *
		 * 版本 V0.0.1 是完整示例；V0.0.2 只有 4 条，用来验证「切版本后数据隔离」。
		 */
		var IT_SCENARIOS_ALL = "全部用例";
		var IT_SCENARIOS_NONE = "未分组";

		// 集成测试的测试类型：原型里接口/UI 混排，这里按实际工程口径给四项。
		var IT_TYPES = {
			api: { label: "接口测试" },
			ui: { label: "UI 测试" },
			flow: { label: "业务流程" },
			data: { label: "数据校验" }
		};
		var IT_TYPE_KEYS = ["api", "ui", "flow", "data"];

		var IT_STATUS = {
			pass: { label: "通过", tone: "ok" },
			fail: { label: "未通过", tone: "bad" },
			none: { label: "未执行", tone: "idle" }
		};

		/**
		 * 生成一份集成测试示例数据。
		 *
		 * 每次调用返回全新对象，避免多个会话/多次挂载共享同一份引用
		 * （改一个版本的数据会串到别处）。
		 */
		function buildIntegrationSeed() {
			function steps(list) {
				return list.map(function (item, index) {
					return {
						no: index + 1,
						action: item[0],
						operation: item[1],
						expected: item[2]
					};
				});
			}
			function record(id, at, result, durationMs) {
				return { runId: id, at: at, result: result, durationMs: durationMs };
			}

			var v1 = [
				{
					id: "it-1",
					caseId: "IT-001",
					title: "商品加入购物车",
					scenario: "商品与购物车",
					type: "ui",
					description: "在商品详情页选择规格后点击加入购物车，商品应进入购物车并给出成功提示",
					precondition: "已登录，商品处于上架状态且库存充足",
					expectedResult: "购物车数量 +1，右上角角标同步更新，提示「已加入购物车」",
					status: "pass",
					lastRunAt: "2026-11-17T10:24:00",
					steps: steps([
						["打开页面", "进入电商首页，等待轮播图加载完成", "首页正常展示，顶部出现登录用户昵称"],
						["搜索商品", "输入「无线蓝牙耳机」并回车，点击首个结果", "进入商品详情页，标题与价格正常展示"],
						["选择规格", "选择颜色「曜石黑」，数量保持 1", "所选规格高亮，价格随规格更新"],
						["加入购物车", "点击「加入购物车」按钮", "提示「已加入购物车」，角标由 0 变为 1"]
					]),
					records: [
						record("it-1-r2", "2026-11-17T10:24:00", "pass", 4820),
						record("it-1-r1", "2026-11-16T16:02:00", "fail", 6310)
					]
				},
				{
					id: "it-2",
					caseId: "IT-002",
					title: "购物车数量修改与库存上限校验",
					scenario: "商品与购物车",
					type: "ui",
					description: "在购物车页修改商品数量，超过库存时应有拦截提示",
					precondition: "购物车已有该商品，库存为 5 件",
					expectedResult: "数量可改为 1~5；输入 6 时提示「超出库存」，自动回到 5",
					status: "pass",
					lastRunAt: "2026-11-17T10:31:00",
					steps: steps([
						["打开页面", "点击右上角购物车图标", "列表展示已加入的商品，数量为 1"],
						["增加数量", "连续点击「+」4 次", "数量依次变为 2/3/4/5，小计同步变化"],
						["超出库存", "数量为 5 时再点一次「+」", "提示「超出库存」，数量保持 5"],
						["删除商品", "点击「删除」并确认", "商品移出列表，合计金额归零"]
					]),
					records: [record("it-2-r1", "2026-11-17T10:31:00", "pass", 3910)]
				},
				{
					id: "it-3",
					caseId: "IT-003",
					title: "优惠券抵扣结算",
					scenario: "订单与支付",
					type: "flow",
					description: "结算页选择满 100 减 20 的优惠券，应付金额应正确抵扣",
					precondition: "已登录，账户有「满 100 减 20」券，商品合计 129 元",
					expectedResult: "优惠显示 20 元，应付 109 元，订单详情记录该券",
					status: "pass",
					lastRunAt: "2026-11-17T11:05:00",
					steps: steps([
						["打开结算页", "购物车点击「去结算」", "结算页展示清单，合计 129 元"],
						["打开优惠券", "点击「选择优惠券」", "弹出面板，「满 100 减 20」可用"],
						["使用优惠券", "点击该券并确认", "优惠显示 -20 元，应付 109 元"],
						["提交订单", "点击「提交订单」", "进入支付页，详情显示已用该券"]
					]),
					records: [record("it-3-r1", "2026-11-17T11:05:00", "pass", 7240)]
				},
				{
					id: "it-4",
					caseId: "IT-004",
					title: "提交订单后取消订单",
					scenario: "订单与支付",
					type: "flow",
					description: "对待支付订单执行取消，订单状态应变为已取消",
					precondition: "已登录，存在一笔待支付订单",
					expectedResult: "状态变为「已取消」，库存回滚，优惠券退回账户",
					status: "fail",
					lastRunAt: "2026-11-17T11:22:00",
					steps: steps([
						["打开页面", "个人中心进入「我的订单」筛选「待支付」", "列表展示至少一笔待支付订单"],
						["取消订单", "点击「取消订单」并确认", "弹窗关闭，状态更新为「已取消」"],
						["校验库存", "返回商品详情页查看库存", "库存比下单前增加，可再次下单"],
						["校验优惠券", "进入优惠券列表查看", "该券回到可用状态，有效期不变"]
					]),
					records: [
						record("it-4-r1", "2026-11-17T11:22:00", "fail", 9130),
						record("it-4-r0", "2026-11-16T17:40:00", "pass", 8400)
					]
				},
				{
					id: "it-5",
					caseId: "IT-005",
					title: "新增收货地址并设为默认",
					scenario: "账户与会员",
					type: "ui",
					description: "在个人中心新增收货地址并勾选设为默认",
					precondition: "已登录，当前没有默认地址",
					expectedResult: "地址新增成功并置顶，标记「默认」，下单自动选中",
					status: "none",
					lastRunAt: "",
					steps: steps([
						["打开页面", "个人中心 > 收货地址，点「新增地址」", "弹出新增地址表单"],
						["填写地址", "填收货人、手机号、地区与详细地址，勾选设为默认", "表单校验通过，无红色报错"],
						["保存并校验", "点击「保存」", "地址置顶并标记「默认」，下单页自动选中"]
					]),
					records: []
				},
				{
					id: "it-6",
					caseId: "IT-006",
					title: "会员积分展示与累计",
					scenario: "账户与会员",
					type: "data",
					description: "完成一笔 129 元订单后，积分应按 1 元 1 分累计",
					precondition: "已登录，当前积分 200",
					expectedResult: "积分变为 329，明细新增一条 +129 记录",
					status: "pass",
					lastRunAt: "2026-11-16T15:18:00",
					steps: steps([
						["查看积分", "进入个人中心查看积分卡片", "当前积分显示 200"],
						["完成支付", "支付一笔 129 元订单", "支付成功，跳转结果页"],
						["校验积分", "返回个人中心查看积分与明细", "积分变为 329，首条为「订单支付 +129」"]
					]),
					records: [record("it-6-r1", "2026-11-16T15:18:00", "pass", 5620)]
				},
				{
					id: "it-7",
					caseId: "IT-007",
					title: "手机号验证码登录",
					scenario: "用户与登录",
					type: "api",
					description: "使用手机号 + 短信验证码完成登录，校验 token 是否正常下发",
					precondition: "手机号已注册，可接收短信",
					expectedResult: "登录成功并返回 access_token，有效期 2 小时",
					status: "pass",
					lastRunAt: "2026-11-17T09:12:00",
					steps: steps([
						["获取验证码", "POST /api/sms/code，传已注册手机号", "返回 200，60 秒内收到 6 位验证码"],
						["提交登录", "POST /api/login，传手机号与验证码", "返回 200，响应体含 access_token"],
						["校验会话", "带 token 请求 /api/profile", "返回 200，用户信息与手机号一致"]
					]),
					records: [record("it-7-r1", "2026-11-17T09:12:00", "pass", 2180)]
				},
				{
					id: "it-8",
					caseId: "IT-008",
					title: "账号密码登录失败锁定",
					scenario: "用户与登录",
					type: "api",
					description: "连续输错密码 5 次后账号应被临时锁定，锁定期间正确密码也不放行",
					precondition: "账号存在且未锁定",
					expectedResult: "第 5 次返回「密码错误次数过多」，后续 15 分钟内登录均被拒绝",
					status: "fail",
					lastRunAt: "2026-11-17T09:40:00",
					steps: steps([
						["连续输错", "连续 5 次 POST /api/login 传错误密码", "前 4 次返回 401，第 5 次返回锁定提示"],
						["锁定校验", "锁定期间用正确密码登录", "仍返回锁定提示，不放行"],
						["到期解锁", "等待 15 分钟后再次登录", "恢复正常登录，返回 token"]
					]),
					records: [record("it-8-r1", "2026-11-17T09:40:00", "fail", 3350)]
				},
				{
					id: "it-9",
					caseId: "IT-009",
					title: "退出登录清除会话",
					scenario: "用户与登录",
					type: "ui",
					description: "退出登录后本地凭证必须清除，不能通过浏览器后退恢复访问",
					precondition: "已登录",
					expectedResult: "返回登录页，token 已清除，后退也无法进入需登录页面",
					status: "none",
					lastRunAt: "",
					steps: steps([
						["触发退出", "「我的 > 设置」点击「退出登录」", "弹出二次确认"],
						["确认退出", "点击「确定」", "返回登录页，本地 token 已清除"],
						["回退校验", "用浏览器后退键回上一页", "仍停留在登录页"]
					]),
					records: []
				}
			];
			/*
			 * 生成时间：用例表要展示「生成时间」列，报告页也按它排序。
			 * 手写在每条用例上容易漏，这里按顺序统一补一份（越靠前越早生成），
			 * 并在编辑保存时保留原值（见 saveCase）。
			 */
			var createdBase = Date.parse("2026-11-16T09:10:00");
			v1.forEach(function (item, index) {
				var at = new Date(createdBase + index * 37 * 60 * 1000);
				function pad(n) { return n < 10 ? "0" + n : String(n); }
				item.createdAt = at.getFullYear() + "-" + pad(at.getMonth() + 1) + "-" + pad(at.getDate()) +
					"T" + pad(at.getHours()) + ":" + pad(at.getMinutes()) + ":00";
			});

			// V0.0.2 只保留 2 条，用来验证「切版本后数据隔离」：条数明显不同才好确认。
			var v2 = v1.slice(0, 2).map(function (item) {
				return JSON.parse(JSON.stringify(item));
			});
			v2[0].id = "it2-1";
			v2[0].caseId = "IT2-001";
			v2[0].records = [];
			v2[1].id = "it2-2";
			v2[1].caseId = "IT2-002";
			v2[1].records = [];

			return {
				versions: [
					{ name: "V0.0.2", at: "2026-11-17T12:00:00", status: "current" },
					{ name: "V0.0.1", at: "2026-11-16T09:00:00", status: "archived" }
				],
				activeVersion: "V0.0.1",
				byVersion: {
					"V0.0.1": v1,
					"V0.0.2": v2
				}
			};
		}

		/** 取某条用例的步骤数（编辑后可能是空数组）。 */
		function itStepCount(record) {
			return Array.isArray(record && record.steps) ? record.steps.length : 0;
		}

		/** 某条用例按场景归属；空场景算「未分组」。 */
		function itScenarioOf(record) {
			var name = typeof record?.scenario === "string" ? record.scenario.trim() : "";
			return name === "" ? IT_SCENARIOS_NONE : name;
		}

		/** 场景清单：全部用例固定第一，其余按名称排，空场景落到「未分组」。 */
		function itScenarioRows(records) {
			var counts = Object.create(null);
			(Array.isArray(records) ? records : []).forEach(function (record) {
				var name = itScenarioOf(record);
				counts[name] = (counts[name] || 0) + 1;
			});
			var rows = [{ key: "__all__", name: IT_SCENARIOS_ALL, count: (records || []).length }];
			Object.keys(counts).sort(function (a, b) {
				// 「未分组」固定排在最后。
				if (a === IT_SCENARIOS_NONE) return 1;
				if (b === IT_SCENARIOS_NONE) return -1;
				return a.localeCompare(b, "zh-CN");
			}).forEach(function (name) {
				rows.push({ key: name, name: name, count: counts[name] });
			});
			return rows;
		}

		/** 毫秒转「4.8s」；集成演示里耗时都是秒级。 */
		function itDuration(ms) {
			var value = Number(ms);
			if (!Number.isFinite(value) || value <= 0) return "—";
			return (value / 1000).toFixed(1) + "s";
		}

		/** ISO 时间转「11-17 10:24」；空值给「—」。 */
		function itTime(iso) {
			var time = Date.parse(iso);
			if (!Number.isFinite(time)) return "—";
			var d = new Date(time);
			function pad(n) { return n < 10 ? "0" + n : String(n); }
			return pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
		}

		/** ISO 时间转「2026-11-17」；空值给「—」。用例表的「生成时间」列用日期就够。 */
		function itDate(iso) {
			var time = Date.parse(iso);
			if (!Number.isFinite(time)) return "—";
			var d = new Date(time);
			function pad(n) { return n < 10 ? "0" + n : String(n); }
			return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
		}

		/** 按搜索结果过滤集成用例：标识 / 名称 / 说明 / 场景 / 类型名。 */
		function itFilterRecords(records, options) {
			var query = typeof options?.query === "string" ? options.query.trim().toLowerCase() : "";
			var scenario = typeof options?.scenario === "string" ? options.scenario : "";
			var type = typeof options?.type === "string" ? options.type : "all";
			var status = typeof options?.status === "string" ? options.status : "all";
			return (Array.isArray(records) ? records : []).filter(function (record) {
				if (scenario !== "" && scenario !== IT_SCENARIOS_ALL) {
					if (itScenarioOf(record) !== scenario) return false;
				}
				if (type !== "all" && record.type !== type) return false;
				if (status !== "all" && (record.status || "none") !== status) return false;
				if (query === "") return true;
				var typeLabel = IT_TYPES[record.type]?.label || "";
				return [record.caseId, record.title, record.description, record.scenario, typeLabel]
					.join(" ")
					.toLowerCase()
					.indexOf(query) !== -1;
			});
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
			// 允许调用方叠一点内联样式（例如把箭头翻个方向）。
			if (props.style) common.style = props.style;
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
				// 查看源码：带文件框的代码符号（文件轮廓 + 内部 <>）。
				// 原来这里用的是 "location"（一个十字准星），用户反馈看不出是「看源码」。
				// 与纯括号的 "code" 区分：这一个是「打开某个源文件」，那一个是「看这段代码内容」。
				case "source":
					children = [
						h("path", { key: "a", d: "M6 3h8l4 4v14H6z" }),
						h("path", { key: "b", d: "M14 3v5h5" }),
						h("path", { key: "c", d: "m11 12-2 2.5 2 2.5" }),
						h("path", { key: "d", d: "m15 12 2 2.5-2 2.5" })
					];
					break;
				// 执行：播放三角。原先用 "external"（外链箭头），看着像「在新窗口打开」而不是「跑起来」。
				// 用描边闭合三角形，线宽与其它图标一致，不是实心块。
				case "play":
					children = [h("path", { key: "a", d: "M8 4.8 19 12 8 19.2z" })];
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

				assignFunction: function (ids, subjectFunction, forcedSessionId) {
					return mutate({ op: "assignFunction", ids: ids, subjectFunction: subjectFunction }, function (data) {
						var wanted = Object.create(null);
						ids.forEach(function (id) { wanted[id] = true; });
						commit(snapshot.records.map(function (record) {
							return wanted[record.id] ? Object.assign({}, record, { subjectFunction: data.subjectFunction }) : record;
						}));
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

			function fetchTestCode(sessionId, caseId) {
				var params = new URLSearchParams();
				params.set("sessionId", sessionId);
				params.set("caseId", caseId);
				params.set("cwd", cwdOf(sessionId));
				return callApi("/data-panel/test-code?" + params.toString(), {
					method: "GET", headers: { accept: "application/json" }
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
			// 透传额外 DOM 属性（集成测试用 data-it 定位按钮）。
			var extra = {};
			Object.keys(props || {}).forEach(function (key) {
				if (key === "type" || key === "variant" || key === "size" || key === "className" ||
					key === "onClick" || key === "disabled" || key === "title" || key === "children") return;
				extra[key] = props[key];
			});
			return h("button", Object.assign({
				type: "button",
				className: cn("dp-btn", variant, props.size === "sm" ? "dp-btn-sm" : "", props.className),
				onClick: props.onClick,
				disabled: props.disabled === true,
				title: props.title
			}, extra), props.children);
		}

		function IconButton(props) {
			// 允许透传额外的 DOM 属性（集成测试用 data-it 定位按钮）。
			var extra = {};
			Object.keys(props || {}).forEach(function (key) {
				if (key === "type" || key === "className" || key === "onClick" || key === "disabled" ||
					key === "label" || key === "name" || key === "danger" || key === "children") return;
				extra[key] = props[key];
			});
			return h("button", Object.assign({
				type: "button",
				className: cn("dp-icon-btn", props.danger ? "danger" : "", props.className),
				onClick: props.onClick,
				disabled: props.disabled === true,
				title: props.label,
				"aria-label": props.label
			}, extra), h(Icon, { name: props.name, size: 15 }));
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
			var meta = TEST_TYPES[props.testType] || { label: "待重新分类", tone: "func" };
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
					className: cn("dp-modal", props.wide === true ? "dp-modal-wide" : "", props.className),
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
					}))
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

		/** 业务函数分组共用规则：不依赖 Skill 名称。 */
		function subjectFunctionOf(record) {
			return typeof record.subjectFunction === "string" ? record.subjectFunction.trim() : "";
		}

		function functionRows(records) {
			var counts = Object.create(null);
			var unassigned = 0;
			records.forEach(function (record) {
				var name = subjectFunctionOf(record);
				if (name) counts[name] = (counts[name] || 0) + 1;
				else unassigned += 1;
			});
			return [{ key: "__all__", value: "", label: "全部用例", count: records.length },
				{ key: "__unassigned__", value: null, label: "未关联函数", count: unassigned }].concat(
				Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); }).map(function (name) {
					return { key: "function:" + name, value: name, label: name, count: counts[name] };
				}));
		}

		function FunctionField(props) {
			return h(Field, { label: "被测函数", full: true, hint: "填写源码中的业务函数，如 src/order.ts::Order.discount；留空为未关联函数。" },
				h("input", { className: "dp-input dp-input-mono", value: props.value, maxLength: 240,
					list: props.listId, placeholder: "src/order.ts::Order.discount",
					onChange: function (event) { props.onChange(event.target.value); } }),
				h("datalist", { id: props.listId }, (props.functions || []).map(function (name) {
					return h("option", { key: name, value: name });
				})));
		}

		function CategoryPrompt(props) {
			var valueState = useState(props.initialValue || "");
			var value = valueState[0];
			var setValue = valueState[1];
			var errorState = useState("");
			var error = errorState[0];
			var setError = errorState[1];

			function submit() {
				var name = value.trim();
				if (name.length > 240) { setError("被测函数最多 240 个字符"); return; }
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
				h(FunctionField, { value: value, functions: props.functions, listId: "dp-bulk-functions", onChange: function (next) { setValue(next); setError(""); } }),
				h("p", { className: "dp-hint" }, "填写已有或新的被测函数；清空后确定可解除所选用例的函数关联。"),
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
		 * 判断一份执行记录是不是「被中断 / 被终止」而不是正常跑完。
		 *
		 * 依据是 runner（assets/run_tests.py）写进 result.json 的状态：
		 *   finish(130, "interrupted", "执行被中断")  ← 用户终止 / 进程被杀
		 * 后端 /run/list 把这个 status 原样透出来，所以这里能直接认。
		 * aborted 是宿主侧对同一件事的叫法，一并认。
		 */
		function runWasInterrupted(run) {
			if (!run || typeof run !== "object") return false;
			var status = typeof run.status === "string" ? run.status : "";
			var outcome = typeof run.caseOutcome === "string" ? run.caseOutcome : "";
			return status === "interrupted" || status === "aborted" || outcome === "interrupted" || outcome === "aborted";
		}

		function runWasInterruptedIn(list) {
			if (!Array.isArray(list)) return false;
			for (var i = 0; i < list.length; i += 1) {
				if (runWasInterrupted(list[i])) return true;
			}
			return false;
		}

		/**
		 * 单条执行记录只在展开、手动刷新、删除后读取，不监听对话或轮询。
		 * 刚点执行的记录先隐藏，点击表头刷新后再读取当前已落盘的最终结果。
		 */
		function RunRecords(props) {
			var record = props.record;
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var awaiting = props.awaiting === true;
			var state = useState({ status: "loading", runs: [], error: "" });
			var view = state[0];
			var setView = state[1];
			var reloadState = useState(0);
			var reloadTick = reloadState[0];
			var setReloadTick = reloadState[1];
			var scrollRef = useRef(null);
			var pendingRef = useRef(null);
			pendingRef.current = awaiting ? props.pendingRunId || "" : null;

			// 按实际行高显示前五条记录；更多记录在展开区内滚动。
			useEffect(function () {
				var container = scrollRef.current;
				if (!container) return undefined;
				var table = container.querySelector("table");
				function updateHeight() {
					var rows = container.querySelectorAll("tbody > tr");
					container.style.maxHeight = rows.length > 5 && table
						? Math.ceil(rows[4].getBoundingClientRect().bottom - table.getBoundingClientRect().top) + "px"
						: "";
				}
				updateHeight();
				if (!table || typeof ResizeObserver === "undefined") return undefined;
				var observer = new ResizeObserver(updateHeight);
				observer.observe(table);
				return function () { observer.disconnect(); };
			}, [view]);

			function applyRuns(runs) {
				var pendingRunId = pendingRef.current;
				runs = runs.filter(function (run) {
					return run.status !== "running" && run.runId !== pendingRunId;
				});
				setView({ status: runs.length === 0 ? "empty" : "ready", runs: runs, error: "" });
			}

			useEffect(function () {
				if (sessionId === "") {
					setView({ status: "error", runs: [], error: "还没拿到当前会话。" });
					return undefined;
				}
				var alive = true;
				setView({ status: "loading", runs: [], error: "" });
				fetchRunList(sessionId, "case", record.caseId).then(function (data) {
					if (!alive) return;
					applyRuns((data && data.runs) || []);
				}).catch(function (failure) {
					if (!alive) return;
					setView({ status: "error", runs: [], error: failure && failure.message ? failure.message : "读取执行记录失败" });
				});
				return function () {
					alive = false;
				};
			}, [sessionId, record.caseId, reloadTick, props.refreshTick]);


			function remove(runId) {
				props.onRemove(runId, function (done) {
					if (done) setReloadTick(function (n) { return n + 1; });
				});
			}

			var body = null;
			// 等结果期间只显示执行状态，完成后在记录里显示耗时。
			var waitingHint = null;
			if (awaiting) {
				waitingHint = h("div", { className: "dp-run-wait" },
					h("span", { className: "dp-run-wait-dot" }),
					"正在执行…"
				);
			}
			if (view.status === "loading") {
				body = h("div", { className: "dp-run-empty" }, "正在读取执行记录…");
			} else if (view.status === "error") {
				body = h("div", { className: "dp-run-empty" }, view.error);
			} else if (view.status === "empty") {
				body = h("div", { className: "dp-run-empty" }, awaiting
					? "对话结束后，点击表头上方的「刷新」更新执行记录。"
					: "这条用例还没有执行过。点它的「执行」按钮，跑完再回来看。");
			} else {
				var outcomeLabels = { passed: "通过", failed: "未通过", error: "错误", skipped: "跳过", unknown: "未确认" };
				var outcomeTones = { passed: "ok", failed: "bad", error: "bad", skipped: "idle", unknown: "idle" };
				body = h("table", { className: "dp-run-table" },
					h("thead", null,
						h("tr", null,
							h("th", { style: { width: "42px" } }, "#"),
							h("th", { style: { width: "150px" } }, "执行时间"),
							h("th", { style: { width: "92px" } }, "耗时"),
							h("th", { className: "dp-grow" }, "实际输出"),
							h("th", { style: { width: "82px" } }, "结果"),
							h("th", { style: { width: "112px" } }, "操作")
						)
					),
					h("tbody", null, view.runs.map(function (run, index) {
						var outcome = run.caseOutcome || run.status || "";
						var label = outcomeLabels[outcome] || outcome || "—";
						var tone = outcomeTones[outcome] || "idle";
						var actualText = run.actual || run.message || "未记录实际值";
						var costText = fmtDuration(run.durationMs);
						return h("tr", { key: run.runId },
							h("td", null, String(view.runs.length - index)),
							h("td", { title: run.runId }, fmtFull(run.startedAt)),
							h("td", { title: "执行结果记录的耗时" }, costText),
							h("td", { className: "dp-left" },
								h("pre", { title: actualText }, actualText)
							),
							h("td", null, h("span", { className: "dp-run-state", "data-tone": tone }, label)),
							h("td", null,
								h("div", { className: "dp-run-ops" },
									h(IconButton, {
										name: "doc",
										label: "报告",
										onClick: function () { props.onReport(run); }
									}),
									h(IconButton, {
										name: "log",
										label: "日志",
										onClick: function () { props.onLog(run); }
									}),
									h(IconButton, {
										name: "trash",
										danger: true,
										label: "删除",
										onClick: function () { remove(run.runId); }
									})
								)
							)
						);
					}))
				);
			}

			return h("div", { className: "dp-run-panel" },
				// 等结果时把执行状态放最上面。
				waitingHint,
				h("div", { className: "dp-run-scroll", ref: scrollRef }, body)
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
								h("th", { className: "dp-left", style: { width: "32%" } }, "测试函数"),
								h("th", { style: { width: "80px" } }, "结果"),
								h("th", { className: "dp-left" }, "说明")
							)),
							h("tbody", null, tests.map(function (item, index) {
								return h("tr", { key: String(index) },
									h("td", { className: "dp-left", style: { fontFamily: "ui-monospace, Consolas, monospace" } }, item.func || "—"),
									h("td", null, h("span", { className: "dp-run-state", "data-tone": outcomeTone[item.outcome] || "idle" }, outcomeLabel[item.outcome] || item.outcome || "—")),
									h("td", { className: "dp-left" }, item.message || "—")
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
			// 允许调用方带额外的 DOM 属性（例如集成测试用的 data-it），
			// 内部已消费的字段要剔掉，避免漏到 DOM 上。
			var extra = {};
			Object.keys(props || {}).forEach(function (key) {
				if (key === "value" || key === "onChange" || key === "placeholder" ||
					key === "label" || key === "eventStyle") return;
				extra[key] = props[key];
			});
			var inputProps = Object.assign({
				type: "search",
				value: props.value,
				placeholder: props.placeholder || "搜索用例名称 / 用例标识 / 测试说明",
				// 回调可能来自单元测试（传字符串）或集成测试（传 event），两种都吃。
				onChange: function (event) {
					if (typeof props.onChange !== "function") return;
					if (props.eventStyle === true) props.onChange(event);
					else props.onChange(event.target.value);
				},
				"aria-label": props.label || "搜索用例"
			}, extra);
			return h("div", { className: "dp-search" },
				h(Icon, { name: "search", size: 15 }),
				h("input", inputProps)
			);
		}

		/**
		 * 空状态。三种情形分开说清楚：
		 *   category — 当前层级里没有用例 → 引导去「默认」挑用例加进来
		 *   filtered — 有筛选条件但没命中 → 清筛选
		 *   都没有   — 面板里一条用例都没有 → 「暂时还没有用例」+ 新增入口
		 */
		function EmptyState(props) {
			var filtered = props.filtered;
			var category = props.category === null ? "未关联函数" : (props.category || "");
			var inCategory = category !== "" && !filtered;
			var total = typeof props.total === "number" ? props.total : 0;
			return h("div", { className: "dp-empty" },
				h("div", { className: "dp-empty-icon" },
					h(Icon, { name: inCategory ? "folder" : "doc", size: 23 })
				),
				h("h3", null, inCategory
					? "「" + category + "」下暂无用例"
					: (filtered ? "没有匹配的用例" : "暂时还没有用例")),
				h("p", null, inCategory
					? "在「全部用例」中选择用例，点击「关联被测函数」设置业务函数。"
					: (filtered
						? "换个关键词或清除筛选条件试试。"
						: "这个会话还没有导入或新建任何用例。可以点下面的按钮手动新增一条，也可以让 AI 按 Skill 生成测试用例后自动落到这里。")),
				inCategory
					? h(Button, { variant: "primary", onClick: props.onGoDefault },
						h(Icon, { name: "folder", size: 15 }),
						"查看全部用例"
					)
					: (filtered
						? h(Button, { onClick: props.onClear }, "清除筛选")
						: h(Button, { variant: "primary", onClick: props.onCreate },
							h(Icon, { name: "plus", size: 15 }),
							"新增用例"
						)),
				// 真的一条都没有时，补一句「不是加载失败」，避免用户以为面板坏了。
				(!inCategory && !filtered && total === 0)
					? h("p", { className: "dp-empty-note" }, "面板会监听当前会话，AI 生成用例后这里会自动出现。")
					: null
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

		/**
		 * 左栏「用例层级」。
		 *
		 * 两条约束来自用户反馈：
		 *   1. 左栏高度跟着表格走 —— 表格矮而层级多时不能无限拉长，
		 *      高度到表格为止，剩下的靠分页翻；
		 *   2. 表格高、层级少时不分页，保持原样。
		 * 高度由父组件量好（props.boardHeight）传进来，这里只负责按行高反算每页几条。
		 * 自己量自己的话会陷入「内容变高 → 自己更高 → 又能放更多」的循环。
		 */
		function CategorySidebar(props) {
			var rows = props.rows;
			var activeCategory = props.activeCategory;

			var docked = props.docked === true;
			var boardHeight = Number(props.boardHeight) || 0;
			var pageState = useState(1);
			var page = pageState[0];
			var setPage = pageState[1];

			var headHeight = 30;
			var pagerHeight = 33;
			var rowHeight = docked ? 29 : 31;
			// 能放下几条层级：先减掉表头和分页条，再按行高除。
			var capacity = boardHeight > 0
				? Math.max(1, Math.floor((boardHeight - headHeight - pagerHeight) / rowHeight))
				: 0;
			// 还没量到高度（首帧）就别分页，宁可不折也不能把行藏起来。
			var needPager = capacity > 0 && rows.length > capacity;
			var totalPages = needPager ? Math.ceil(rows.length / capacity) : 1;
			var currentPage = Math.min(Math.max(1, page), totalPages);
			var visibleRows = needPager
				? rows.slice((currentPage - 1) * capacity, currentPage * capacity)
				: rows;

			// 行数变少（删层级 / 换会话）时把页码收回到合法范围，否则会停在空页上。
			useEffect(function () {
				if (page > totalPages) setPage(totalPages);
			}, [page, totalPages]);

			return h("aside", {
				className: "dp-sidebar",
				// 高度跟表格走：有量到值就锁死上限，量不到用 CSS 里的兜底 62vh。
				style: boardHeight > 0 ? { maxHeight: boardHeight + "px" } : null,
			},
				h("div", { className: "dp-sidebar-head" },
					h("span", { className: "dp-sidebar-title" }, "用例层级"),
					h("span", { className: "dp-hint" }, "按函数")
				),
				h("div", { className: "dp-cat-scroll" },
					// 勾选的引导文案统一放在表格下方的操作条里，左栏不再重复。
					visibleRows.map(function (row) {
						// 全部用例可点击切回。
						if (row.value === "") {
							return h("button", {
								key: row.key,
								type: "button",
								className: cn("dp-cat-group", activeCategory === "" ? "is-active" : ""),
								// 条数本来就常驻显示，tooltip 里不再重复（用户反馈 hover 时多冒一个数字）。
								title: "显示全部用例",
								onClick: function () { props.onSelect(""); },
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
								// 同上：条数已常驻显示，tooltip 只留名字。
								title: row.label,
								onClick: function () { props.onSelect(row.value); },
							},
								h("span", { className: "dp-cat-name" }, row.label),
								h("span", { className: "dp-cat-count" }, String(row.count))
							),
							null
						);
					})
				),
				// 放不下才分页；放得下就整条不渲染，不留空条。
				needPager ? h("div", { className: "dp-cat-pager" },
					h("button", {
						type: "button",
						className: "dp-cat-pager-btn",
						disabled: currentPage <= 1,
						title: "上一页层级",
						"aria-label": "上一页层级",
						onClick: function () { if (currentPage > 1) setPage(currentPage - 1); }
					}, h(Icon, { name: "chevron", size: 12, style: { transform: "rotate(180deg)" } })),
					h("span", { className: "dp-cat-pager-page" }, currentPage + "/" + totalPages),
					h("button", {
						type: "button",
						className: "dp-cat-pager-btn",
						disabled: currentPage >= totalPages,
						title: "下一页层级",
						"aria-label": "下一页层级",
						onClick: function () { if (currentPage < totalPages) setPage(currentPage + 1); }
					}, h(Icon, { name: "chevron", size: 12 }))
				) : null
			);
		}

		function RecordFormModal(props) {
			var initial = props.record || {};
			var state = useState(function () {
				return {
					caseId: initial.caseId || "",
					title: initial.title || "",
					testType: TEST_TYPE_KEYS.indexOf(initial.testType) !== -1 ? initial.testType : (props.mode === "edit" ? "" : "functional"),
					description: initial.description || "",
					input: initial.input || "",
					expected: initial.expected || "",
					code: initial.code || "",
					codeRef: initial.codeRef || "",
					category: initial.category || "",
					subjectFunction: subjectFunctionOf(initial)
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
				if (TEST_TYPE_KEYS.indexOf(values.testType) === -1) {
					setLocalError("请选择测试类型");
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
						}, testTypeOptions(values.testType))
					),
					h(FunctionField, { value: values.subjectFunction, functions: props.functions, listId: "dp-form-functions", onChange: function (value) { set("subjectFunction", value); } }),
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
						label: "测试代码位置（可选）",
						full: true,
						hint: "旧数据兼容字段。查看测试代码会按运行器的测试文件和用例目标定位，不依赖此路径。"
					},
						h("input", {
							className: "dp-input mono",
							value: values.codeRef,
							maxLength: 200,
							placeholder: "测试文件#L行号（可留空）",
							onChange: function (event) { set("codeRef", event.target.value); }
						})
					),
						h(Field, { label: "代码", full: true, hint: "这条用例的测试代码文本；实际执行仍以测试文件中的代码为准。" },
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
			// 与集成测试共用一个壳时，非激活的那一个只是隐藏，不卸载（保留搜索/分页/勾选）。
			var hidden = props.hidden === true;
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
			// 当前展开了执行记录的用例 id 集合（可以同时展开多行）。
			// 同事 d57e506 把它退回了单值 expandedId，这里恢复成多行展开。
			var expandedState = useState([]);
			var expandedIds = expandedState[0];
			var setExpandedIds = expandedState[1];
			// 点击执行后保持等待提示，直到用户主动刷新。
			var awaitingState = useState({});
			var awaiting = awaitingState[0];
			var setAwaiting = awaitingState[1];
			var runRefreshState = useState(0);
			var runRefreshTick = runRefreshState[0];
			var setRunRefreshTick = runRefreshState[1];
			// 正在查看的那次执行（{ record, run }）。
			var runViewState = useState(null);
			var runView = runViewState[0];
			var setRunView = runViewState[1];
			// 删除执行记录的二次确认。
			var removeRunState = useState(null);
			var removeRun = removeRunState[0];
			var setRemoveRun = removeRunState[1];
			// 当前函数：空串看全部，null 看未关联，其余按业务函数筛选。
			var categoryState = useState("");
			var activeCategory = categoryState[0];
			var setActiveCategory = categoryState[1];
			// 左栏常驻显示，不再提供折叠。
			// 表格勾选（存 record.id）。
			var pickedState = useState([]);
			var picked = pickedState[0];
			var setPicked = pickedState[1];
			// 批量关联函数弹窗。
			var categoryPromptState = useState(null);
			var categoryPrompt = categoryPromptState[0];
			var setCategoryPrompt = categoryPromptState[1];
			// 右栏表格卡片的实测高度：左栏用它决定能放几层、要不要分页。
			var boardHeightState = useState(0);
			var boardHeight = boardHeightState[0];
			var setBoardHeight = boardHeightState[1];
			var boardRef = useRef(null);

			// 量表格卡片高度。窗口缩放、行数变化、分页条出现/消失都会触发。
			useEffect(function () {
				if (typeof ResizeObserver === "undefined") return undefined;
				var node = boardRef.current;
				if (!node) return undefined;
				var observer = new ResizeObserver(function (entries) {
					var entry = entries[0];
					var height = entry && entry.contentRect ? entry.contentRect.height : 0;
					setBoardHeight(Math.round(height));
				});
				observer.observe(node);
				return function () { observer.disconnect(); };
			}, []);

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
					// 函数关联来自统一字段，不从旧分类或测试函数猜测。
					if (activeCategory !== "") {
						var owned = subjectFunctionOf(record);
						if (activeCategory === null ? owned !== "" : owned !== activeCategory) return false;
					}
					if (type !== "all" && record.testType !== type) return false;
					if (!needle) return true;
					return [record.caseId, record.title, record.description, record.input, record.expected, record.subjectFunction]
						.join(" ")
						.toLowerCase()
						.indexOf(needle) !== -1;
				});
			}, [records, query, type, activeCategory]);


			var categoryRows = useMemo(function () { return functionRows(records); }, [records]);
			var functionNames = categoryRows.slice(2).map(function (row) { return row.value; });

			var pickedSet = useMemo(function () {
				var map = Object.create(null);
				picked.forEach(function (id) { map[id] = true; });
				return map;
			}, [picked]);

			var typeCounts = {};
			TEST_TYPE_KEYS.forEach(function (key) { typeCounts[key] = 0; });
			records.forEach(function (record) {
				if (Object.prototype.hasOwnProperty.call(typeCounts, record.testType)) {
					typeCounts[record.testType] += 1;
				}
			});

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
				setForm({ mode: "create", record: { subjectFunction: activeCategory || "" } });
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
				// 保持展开，通知各行只读取一次最新执行结果。
				setAwaiting({});
				setRunRefreshTick(function (n) { return n + 1; });
				store.load(true).catch(function () {});
			}

			/**
			 * 展开 / 收起某条用例的执行记录。
			 * 多行可同时展开；手动刷新时保留展开状态。
			 */
			function toggleExpand(id) {
				setExpandedIds(function (previous) {
					var at = previous.indexOf(id);
					if (at === -1) return previous.concat([id]);
					return previous.filter(function (item) { return item !== id; });
				});
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
				store.assignFunction(ids, category, panelSessionId(props)).then(function () {
					setPicked([]);
					store.setError("");
				}).catch(function (failure) {
					store.setError("关联失败：" + (failure && failure.message ? failure.message : String(failure)));
				}).finally(function () {
					setBusy(false);
				});
			}

			function submitCategoryName(name) {
				setCategoryPrompt(null);
				assignPicked(name);
			}

			var loading = (snap.status === "idle" || snap.status === "loading") && records.length === 0;
			// 还没拿到当前会话：不能去读任何数据，界面直接说清楚在等什么。
			var waitingSession = snap.status === "waiting-session";
			var filtering = query.trim() !== "" || type !== "all";

			// 面板只作为右侧栏的「测试用例」tab 存在（见 apply 里的注册）。
			// 本组件现在只由右侧栏那个 tab 装载，不再有"主区形态"。
			return h("div", {
				className: cn("dp-root", docked ? "dp-docked" : ""),
				// 切到集成测试时只隐藏，不卸载：回来时搜索、分页、勾选都还在。
				style: hidden ? { display: "none" } : null
			},
				h("div", { className: "dp-shell" },
					h("div", { className: "dp-header" },
						h("div", null,
							h(TestModeTabs, { mode: "unit", onChange: props.onModeChange })
						),
						h("div", { className: "dp-stats" },
							h("div", { className: "dp-stat" },
								h("b", null, String(records.length)),
								h("span", null, "全部用例")
							),
							TEST_TYPE_KEYS.map(function (key) {
								return h("div", { key: key, className: "dp-stat" },
									h("b", null, String(typeCounts[key])),
									h("span", null, TEST_TYPES[key].label)
								);
							}),
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
				// 表格卡片的高度由 boardRef 量出来，交给左栏算每页能放几层。
				h("div", { className: "dp-board" },
					h(CategorySidebar, {
						rows: categoryRows,
						activeCategory: activeCategory,
						pickedCount: picked.length,
						docked: docked,
						boardHeight: boardHeight,
						onSelect: function (value) { setActiveCategory(value); setPage(1); setPicked([]); }
					}),
					h("div", { className: "dp-main" },
						h("div", { className: "dp-card", ref: boardRef },
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
											total: records.length,
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
												var isOpen = expandedIds.indexOf(record.id) !== -1;
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
															onClick: function () { toggleExpand(record.id); }
														}, h(Icon, { name: "chevron", size: 19 })),
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
																name: "source",
																label: "查看测试代码",
																onClick: function () {
																if (typeof props.openTestCode === "function") props.openTestCode(record.caseId, props.sessionId);
																}
															}),
															h(IconButton, {
																name: "play",
																label: "执行",
																onClick: function () {
															// 点执行 = 宿主准备好命令，再预填到面板所属会话的输入框。
															var targetSession2 = panelSessionId(props);
											if (record.demo) {
												setRunResult("");
												store.setError("这是示例数据，没有可执行的测试代码。先让 AI 按 Skill 生成测试代码，或换一个真实用例。");
												return;
											}
															setRunResult("正在准备执行 " + record.caseId + "…");
															prepareRun(targetSession2, "case", record.caseId).then(function (prep) {
																var promptText = runPrompt(record, targetSession2, prep);
																var outcome = prefillDraft(targetSession2, promptText);
																if (!outcome.ok) { setRunResult(""); store.setError("执行：" + outcome.message); return; }
																store.setError("");
																setRunResult(outcome.message + "  运行编号：" + prep.runId + "  框架：" + (prep.framework || prep.frameworkId || "未知"));
																// 只标记本次执行；不订阅对话，不发起后台读取。
																setAwaiting(function (previous) {
																	var next = Object.assign({}, previous);
																	next[record.id] = { caseId: record.caseId, runId: prep.runId || "" };
																	return next;
																});
																setExpandedIds(function (previous) {
																	return previous.indexOf(record.id) === -1 ? previous.concat([record.id]) : previous;
																});
															}).catch(function (failure) {
																setRunResult("");
																store.setError("执行准备失败：" + (failure && failure.message ? failure.message : String(failure)));
															});
																}
															}),
															h(IconButton, {
																name: "edit",
																label: "编辑",
																onClick: function () { openEdit(record); }
															}),
															h(IconButton, {
																	name: "trash",
																	label: "删除",
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
															awaiting: awaiting[record.id] !== undefined,
															pendingRunId: awaiting[record.id] ? awaiting[record.id].runId : "",
															refreshTick: runRefreshTick,
											onReport: function (run) { openRunReport(record, run); },
											onLog: function (run) { setLogView({ record: record, runId: run.runId }); },
															onRemove: function (runId, done) { setRemoveRun({ record: record, runId: runId, done: done }); },

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
								h("span", { className: "dp-pick-count" }, "已选 ", h("b", null, String(picked.length)), " 条"),
								h(Button, { size: "sm", disabled: busy, onClick: function () { setCategoryPrompt({ initialValue: activeCategory || "" }); } }, "关联被测函数"),
								h(Button, { variant: "ghost", size: "sm", onClick: function () { setPicked([]); } }, "取消选择")
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
					functions: functionNames,
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
				categoryPrompt !== null ? h(CategoryPrompt, {
					title: "关联被测函数",
					subtitle: "为已选的 " + picked.length + " 条用例设置源码中的业务函数。",
					initialValue: categoryPrompt.initialValue,
					functions: functionNames,
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
					title: confirm.kind === "clearDemo" ? "清空示例用例？" : "删除这条用例？",
					message: confirm.kind === "clearDemo" ? "只会移除标记为示例的用例，你后来新建或编辑过的内容会保留。" : "删除后无法恢复，右侧已打开的详情页也会变为空。",
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
					testType: TEST_TYPE_KEYS.indexOf(record.testType) !== -1 ? record.testType : "",
					description: record.description || "",
					input: record.input || "",
					expected: record.expected || "",
					code: record.code || "",
					codeRef: record.codeRef || "",
					subjectFunction: subjectFunctionOf(record)
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
				if (TEST_TYPE_KEYS.indexOf(values.testType) === -1) {
					setLocalError("请选择测试类型");
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
						}, testTypeOptions(values.testType))
					),
					h(FunctionField, { value: values.subjectFunction, functions: functionRows(store.getSnapshot().records).slice(2).map(function (row) { return row.value; }), listId: "dp-detail-functions", onChange: function (value) { set("subjectFunction", value); } }),
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
					h(Field, { label: "测试代码位置（可选）", hint: "旧数据兼容字段；查看测试代码按测试文件和目标定位" },
						h("input", {
							className: "dp-input mono",
							value: values.codeRef,
							maxLength: 200,
							placeholder: "测试文件#L行号（可留空）",
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
					h(Button, { size: "sm", onClick: props.onOpenCode },
						h(Icon, { name: "location", size: 14 }),
						"查看测试代码"
						),
					h(Button, { size: "sm", onClick: props.onEdit }, h(Icon, { name: "edit", size: 14 }), "编辑"),
					h(Button, { size: "sm", variant: "danger", onClick: props.onDelete }, h(Icon, { name: "trash", size: 14 }), "删除")
				),
				h("div", { className: "dp-section" },
					h("h4", null, "被测函数"),
					h("p", { className: "dp-summary" }, subjectFunctionOf(record) || "未关联函数")
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
					h("h4", null, "旧代码位置"),
					record.codeRef
						? h("p", { className: "dp-summary" }, h("code", { className: "dp-chip-mono" }, record.codeRef))
						: h("p", { className: "dp-summary", style: { color: "var(--dp-text3)" } }, "未填写；查看测试代码会按测试目标定位。")
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
						if (typeof props.openTestCode === "function") props.openTestCode(record.caseId, sessionId);
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

		//#region integration panel
		/*
		 * 集成测试前端演示。
		 *
		 * 定位：与单元测试共用一个面板壳，顶部「单元测试 / 集成测试」切换。
		 * 本轮只做界面与交互，不接后端、不发请求、不拉起对话执行 ——
		 * 执行 / 导出 / 日志等未接入的入口点了给出明确提示，不伪造成功。
		 *
		 * 数据全部来自 buildIntegrationSeed()，按 sessionId 隔离存放，
		 * 切换会话会重置成该会话自己的示例数据。
		 */

		/** 顶部「单元测试 / 集成测试」页签。 */
		function TestModeTabs(props) {
			var mode = props.mode === "integration" ? "integration" : "unit";
			function pick(next) {
				if (next === mode) return;
				if (typeof props.onChange === "function") props.onChange(next);
			}
			return h("div", { className: "it-tabs", role: "tablist", "aria-label": "测试类型" },
				h("button", {
					type: "button",
					role: "tab",
					className: cn("it-tab", mode === "unit" ? "is-active" : ""),
					"aria-selected": mode === "unit",
					"data-it": "mode-unit",
					onClick: function () { pick("unit"); }
				}, "单元测试"),
				h("button", {
					type: "button",
					role: "tab",
					className: cn("it-tab", mode === "integration" ? "is-active" : ""),
					"aria-selected": mode === "integration",
					"data-it": "mode-integration",
					onClick: function () { pick("integration"); }
				}, "集成测试")
			);
		}

		/**
		 * 面板壳：持有「当前看哪个测试」的状态，两个视图各自保留自己的状态。
		 *
		 * 为什么两个视图都渲染、只用一个 active 标记：
		 * 单元测试的 DataPanelView 内部有搜索、分页、勾选、展开等一堆状态，
		 * 切到集成测试再切回来不该被重置。宿主 tab 本身是 keepMounted 的，
		 * 这里同样不卸载，只用 active 控制显隐。
		 */
		function TestPanelHost(props) {
			var modeState = useState("unit");
			var mode = modeState[0];
			var setMode = modeState[1];
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";

			function change(next) {
				setMode(next === "integration" ? "integration" : "unit");
			}

			return h(React.Fragment, null,
				h(DataPanelView, Object.assign({}, props, {
					// DataPanelView 只在 active 时透出 onModeChange 供页签回调。
					onModeChange: change,
					mode: mode,
					hidden: mode !== "unit"
				})),
				h(IntegrationPanel, {
					key: "integration:" + sessionId,
					sessionId: sessionId,
					active: mode === "integration",
					// dock 透传下去：集成页要套 .dp-docked，才能和单元测试一样收紧留白。
					dock: props.dock === true,
					onModeChange: change
				})
			);
		}

		/**
		 * 集成测试里的下拉菜单（最多五项高度后滚动）。
		 *
		 * 用 position: fixed + 由触发按钮的矩形算出坐标，而不是 absolute。
		 * 原因：面板嵌在 DSH 右侧栏里，祖先容器带 overflow:auto（`.dp-root` 就是），
		 * absolute 菜单会被裁掉一半，看起来"显示到面板外面去了"。
		 * fixed 相对视口定位，不受祖先 overflow / transform 影响。
		 *
		 * props.anchorRef 指向触发按钮；拿不到时退回到 absolute（贴在按钮下方）。
		 * props.align：left（默认，左对齐按钮）| right（右对齐，用于版本菜单）。
		 * 菜单超出视口左右/下方时会自动翻转或夹紧，保证完整可见。
		 */
		function ItMenu(props) {
			if (props.open !== true) return null;
			var style = {};
			var anchor = props.anchorRef && props.anchorRef.current;
			if (anchor && typeof anchor.getBoundingClientRect === "function") {
				var rect = anchor.getBoundingClientRect();
				var margin = 6;
				var viewportW = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 0;
				var viewportH = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 0;
				// 菜单宽度：调用方可以给，否则用 CSS 里的 min-width 估算值。
				var width = Number(props.width) || (props.align === "right" ? 178 : 148);
				var maxHeight = Number(props.maxHeight) || 184;

				var left = props.align === "right" ? rect.right - width : rect.left;
				// 左右夹紧，别超出视口
				if (viewportW > 0) {
					if (left + width > viewportW - 8) left = viewportW - width - 8;
					if (left < 8) left = 8;
				}
				var top = rect.bottom + margin;
				// 下方放不下就翻到按钮上方
				if (viewportH > 0 && top + maxHeight > viewportH - 8) {
					var above = rect.top - margin - maxHeight;
					if (above > 8) top = above;
					else top = Math.max(8, viewportH - maxHeight - 8);
				}
				style.position = "fixed";
				style.left = Math.round(left) + "px";
				style.top = Math.round(top) + "px";
				style.width = Math.round(width) + "px";
				style.maxHeight = Math.round(maxHeight) + "px";
			}
			return h("div", {
				className: cn("it-switch-menu", props.className),
				role: "menu",
				style: Object.keys(style).length > 0 ? style : null,
				"data-it": props.testId
			}, props.children);
		}

		/** 一行「标签 + 值」，详情里复用。 */
		function ItKv(props) {
			return h("dl", { className: "it-kv" },
				(props.rows || []).map(function (row) {
					return h(React.Fragment, { key: row[0] },
						h("dt", null, row[0]),
						h("dd", null, row[1] === "" || row[1] === undefined || row[1] === null ? "—" : row[1])
					);
				})
			);
		}

		/** 步骤明细表（展开区 / 详情共用）。 */
		function ItStepTable(props) {
			var steps = Array.isArray(props.steps) ? props.steps : [];
			if (steps.length === 0) {
				return h("div", { className: "it-empty" }, "这条用例还没有操作步骤");
			}
			return h("div", { className: "it-scroll-5" },
				h("table", { className: "it-mini" },
					h("thead", null,
						h("tr", null,
							h("th", { style: { width: "38px" } }, "编号"),
							h("th", { style: { width: "26%" } }, "动作"),
							h("th", null, "输入步骤"),
							h("th", { style: { width: "30%" } }, "预期结果")
						)
					),
					h("tbody", null, steps.map(function (step, index) {
						return h("tr", { key: index },
							h("td", null, String(step.no || index + 1)),
							h("td", { className: "it-left" }, step.action || "—"),
							h("td", { className: "it-left" }, step.operation || "—"),
							h("td", { className: "it-left" }, step.expected || "—")
						);
					}))
				)
			);
		}

/**
		 * 用例详情 / 新增编辑（对齐原型弹窗形态）。
		 *
		 * 同一套字段承担「看」和「改」：props.mode === "edit" 时可编辑。
		 * 保存时回传完整对象，父组件负责落到对应版本的数据里。
		 *
		 * 字段形态按原型：
		 *   · 必填项标题前有红色 *，「用例名称」是唯一必填
		 *   · 输入框 / 文本域右下角有「已输入 / 上限」计数，写满不再增长（maxLength 兜住）
		 *   · 「用例分类」直接填名称，下面一行灰字说明「填已有的是归组，填新名称就是新建」
		 *   · 底部按钮固定为「取消（线条框）+ 保存（蓝底）」
		 */
		function IntegrationCaseEditor(props) {
			var mode = props.mode === "edit" ? "edit" : "view";
			var source = props.record || {};
			var LIMITS = { title: 100, scenario: 30, description: 300, precondition: 300 };
			var state = useState(function () {
				return {
					caseId: source.caseId || "",
					title: source.title || "",
					scenario: source.scenario || "",
					type: source.type || "ui",
					description: source.description || "",
					precondition: source.precondition || ""
				};
			});
			var form = state[0];
			var setForm = state[1];
			// 用例名称为空时点保存，标红提示，不静默失败。
			var errorState = useState(false);
			var titleError = errorState[0];
			var setTitleError = errorState[1];

			function edit(key) {
				return function (event) {
					var value = event && event.target ? event.target.value : "";
					var limit = LIMITS[key];
					if (limit && value.length > limit) value = value.slice(0, limit);
					setForm(function (previous) {
						var next = {};
						Object.keys(previous).forEach(function (k) { next[k] = previous[k]; });
						next[key] = value;
						return next;
					});
					if (key === "title" && value.trim() !== "") setTitleError(false);
				};
			}

			function save() {
				if (typeof props.onSave !== "function") return;
				// 图示里用例名称是必填项：空名称不进入保存流程。
				if (form.title.trim() === "") {
					setTitleError(true);
					return;
				}
				props.onSave(Object.assign({}, source, {
					caseId: form.caseId.trim(),
					title: form.title.trim(),
					scenario: form.scenario.trim(),
					type: form.type,
					description: form.description,
					precondition: form.precondition
				}));
			}

			var readonly = mode !== "edit";

			/** 标题行：可带上红色必填星标。 */
			function labelRow(text, required) {
				return h("span", { className: "it-field-label" },
					required ? h("i", { className: "it-required", "aria-hidden": "true" }, "*") : null,
					text
				);
			}

			/** 右下角字数计数，只在可编辑时显示。 */
			function counter(key) {
				if (readonly || !LIMITS[key]) return null;
				return h("span", { className: "it-count" },
					h("b", null, String(form[key].length)),
					" / " + LIMITS[key]
				);
			}

			function field(key, label, placeholder, opts) {
				var options = opts || {};
				var multiline = options.multiline === true;
				var value = form[key];
				var limit = LIMITS[key];
				return h("label", { key: key, className: "it-field" },
					labelRow(label, options.required === true),
					readonly
						? h("div", { className: "it-input", style: { minHeight: "30px", background: "var(--dp-bg2)" } }, value || "—")
						: h("div", { className: cn("it-input-wrap", multiline ? "is-area" : "") },
							multiline
								? h("textarea", {
									className: cn("it-area", options.hint ? "has-hint" : ""),
									value: value,
									placeholder: placeholder || "",
									maxLength: limit || undefined,
									"data-it": "field-" + key,
									onChange: edit(key)
								})
								: h("input", {
									className: cn("it-input", titleError && key === "title" ? "is-error" : ""),
									value: value,
									placeholder: placeholder || "",
									maxLength: limit || undefined,
									"data-it": "field-" + key,
									onChange: edit(key)
								}),
							counter(key)
						),
					options.hint ? h("span", { className: "it-field-hint" }, options.hint) : null,
					titleError && key === "title" ? h("span", { className: "it-field-error" }, "请填写用例名称") : null
				);
			}

			/*
			 * 用 Modal 承载详情/编辑 —— 新增用例必须是弹窗，不能内联把表格顶走。
			 * Modal 自带遮罩、Esc 关闭、点遮罩关闭，和单元测试的新增/编辑弹窗行为一致。
			 */
			return h(Modal, {
				title: mode === "edit" ? (source.id ? "编辑用例" : "新增用例") : (source.title || "用例详情"),
				// 原型弹窗是单列、约 700px：字段一列排下来比两列更好读。
				className: "it-case-modal",
				onClose: props.onClose,
				footer: [
					h(Button, { key: "close", variant: "ghost", onClick: props.onClose }, mode === "edit" ? "取消" : "关闭"),
					mode === "edit" ? h(Button, { key: "save", variant: "primary", "data-it": "save-case", onClick: save }, "保存") : null
				]
			},
				h("div", { className: "it-detail" },
					field("title", "用例名称", "如 商品加入购物车", { required: true }),
					/*
					 * 用例分类直接填名称：填一个已有的就归到那个分类，填新的就是新建。
					 * 这样不用先建分类再挂用例，录入链路短一截。
					 */
					field("scenario", "用例分类", "如 商品与购物车", {
						hint: "直接填写分类名称；填已有的分类就归到该分类，填新名称就是新建一个分类"
					}),
					field("description", "用例描述", "这条用例验证什么行为", { multiline: true }),
					h("div", { className: "it-grid-2" },
						h("label", { key: "type", className: "it-field" },
							labelRow("测试类型", false),
							readonly
								? h("div", { className: "it-input", style: { minHeight: "30px", background: "var(--dp-bg2)" } }, IT_TYPES[form.type]?.label || "—")
								: h("div", { className: "it-input-wrap" },
									h("select", { className: "it-input", value: form.type, "data-it": "field-type", onChange: edit("type") },
										IT_TYPE_KEYS.map(function (key) {
											return h("option", { key: key, value: key }, IT_TYPES[key].label);
										})
									)
								)
						),
						field("precondition", "前置条件", "执行前需要满足的条件")
					)
				)
			);
		}

		/**
		 * 步骤编辑弹窗：只编辑这条用例的操作步骤，不带用例本身那些字段。
		 *
		 * 为什么要单独一个弹窗：测试步骤页的「编辑」是这个页面自己的主操作，
		 * 它改的是步骤，不该跳进「编辑用例」那种表单里 —— 那边改的是名称、分类、描述。
		 * 两者入口不同、对象不同，混在一起会让人以为点错了。
		 *
		 * 保存时回传整条 record（steps 已替换），父组件直接替换即可。
		 */
		function IntegrationStepsModal(props) {
			var source = props.record || {};
			var stepsState = useState(function () {
				return Array.isArray(source.steps) ? source.steps.map(function (s) { return Object.assign({}, s); }) : [];
			});
			var steps = stepsState[0];
			var setSteps = stepsState[1];

			function save() {
				if (typeof props.onSave !== "function") return;
				props.onSave(Object.assign({}, source, { steps: steps }));
			}

			return h(Modal, {
				title: "编辑测试步骤",
				subtitle: (source.caseId ? source.caseId + " · " : "") + (source.title || ""),
				className: "it-case-modal it-steps-modal",
				onClose: props.onClose,
				footer: [
					h(Button, { key: "close", variant: "ghost", onClick: props.onClose }, "取消"),
					h(Button, { key: "save", variant: "primary", "data-it": "save-steps-modal", onClick: save }, "保存")
				]
			},
				h("div", { className: "it-detail" },
					h(IntegrationStepsEditor, {
						steps: steps,
						embedded: true,
						onSave: function (next) { setSteps(next); },
						onClose: props.onClose
					})
				)
			);
		}

		/**
		 * 步骤编辑器：增加 / 删除 / 上移下移 / 改内容。
		 *
		 * 不直接改 props.steps —— 全部改动在本地副本上做，
		 * 点保存才回传，取消就丢弃（测试里明确校验了「不更改传入数据」）。
		 */
		function IntegrationStepsEditor(props) {
			// 两种传法都支持：
			//   props.steps  —— 直接给一组步骤（详情里编辑用）
			//   props.record —— 给整条用例，取它的 steps（外部直接挂这个组件时用）
			var incoming = Array.isArray(props.steps)
				? props.steps
				: (Array.isArray(props.record?.steps) ? props.record.steps : []);
			var state = useState(function () {
				return incoming.map(function (s, i) {
					return { no: i + 1, action: s.action || "", operation: s.operation || "", expected: s.expected || "" };
				});
			});
			var rows = state[0];
			var setRows = state[1];

			function renumber(list) {
				return list.map(function (row, index) {
					return Object.assign({}, row, { no: index + 1 });
				});
			}
			/*
			 * 所有改动都经这一个入口，而不是各处直接 setRows。
			 *
			 * 原因：嵌在 IntegrationStepsModal 里时（embedded），弹窗底部才是「保存」，
			 * 本组件自带的按钮被隐藏了。此时必须把每次改动实时同步给父组件，
			 * 否则用户在输入框里改完直接点弹窗的「保存」，改的内容会丢。
			 *
			 * 用「先算新值、再分别更新」的写法，避免在 setState 的 updater 里
			 * 再去调父组件的 setState。
			 */
			function apply(compute) {
				var next = renumber(compute(rows));
				setRows(next);
				if (props.embedded === true && typeof props.onSave === "function") props.onSave(next);
				return next;
			}
			function move(index, delta) {
				var target = index + delta;
				if (target < 0 || target >= rows.length) return;
				apply(function (list) {
					var next = list.slice();
					var tmp = next[index];
					next[index] = next[target];
					next[target] = tmp;
					return next;
				});
			}
			function removeAt(index) {
				apply(function (list) {
					return list.filter(function (_, i) { return i !== index; });
				});
			}
			function add() {
				apply(function (list) {
					return list.concat([{ no: list.length + 1, action: "", operation: "", expected: "" }]);
				});
			}
			function change(index, key) {
				return function (event) {
					var value = event && event.target ? event.target.value : "";
					apply(function (list) {
						return list.map(function (row, i) {
							return i === index ? Object.assign({}, row, { [key]: value }) : row;
						});
					});
				};
			}
			function save() {
				if (typeof props.onSave !== "function") return;
				var next = renumber(rows);
				/*
				 * 回传形态取决于它被谁用：
				 *   详情里编辑（props.steps）→ 只需要步骤数组；
				 *   拿到整条用例（props.record）→ 回传合并后的用例对象，
				 *     调用方直接替换即可，不用自己再拼。
				 * 测试对后者断言 saved[0].steps，因此按 record 形态返回。
				 */
				if (Array.isArray(props.steps) && !props.record) props.onSave(next);
				else props.onSave(Object.assign({}, props.record || {}, { steps: next }));
			}

			return h("div", null,
				h("div", { className: "it-scroll-5" },
					rows.length === 0
						? h("div", { className: "it-empty" }, "还没有步骤，点下面「新增步骤」加一条")
						: rows.map(function (row, index) {
							return h("div", { key: index, className: "it-step-row" },
								h("span", { className: "it-step-no" }, String(index + 1)),
								h("input", {
									className: "it-input",
									value: row.action,
									placeholder: "动作",
									"data-it": "step-action-" + index,
									onChange: change(index, "action")
								}),
								h("input", {
									className: "it-input it-step-col-3",
									value: row.operation,
									placeholder: "输入步骤",
									"data-it": "step-operation-" + index,
									onChange: change(index, "operation")
								}),
								h("input", {
									className: "it-input",
									value: row.expected,
									placeholder: "预期结果",
									"data-it": "step-expected-" + index,
									onChange: change(index, "expected")
								}),
								h("span", { className: "it-step-ops" },
									h(IconButton, {
										name: "chevron",
										label: "上移第 " + (index + 1) + " 步",
										className: "it-step-up",
										"data-it": "step-up-" + index,
										disabled: index === 0,
										onClick: function () { move(index, -1); }
									}),
									h(IconButton, {
										name: "chevron",
										label: "下移第 " + (index + 1) + " 步",
										className: "it-step-down",
										"data-it": "step-down-" + index,
										disabled: index === rows.length - 1,
										onClick: function () { move(index, 1); }
									}),
									h(IconButton, {
										name: "trash",
										danger: true,
										label: "删除第 " + (index + 1) + " 步",
										"data-it": "step-delete-" + index,
										onClick: function () { removeAt(index); }
									})
								)
							);
						})
				),
				h("div", { className: "it-detail-foot", style: { justifyContent: "space-between", marginTop: "8px" } },
					h(Button, { size: "sm", variant: "ghost", onClick: add, "data-it": "add-step" }, "新增步骤"),
					/*
					 * embedded 时不渲染自带的「取消 / 保存步骤」：
					 * 它被 IntegrationStepsModal 包着用时，保存的语义在弹窗底部那对按钮上，
					 * 这里再来一对会让人不知道该按哪个。
					 */
					props.embedded === true
						? null
						: h("span", { style: { display: "inline-flex", gap: "7px" } },
							h(Button, { size: "sm", variant: "ghost", onClick: props.onClose }, "取消"),
							h(Button, { size: "sm", variant: "primary", onClick: save, "data-it": "save-steps" }, "保存步骤")
						)
				)
			);
		}

		/**
		 * 项目总体报告：选择要把哪些用例纳入汇总。
		 *
		 * 「排除」只影响本次汇总的纳入集合，不动原始用例和报告 ——
		 * 测试里明确断言 records 长度不变。
		 */
		function IntegrationOverview(props) {
			var records = Array.isArray(props.records) ? props.records : [];
			var state = useState(function () {
				return records.map(function (record) { return record.id; });
			});
			var included = state[0];
			var setIncluded = state[1];

			var byId = Object.create(null);
			records.forEach(function (record) { byId[record.id] = record; });
			var shown = records.filter(function (record) { return included.indexOf(record.id) !== -1; });
			var passed = shown.filter(function (record) { return record.status === "pass"; }).length;
			var failed = shown.filter(function (record) { return record.status === "fail"; }).length;
			var scenarios = [];
			shown.forEach(function (record) {
				var name = itScenarioOf(record);
				if (scenarios.indexOf(name) === -1) scenarios.push(name);
			});

			function exclude(id) {
				setIncluded(function (previous) {
					return previous.filter(function (item) { return item !== id; });
				});
			}
			function restoreAll() {
				setIncluded(records.map(function (record) { return record.id; }));
			}

			/* 总体报告也用弹窗：它是一份汇总视图，不应把下面的表格顶掉。 */
			return h(Modal, {
				title: "项目总体报告",
				subtitle: "纳入 " + shown.length + " 条 · 通过 " + passed + " / 未通过 " + failed,
				wide: true,
				onClose: props.onClose,
				footer: [
					h(Button, { key: "restore", variant: "ghost", "data-it": "restore-all", onClick: restoreAll }, "全部恢复"),
					h(Button, {
						key: "export",
						variant: "ghost",
						onClick: function () { if (typeof props.onNotice === "function") props.onNotice("演示数据：导出项目报告还没接入后端。"); }
					}, "导出"),
					h(Button, { key: "close", onClick: props.onClose }, "关闭")
				]
			},
				h("div", { className: "it-overview" },
					h("div", { className: "it-overview-stat" },
						h("span", null, "纳入 ", h("b", null, String(shown.length)), " 条"),
						h("span", null, "通过 ", h("b", null, String(passed))),
						h("span", null, "未通过 ", h("b", null, String(failed))),
						h("span", null, "场景覆盖 ", h("b", null, String(scenarios.length)))
					),
					h("div", { className: "it-scroll-5" },
						h("table", { className: "it-mini" },
							h("thead", null,
								h("tr", null,
									h("th", { style: { width: "76px" } }, "用例标识"),
									h("th", null, "用例名称"),
									h("th", { style: { width: "74px" } }, "场景"),
									h("th", { style: { width: "60px" } }, "结果"),
									h("th", { style: { width: "58px" } }, "操作")
								)
							),
							h("tbody", null, shown.length === 0
								? h("tr", null, h("td", { colSpan: 5 }, "还没有纳入任何用例"))
								: shown.map(function (record) {
									var meta = IT_STATUS[record.status] || IT_STATUS.none;
									return h("tr", { key: record.id, "data-it": "overview-" + record.id },
										h("td", { className: "it-case-id" }, record.caseId || "—"),
										h("td", { className: "it-left" }, record.title || "—"),
										h("td", null, itScenarioOf(record)),
										h("td", null, h("span", { className: "it-pill", "data-tone": meta.tone }, meta.label)),
										h("td", null, h(Button, {
											size: "sm",
											variant: "ghost",
											"data-it": "exclude-" + record.id,
											onClick: function () { exclude(record.id); }
										}, "排除"))
									);
								})
							)
						)
					)
				)
			);
		}
		//#endregion

		/**
		 * 集成测试主面板：三个子页（测试用例 / 测试步骤 / 测试报告）。
		 *
		 * 三个子页共用同一份「当前版本 + 当前场景」，但各自保留搜索、筛选与页码，
		 * 因为它们的列和用途不同，串在一起反而难用。
		 *
		 * active === false 时仍然渲染（不卸载），只靠样式隐藏，
		 * 这样切回单元测试再切回来，子页/筛选/展开状态都还在。
		 */
		function IntegrationPanel(props) {
			var active = props.active === true;
			var sessionId = typeof props.sessionId === "string" ? props.sessionId : "";
			var seedState = useState(function () { return buildIntegrationSeed(); });
			var seed = seedState[0];
			var setSeed = seedState[1];
			// 当前版本：切版本会换一整套用例数据，互不影响。
			var versionState = useState(seed.activeVersion);
			var version = versionState[0];
			var setVersion = versionState[1];
			var versionOpenState = useState(false);
			var versionOpen = versionOpenState[0];
			var setVersionOpen = versionOpenState[1];
			// 子页下拉（测试用例 / 测试步骤 / 测试报告）是否展开。
			var switchOpenState = useState(false);
			var switchOpen = switchOpenState[0];
			var setSwitchOpen = switchOpenState[1];
			// 两个下拉的触发按钮：菜单用 fixed 定位，需要按钮的矩形。
			var switchBtnRef = useRef(null);
			var versionBtnRef = useRef(null);

			/*
			 * 点空白处 / 按 Esc 关闭两个下拉。
			 * 菜单是 fixed 定位、浮在最上层，不主动关会一直悬在那里挡住表格。
			 * 用捕获阶段监听，避免被内部按钮的 onClick 拦掉。
			 */
			useEffect(function () {
				if (!switchOpen && !versionOpen) return undefined;
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined;
				function onDown(event) {
					var target = event && event.target;
					// 点在菜单内部或触发按钮上就交给各自的 onClick 处理。
					var node = target;
					while (node && node !== document) {
						if (node.getAttribute && (node.getAttribute("data-it") === "switch-menu" ||
							node.getAttribute("data-it") === "version-menu" ||
							(node.getAttribute("data-it") || "").indexOf("menu-panel") !== -1)) return;
						node = node.parentNode;
					}
					setSwitchOpen(false);
					setVersionOpen(false);
				}
				function onKey(event) {
					if (event && event.key === "Escape") {
						setSwitchOpen(false);
						setVersionOpen(false);
					}
				}
				document.addEventListener("mousedown", onDown, true);
				document.addEventListener("keydown", onKey);
				return function () {
					document.removeEventListener("mousedown", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, [switchOpen, versionOpen]);
			// 子页：cases / steps / reports。
			var tabState = useState("cases");
			var tab = tabState[0];
			var setTab = tabState[1];
			// 场景筛选 + 搜索 + 类型/状态筛选。
			var scenarioState = useState(IT_SCENARIOS_ALL);
			var scenario = scenarioState[0];
			var setScenario = scenarioState[1];
			var queryState = useState("");
			var query = queryState[0];
			var setQuery = queryState[1];
			var typeState = useState("all");
			var type = typeState[0];
			var setType = typeState[1];
			var statusState = useState("all");
			var status = statusState[0];
			var setStatus = statusState[1];
			/*
			 * 分页：三个子页各自记页码，共用每页条数。
			 * 页码各记一份是因为它们的行数不同（用例 9 行、步骤展开后可能更多），
			 * 共用一个页码会在切子页时跳到不存在的页。切筛选条件时统一回第 1 页。
			 */
			var casePageState = useState(1);
			var casePage = casePageState[0];
			var setCasePage = casePageState[1];
			var stepPageState = useState(1);
			var stepPage = stepPageState[0];
			var setStepPage = stepPageState[1];
			var reportPageState = useState(1);
			var reportPage = reportPageState[0];
			var setReportPage = reportPageState[1];
			var pageSizeState = useState(10);
			var pageSize = pageSizeState[0];
			var setPageSize = pageSizeState[1];
			// 报告页被收起的场景名（默认全展开）。
			var collapsedState = useState([]);
			var collapsed = collapsedState[0];
			var setCollapsed = collapsedState[1];
			/*
			 * 步骤页里被展开的行（存 record.id）。
			 * 只有测试步骤这一页有行内下拉：箭头挂在序号格里，展开后是执行结果子表。
			 */
			var stepOpenState = useState([]);
			var stepOpen = stepOpenState[0];
			var setStepOpen = stepOpenState[1];
			// 详情层：null | { mode, record }。
			var detailState = useState(null);
			var detail = detailState[0];
			var setDetail = detailState[1];
			// 删除确认：null | { record }。
			var confirmState = useState(null);
			var confirm = confirmState[0];
			var confirmSet = confirmState[1];
			// 总体报告层。
			var overviewState = useState(false);
			var overview = overviewState[0];
			var setOverview = overviewState[1];
			// 顶部提示（未接入功能的说明）。
			var noticeState = useState("");
			var notice = noticeState[0];
			var setNotice = noticeState[1];

			var records = Array.isArray(seed.byVersion[version]) ? seed.byVersion[version] : [];

			/** 改当前版本的数据；其他版本原样保留。 */
			function patchRecords(next) {
				setSeed(function (previous) {
					var map = {};
					Object.keys(previous.byVersion).forEach(function (name) {
						map[name] = name === version ? next : previous.byVersion[name];
					});
					return {
						versions: previous.versions.map(function (item) {
							return item.name === version
								? Object.assign({}, item, { count: next.length })
								: item;
						}),
						activeVersion: previous.activeVersion,
						byVersion: map
					};
				});
			}

			function filtered() {
				return itFilterRecords(records, { query: query, scenario: scenario, type: type, status: status });
			}

			/**
			 * 筛选条件一变，当前页码就指向旧结果集的某一页，必须回到第 1 页。
			 * 三个子页各自回位，交互上才符合「换了筛选就是重新开始看」。
			 */
			function resetPages() {
				setCasePage(1);
				setStepPage(1);
				setReportPage(1);
			}

			/** 展开 / 收起步骤页某一行的执行结果子表。 */
			function toggleStepOpen(id) {
				setStepOpen(function (previous) {
					return previous.indexOf(id) === -1
						? previous.concat([id])
						: previous.filter(function (item) { return item !== id; });
				});
			}

			function refresh() {
				// 刷新只提示，不动数据：这里还没有后端可重读。
				setNotice("演示数据：真实数据接入后这里会重读最新记录。");
			}
			function notConnected(name) {
				setNotice("演示数据：" + name + "还没接入后端，等后续规范确认后再实现。");
			}

			/** 保存用例（新增或编辑）。 */
			function saveCase(next) {
				var exists = records.some(function (record) { return record.id === next.id; });
				if (exists) {
					patchRecords(records.map(function (record) {
						return record.id === next.id ? Object.assign({}, record, next) : record;
					}));
				} else {
					var id = "it-new-" + Date.now();
					patchRecords(records.concat([Object.assign({}, next, {
						id: id,
						caseId: next.caseId || ("IT-" + String(records.length + 1).padStart(3, "0")),
						status: next.status || "none",
						lastRunAt: next.lastRunAt || "",
						// 生成时间在新增时点一次，之后编辑不再变（用例表的「生成时间」列）。
						createdAt: next.createdAt || new Date().toISOString().slice(0, 19),
						records: next.records || [],
						steps: Array.isArray(next.steps) ? next.steps : []
					})]));
				}
				setDetail(null);
				setNotice("");
			}
			function removeCase(record) {
				patchRecords(records.filter(function (item) { return item.id !== record.id; }));
				confirmSet(null);
			}

			var scenarios = itScenarioRows(records);
			var typeCounts = {};
			IT_TYPE_KEYS.forEach(function (key) { typeCounts[key] = 0; });
			records.forEach(function (record) {
				if (typeCounts[record.type] !== undefined) typeCounts[record.type] += 1;
			});
			var current = filtered();

			/** 场景侧栏。 */
			function sidebar() {
				return h("aside", { className: "it-side" },
					h("div", { className: "it-side-title" }, "场景"),
					scenarios.map(function (row) {
						return h("button", {
							key: row.key,
							type: "button",
							className: cn("it-side-item", scenario === row.name ? "is-active" : ""),
							onClick: function () { setScenario(row.name); resetPages(); }
						},
							h("span", { className: "it-side-name" }, row.name),
							h("span", { className: "it-side-count" }, String(row.count))
						);
					})
				);
			}

/*
			 * 三个子页的统一分页。
			 *
			 * 复用单元测试的 .dp-pager 一套（共 N 条 / 每页几条 / 上一页 / 页码 / 下一页），
			 * 换成 15 条的需求就改 sizes 即可。
			 */
			function pager(rows, pageValue, setPageValue, testId) {
				var pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
				// 数据变少（删除、筛选）后当前页可能越界，这里就地夹紧，不改状态。
				var current = Math.min(Math.max(1, pageValue), pageCount);
				return h("div", { className: "dp-pager it-pager", "data-it": testId || "pager" },
					h("span", { className: "dp-pager-total" }, "共 " + rows.length + " 条"),
					/*
					 * 这里只写「每页 + 下拉」，不再在末尾补一个「条」——
					 * option 文案本身就是「10 条」，再补一个会显示成「每页 10 条 条」。
					 */
					h("span", { className: "dp-pager-size" }, "每页",
						h("select", {
							value: String(pageSize),
							onChange: function (event) {
								var next = Number(event.target.value);
								setPageSize(next > 0 ? next : 10);
								setPageValue(1);
							},
							"aria-label": "每页条数"
						}, [5, 10, 15, 20, 50].map(function (size) {
							return h("option", { key: size, value: String(size) }, size + " 条");
						}))
					),
					h("button", {
						type: "button",
						className: "dp-pager-btn",
						disabled: current <= 1,
						"data-it": "page-prev",
						onClick: function () { if (current > 1) setPageValue(current - 1); }
					}, "上一页"),
					h("span", { className: "dp-pager-page" }, current + " / " + pageCount),
					h("button", {
						type: "button",
						className: "dp-pager-btn",
						disabled: current >= pageCount,
						"data-it": "page-next",
						onClick: function () { if (current < pageCount) setPageValue(current + 1); }
					}, "下一页")
				);
			}

			/** 取当前页的行（配合 pager 使用）。 */
			function pageRows(rows, pageValue) {
				var pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
				var current = Math.min(Math.max(1, pageValue), pageCount);
				var start = (current - 1) * pageSize;
				return rows.slice(start, start + pageSize);
			}

			/** 步骤列：把一组步骤的某个字段按「1. xxx 2. xxx」排成多行。 */
			function stepLines(record, key) {
				var steps = Array.isArray(record && record.steps) ? record.steps : [];
				if (steps.length === 0) return null;
				return h("ol", { className: "it-steps-cell" }, steps.map(function (step, index) {
					return h("li", { key: index }, step[key] || "—");
				}));
			}

			/**
			 * 用例页签：序号 / 用例名称 / 用例描述 / 生成时间 / 操作。
			 *
			 * 这一页只看和改，不承载执行 —— 执行结果去「测试报告」子页看。
			 * 所以这里没有勾选框、没有执行按钮，操作列只有编辑和删除。
			 */
			function casesView() {
				var rows = current;
				var shown = pageRows(rows, casePage);
				return h(React.Fragment, null,
					h("div", { className: "it-board" },
						sidebar(),
						h("div", { className: "it-main" },
							h("div", { className: "it-table-wrap", "data-it": "cases-table" },
								rows.length === 0
									? h("div", { className: "it-empty" }, query.trim() !== "" ? "没有匹配的用例" : "这个场景下还没有用例")
									: h("table", { className: "it-table" },
										h("thead", null,
											h("tr", null,
												h("th", { style: { width: "52px" } }, "序号"),
												h("th", { style: { width: "26%" } }, "用例名称"),
												h("th", null, "用例描述"),
												h("th", { style: { width: "96px" } }, "生成时间"),
												h("th", { style: { width: "78px" } }, "操作")
											)
										),
										h("tbody", null, shown.map(function (record, index) {
											return h("tr", { key: record.id, "data-case-row": record.id },
												h("td", null, String((Math.min(Math.max(1, casePage), Math.max(1, Math.ceil(rows.length / pageSize))) - 1) * pageSize + index + 1)),
												h("td", { className: "it-left" },
													h("span", { className: "it-name-text" }, record.title || "—"),
													record.caseId ? h("span", { className: "it-case-tag" }, record.caseId) : null
												),
												h("td", { className: "it-left" },
													h("p", { className: "it-cell-2", title: record.description || "" }, record.description || "—")
												),
												h("td", null, itDate(record.createdAt)),
												h("td", null,
													h("div", { className: "it-ops" },
														h(IconButton, { name: "edit", label: "编辑 " + (record.title || ""), "data-it": "edit-btn-" + record.id, onClick: function () { setDetail({ mode: "edit", record: record }); } }),
														h(IconButton, { name: "trash", danger: true, label: "删除 " + (record.title || ""), "data-it": "delete-" + record.id, onClick: function () { confirmSet({ record: record }); } })
													)
												)
											);
										}))
									)
							),
							rows.length > 0 ? pager(rows, casePage, setCasePage, "cases-pager") : null
						)
					)
				);
			}

			/**
			 * 步骤页签：序号 / 用例名称 / 测试方法 / 输入步骤 / 预期结果 / 生成日期 / 操作。
			 *
			 * 一行是一个用例，把它的全部步骤摊平到「输入步骤」「预期结果」两列里，
			 * 这样不点开也能读完一条链路 —— 步骤本来就是按顺序执行的，拆成子行反而不好对照。
			 * 测试方法取第一步的动作（如「打开页面」）。
			 */
			function stepsView() {
				var rows = current;
				var shown = pageRows(rows, stepPage);
				return h(React.Fragment, null,
					h("div", { className: "it-board" },
						sidebar(),
						h("div", { className: "it-main" },
							h("div", { className: "it-table-wrap", "data-it": "steps-table" },
								rows.length === 0
									? h("div", { className: "it-empty" }, "这个场景下还没有步骤")
									: h("table", { className: "it-table it-table-steps" },
										h("thead", null,
											h("tr", null,
												h("th", { style: { width: "72px" } }, "序号"),
												h("th", { style: { width: "18%" } }, "用例名称"),
												h("th", { style: { width: "96px" } }, "测试方法"),
												h("th", null, "输入步骤"),
												h("th", null, "预期结果"),
												h("th", { style: { width: "92px" } }, "生成日期"),
												h("th", { style: { width: "86px" } }, "操作")
											)
										),
										h("tbody", null, shown.map(function (record, index) {
											var first = (record.steps || [])[0];
											var currentPage = Math.min(Math.max(1, stepPage), Math.max(1, Math.ceil(rows.length / pageSize)));
											var open = stepOpen.indexOf(record.id) !== -1;
											return h(React.Fragment, { key: record.id },
												h("tr", { className: cn(open ? "is-open" : ""), "data-case-row": record.id },
													/*
													 * 序号格里放「箭头 + 数字」：箭头是这一行唯一的下拉入口，
													 * 点开在下方挂一张执行结果子表（用例标识 / 名称 / 方法 / 结果 / 时间 / 操作）。
													 * 用例名称本身不再可点 —— 名称只是内容，不是入口。
													 */
													h("td", null,
														h("div", { className: "it-no-cell" },
															h("button", {
																type: "button",
																className: cn("it-row-toggle", open ? "is-open" : ""),
																"aria-expanded": open,
																title: open ? "收起执行结果" : "展开执行结果",
																"data-it": "expand-" + record.id,
																onClick: function () { toggleStepOpen(record.id); }
															}, h(Icon, { name: "chevron", size: 12 })),
															h("span", null, String((currentPage - 1) * pageSize + index + 1))
														)
													),
													h("td", { className: "it-left" },
														h("span", { className: "it-name-text" }, record.title || "—"),
														itStepCount(record) > 0 ? h("span", { className: "it-case-tag" }, String(itStepCount(record))) : null
													),
													h("td", null, (first && first.action) || "—"),
													h("td", { className: "it-left" }, stepLines(record, "operation") || h("span", { className: "it-muted" }, "—")),
													h("td", { className: "it-left" }, stepLines(record, "expected") || h("span", { className: "it-muted" }, "—")),
													h("td", null, itDate(record.createdAt)),
													h("td", null,
														h("div", { className: "it-ops" },
															h(IconButton, { name: "eye", label: "查看 " + (record.title || ""), "data-it": "view-" + record.id, onClick: function () { setDetail({ mode: "view", record: record }); } }),
															h(IconButton, { name: "edit", label: "编辑步骤 " + (record.title || ""), "data-it": "edit-btn-" + record.id, onClick: function () { setDetail({ kind: "steps", record: record }); } })
														)
													)
												),
												open
													? h("tr", { className: "it-expand-row" },
														h("td", { colSpan: 7, "data-it": "step-runs-" + record.id },
															h("div", { className: "it-expand-box" },
																h("table", { className: "it-mini it-mini-runs" },
																	h("thead", null,
																		h("tr", null,
																			h("th", { style: { width: "52px" } }, "序号"),
																			h("th", { style: { width: "96px" } }, "测试用例标识"),
																			h("th", null, "测试用例名称"),
																			h("th", { style: { width: "96px" } }, "测试方法"),
																			h("th", { style: { width: "72px" } }, "执行结果"),
																			h("th", { style: { width: "96px" } }, "测试时间"),
																			h("th", { style: { width: "86px" } }, "操作")
																		)
																	),
																	h("tbody", null, (function () {
																		var runs = record.records || [];
																		if (runs.length === 0) {
																			return h("tr", null, h("td", { colSpan: 7, className: "it-muted" }, "这条用例还没有执行记录"));
																		}
																		return runs.map(function (run, runIndex) {
																			var runMeta = IT_STATUS[run.result] || IT_STATUS.none;
																			return h("tr", { key: run.runId },
																				h("td", null, String(runIndex + 1)),
																				h("td", null, h("span", { className: "it-case-id" }, record.caseId || "—")),
																				h("td", { className: "it-left" }, record.title || "—"),
																				h("td", null, (first && first.action) || "—"),
																				h("td", null, h("span", { className: "it-pill", "data-tone": runMeta.tone }, runMeta.label)),
																				h("td", null, itTime(run.at)),
																				h("td", null,
																					h("div", { className: "it-ops" },
																						h(IconButton, { name: "eye", label: "查看报告", onClick: function () { notConnected("查看报告"); } }),
																						h(IconButton, { name: "doc", label: "导出报告", onClick: function () { notConnected("导出报告"); } }),
																						h(IconButton, { name: "trash", danger: true, label: "删除记录", onClick: function () { notConnected("删除执行记录"); } })
																					)
																				)
																			);
																		});
																	})())
																)
															)
														)
													)
													: null
											);
										}))
									)
							),
							rows.length > 0 ? pager(rows, stepPage, setStepPage, "steps-pager") : null
						)
					)
				);
			}

/**
			 * 报告页签：按场景分组 + 组内分页（对齐原型图）。
			 *
			 * 每个场景一张卡片：标题 + 「N 条报告」徽标，右侧「通过 X / 失败 Y」。
			 * 组内表格列：序号 / 用例标识 / 用例名称 / 测试方法 / 执行结果 / 测试时间 / 操作。
			 * 分组头可点，收起后只留汇总行 —— 场景多的时候一眼能扫完通过率。
			 */
			function reportsView() {
				var rows = current.filter(function (record) { return (record.records || []).length > 0; });
				// 按场景归组，保持侧栏里的顺序（全部 → 各场景按名称）。
				var groups = [];
				scenarios.forEach(function (item) {
					if (item.name === IT_SCENARIOS_ALL) return;
					var members = rows.filter(function (record) { return itScenarioOf(record) === item.name; });
					if (members.length === 0) return;
					groups.push({
						name: item.name,
						records: members,
						passed: members.filter(function (r) { return r.status === "pass"; }).length,
						failed: members.filter(function (r) { return r.status === "fail"; }).length,
						reports: members.reduce(function (sum, r) { return sum + (r.records || []).length; }, 0)
					});
				});

				// 分页作用于「所有纳入分组的用例」整体，不是每组各分各的。
				var flat = groups.reduce(function (list, group) { return list.concat(group.records); }, []);
				var currentPage = Math.min(Math.max(1, reportPage), Math.max(1, Math.ceil(flat.length / pageSize)));
				var start = (currentPage - 1) * pageSize;
				var end = start + pageSize;
				var offset = 0;

				return h(React.Fragment, null,
					h("div", { className: "it-overview-stat" },
						h("span", null, "报告 ", h("b", null, String(rows.reduce(function (sum, record) { return sum + (record.records || []).length; }, 0))), " 份"),
						h("span", null, "通过 ", h("b", null, String(rows.filter(function (r) { return r.status === "pass"; }).length)), " 条"),
						h("span", null, "未通过 ", h("b", null, String(rows.filter(function (r) { return r.status === "fail"; }).length)), " 条")
					),
					groups.length === 0
						? h("div", { className: "it-empty" }, "这个场景下还没有报告")
						: h("div", { className: "it-report-groups" }, groups.map(function (group) {
							// 这一组在本页里可见的行
							var from = Math.max(start, offset);
							var to = Math.min(end, offset + group.records.length);
							var visible = to > from ? group.records.slice(from - offset, to - offset) : [];
							var groupStart = offset;
							offset += group.records.length;
							if (visible.length === 0) return null;
							var open = collapsed.indexOf(group.name) === -1;
							return h("section", { key: group.name, className: "it-report-group", "data-it": "report-group-" + group.name },
								h("button", {
									type: "button",
									className: cn("it-report-head", open ? "" : "is-collapsed"),
									"aria-expanded": open,
									"data-it": "report-toggle-" + group.name,
									onClick: function () {
										setCollapsed(function (previous) {
											return previous.indexOf(group.name) === -1
												? previous.concat([group.name])
												: previous.filter(function (item) { return item !== group.name; });
										});
									}
								},
									h("span", { className: "it-report-caret" }, h(Icon, { name: "chevron", size: 13 })),
									h("span", { className: "it-report-name" }, group.name),
									h("span", { className: "it-report-badge" }, String(group.reports) + " 条报告"),
									h("span", { className: "it-report-sum" },
										"通过 ", h("b", null, String(group.passed)),
										" / 失败 ", h("b", null, String(group.failed))
									)
								),
								open
									? h("div", { className: "it-table-wrap" },
										h("table", { className: "it-table", "data-it": "reports-table" },
											h("thead", null,
												h("tr", null,
													h("th", { style: { width: "52px" } }, "序号"),
													h("th", { style: { width: "96px" } }, "用例标识"),
													h("th", null, "用例名称"),
													h("th", { style: { width: "96px" } }, "测试方法"),
													h("th", { style: { width: "72px" } }, "执行结果"),
													h("th", { style: { width: "96px" } }, "测试时间"),
													h("th", { style: { width: "78px" } }, "操作")
												)
											),
											h("tbody", null, visible.map(function (record, index) {
												var meta = IT_STATUS[record.status] || IT_STATUS.none;
												var first = (record.steps || [])[0];
												return h("tr", { key: record.id, "data-case-row": record.id },
													h("td", null, String(groupStart + (from - offset) + index + 1)),
													h("td", null, h("span", { className: "it-case-id" }, record.caseId || "—")),
													h("td", { className: "it-left" },
														h("button", {
															type: "button",
															className: "it-name-btn",
															title: record.title,
															"data-it": "view-" + record.id,
															onClick: function () { setDetail({ mode: "view", record: record }); }
														}, record.title || "—")
													),
													h("td", null, (first && first.action) || "—"),
													h("td", null, h("span", { className: "it-pill", "data-tone": meta.tone }, meta.label)),
													h("td", null, itDate(record.lastRunAt)),
													h("td", null,
														h("div", { className: "it-ops" },
															h(IconButton, { name: "eye", label: "查看报告 " + (record.title || ""), "data-it": "report-" + record.id, onClick: function () { notConnected("查看报告"); } }),
															h(IconButton, { name: "doc", label: "导出报告 " + (record.title || ""), "data-it": "export-" + record.id, onClick: function () { notConnected("导出报告"); } })
														)
													)
												);
											}))
										)
									)
									: null
							);
						})),
					flat.length > 0 ? pager(flat, reportPage, setReportPage, "reports-pager") : null
				);
			}

			var body = tab === "steps" ? stepsView() : (tab === "reports" ? reportsView() : casesView());

			var TAB_LABELS = { cases: "测试用例", steps: "测试步骤", reports: "测试报告" };
			var TAB_COUNTS = {
				cases: records.length,
				steps: records.reduce(function (sum, record) { return sum + itStepCount(record); }, 0),
				reports: records.reduce(function (sum, record) { return sum + (record.records || []).length; }, 0)
			};

			return h("div", {
				className: cn("it-root dp-root", props.narrow === true ? "is-narrow" : "", props.dock === true ? "dp-docked" : ""),
				// 非激活时只是隐藏，不卸载：切回单元测试再回来，子页和筛选都还在。
				style: active ? null : { display: "none" },
				"data-it": "integration-root"
			},
				/*
				 * 结构和单元测试完全对齐：
				 *   .dp-shell  → .dp-header（左标题区 + 右看板）→ 工具栏 → 内容
				 * 这样切换页面时留白、看板位置、工具栏节奏都一样，不会有「页面往上跳」的感觉。
				 */
				h("div", { className: "dp-shell" },
					h("div", { className: "dp-header" },
						h("div", null,
							/*
							 * 这里必须有「单元测试 / 集成测试」页签。
							 * 单元测试那个页签长在 DataPanelView 的 header 里，
							 * 切到集成测试后整个 DataPanelView 被 display:none 隐藏，
							 * 页签也跟着藏了 —— 这里不再放一份就没有入口切回去。
							 */
							h(TestModeTabs, { mode: "integration", onChange: props.onModeChange })
						),
						// 右侧看板：与单元测试同位置、同视觉、同样一行放得下。
						h("div", { className: "dp-stats" },
							h("div", { className: "dp-stat" },
								h("b", null, String(records.length)),
								h("span", null, "全部用例")
							),
							IT_TYPE_KEYS.map(function (key) {
								return h("div", { key: key, className: "dp-stat" },
									h("b", null, String(typeCounts[key] || 0)),
									h("span", null, IT_TYPES[key].label)
								);
							})
						)
					),
					/*
 * 工具栏：搜索与类型筛选直接复用单元测试的 .dp-search / .dp-select，
 * 并且搜索框必须排第一位 —— 位置、宽度、观感都和单元测试逐位对齐，
 * 切页签时搜索框不会「跳位」。
 *
 * 元素顺序：搜索 → 子页下拉 → 类型筛选 → 刷新 / 版本 / 主操作。
 * 子页下拉（测试用例 / 测试步骤 / 测试报告）是集成测试独有的入口，
 * 单元测试没有对应物，放在搜索框之后、类型筛选之前，不挤占第一位。
 *
 * 为什么不再放状态筛选：单元测试的工具栏一行放得下「搜索+类型+刷新+新增+三个执行按钮」，
 * 这里多一个状态下拉就会换行，视觉上比单元测试「往下掉」。状态筛选并不常用，
 * 收进子页里用只读标签表达即可（见报告页的「通过/未通过」统计）。
 */
					h("div", { className: "dp-toolbar it-toolbar" },
						h(SearchBox, {
							value: query,
							onChange: function (event) {
								setQuery(event && event.target ? event.target.value : "");
								resetPages();
							},
							eventStyle: true,
							"data-it": "search",
							label: "搜索集成测试用例",
							placeholder: "搜索标识、名称、说明或场景"
						}),
						h("div", { className: "it-switch" },
							h("button", {
								type: "button",
								ref: switchBtnRef,
								className: cn("it-switch-btn", switchOpen ? "is-open" : ""),
								"aria-haspopup": "listbox",
								"aria-expanded": switchOpen,
								"data-it": "switch-menu",
								onClick: function () { setSwitchOpen(!switchOpen); }
							},
								h("span", null, TAB_LABELS[tab]),
								h("span", { className: "it-switch-caret" }, h(Icon, { name: "chevron", size: 12 }))
							),
							h(ItMenu, {
								open: switchOpen,
								anchorRef: switchBtnRef,
								align: "left",
								width: 152,
								testId: "switch-menu-panel"
							},
								["cases", "steps", "reports"].map(function (key) {
									return h("button", {
										key: key,
										type: "button",
										role: "option",
										"aria-selected": tab === key,
										className: cn("it-switch-item", tab === key ? "is-active" : ""),
										"data-it": "tab-" + key,
										onClick: function () {
											setTab(key);
											setSwitchOpen(false);
											// 换子页后当前页码对新数据没意义，统一回到第 1 页。
											setCasePage(1);
											setStepPage(1);
											setReportPage(1);
										}
									},
										h("span", null, TAB_LABELS[key]),
										h("span", { className: "it-switch-count" }, String(TAB_COUNTS[key]))
									);
								})
							)
						),
						h("select", {
							className: "dp-select",
							value: type,
							onChange: function (event) { setType(event.target.value); resetPages(); },
							"aria-label": "按测试类型筛选"
						},
							h("option", { value: "all" }, "全部类型"),
							IT_TYPE_KEYS.map(function (key) {
								return h("option", { key: key, value: key }, IT_TYPES[key].label);
							})
						),
						h("div", { className: "it-toolbar-actions" },
							h(Button, { variant: "ghost", "data-it": "refresh", onClick: refresh },
								h(Icon, { name: "refresh", size: 15 }),
								"刷新"
							),
							// 版本切换：放在操作区，作为「当前查看的数据范围」。
							h("div", { className: "it-version" },
								h("button", {
									type: "button",
									ref: versionBtnRef,
									className: "it-version-btn",
									"data-it": "version-menu",
									title: "切换示例版本",
									onClick: function () { setVersionOpen(!versionOpen); }
								},
									h("span", null, version),
									h("span", { className: "it-switch-caret" }, h(Icon, { name: "chevron", size: 11 }))
								),
								h(ItMenu, {
									open: versionOpen,
									anchorRef: versionBtnRef,
									align: "right",
									width: 186,
									maxHeight: 150,
									testId: "version-menu-panel"
								},
									seed.versions.map(function (item) {
										return h("button", {
											key: item.name,
											type: "button",
											className: cn("it-version-item", version === item.name ? "is-active" : ""),
											"data-it": "version-" + item.name,
											onClick: function () {
												setVersion(item.name);
												setVersionOpen(false);
												// 换版本是一整套新数据，页码和折叠态都重置。
												setCasePage(1);
												setStepPage(1);
												setReportPage(1);
												setCollapsed([]);
											}
										},
											h("span", { className: "it-version-name" }, item.name),
											h("span", { className: "it-version-meta" }, itTime(item.at))
										);
									})
								)
							),
							/*
							 * 主操作按子页给不同的东西：
							 *   测试用例 —— 新增用例（primary，唯一的颜色强调）+ 生成测试步骤
							 *   测试步骤 —— 执行
							 *   测试报告 —— 总体报告（汇总视图）
							 * 原来的「全部执行」在这里点了只会弹一句「还没接入后端」，
							 * 而这一轮明确用例页不承载执行，所以不再摆这个按钮。
							 */
							tab === "reports"
								? h(Button, { variant: "ghost", "data-it": "overview", onClick: function () { setOverview(true); } }, "总体报告")
								: null,
							tab === "cases"
								? h(Button, {
									variant: "ghost",
									"data-it": "generate-steps",
									onClick: function () { notConnected("生成测试步骤"); }
								}, "生成测试步骤")
								: null,
							tab === "steps"
								? h(Button, {
									variant: "ghost",
									"data-it": "run-steps",
									onClick: function () { notConnected("执行"); }
								}, "执行")
								: null,
							tab === "cases"
								? h(Button, {
									variant: "primary",
									"data-it": "add-case",
									onClick: function () { setDetail({ mode: "edit", record: { steps: [], records: [] } }); }
								},
									h(Icon, { name: "plus", size: 15 }),
									"新增用例"
								)
								: null
						)
					),
					notice !== "" ? h("div", { className: "it-notice", "data-it": "notice" }, notice) : null,
					// 表格始终在：详情/编辑、总体报告都是弹窗，不再顶掉内容。
					body
				),
				// 用例详情 / 新增 / 编辑：弹窗。
				detail !== null
					? (detail.kind === "steps"
						/*
						 * 测试步骤页的编辑：改的是这条用例的步骤，不是用例本身的字段。
						 * 之前这里错接了 IntegrationCaseEditor，点「编辑步骤」弹出来的却是
						 * 「编辑用例」表单，看起来像点错了入口。
						 */
						? h(IntegrationStepsModal, {
							record: detail.record,
							onSave: function (next) { saveCase(next); },
							onClose: function () { setDetail(null); }
						})
						: h(IntegrationCaseEditor, {
							mode: detail.mode,
							record: detail.record,
							onSave: saveCase,
							onClose: function () { setDetail(null); }
						}))
					: null,
				// 项目总体报告：弹窗。
				overview
					? h(IntegrationOverview, {
						records: records,
						onClose: function () { setOverview(false); },
						onNotice: setNotice
					})
					: null,
				// 删除确认：短确认框，只删演示数据。
				confirm !== null && confirm.record
					? h("div", { className: "it-batch", style: { borderColor: "color-mix(in srgb, var(--dp-danger) 32%, transparent)", background: "color-mix(in srgb, var(--dp-danger) 6%, transparent)" } },
						h("span", null, "删除用例 ", h("b", null, confirm.record.caseId || ""), "？这只影响演示数据。"),
						h(Button, { size: "sm", variant: "ghost", onClick: function () { confirmSet(null); } }, "取消"),
						h(Button, { size: "sm", variant: "danger", "data-it": "confirm-delete", onClick: function () { removeCase(confirm.record); } }, "删除")
					)
					: null
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
				store.setError("查看测试代码：" + message);
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

		/**
		 * 会话工作区目录（相对路径要拼它才能交给编辑器）。
		 */
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
		 * 打开宿主已校验的测试文件并定位到目标行。
		 *
		 * 四级降级，逐级丢失一点精度而不是直接失败：
		 *   ① dsh-better-sidebar 编辑器 —— 定位到行，可编辑，能落到并排的第二栏
		 *   ② dsh-vscode-mode 编辑器 —— 定位到行/列，可编辑
		 *   ③ 官方 file 资源预览 —— 只读，但能把行号交给查看器
		 *   ④ 系统默认程序 openPath —— 只能打开文件，丢失行号
		 * @param ref 宿主返回的测试文件路径与目标行（`path#Lline`）
		 * @param sessionId 记录所属会话，用于解析相对路径
		 * @returns 是否成功发起了一次打开
		 */
		function openCode(ref, sessionId) {
			var target = parseCodeRef(ref);
			if (target === null) {
				store.setError("测试代码位置无效。");
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

			function openTestCode(caseId, sessionId) {
				if (!sessionId || !caseId) {
					store.setError("查看测试代码：缺少会话或用例 ID。");
					return;
				}
				fetchTestCode(sessionId, caseId).then(function (data) {
					var opened = openCode(data.testFile.replace(/\\/g, "/") + "#L" + data.line, sessionId);
					if (opened && data.warning) store.setError("查看测试代码：" + data.warning);
				}).catch(function (error) {
					store.setError("查看测试代码：" + (error && error.message ? error.message : String(error)));
				});
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
						return { store: store, openTestCode: openTestCode };
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
							openTestCode: function (caseId, refSessionId) { openTestCode(caseId, refSessionId || ownSessionId); },
							sessionId: ownSessionId,
							dock: true
						};
					}
				}, TestPanelHost);
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
			TestPanelHost: TestPanelHost,
			IntegrationPanel: IntegrationPanel,
			IntegrationCaseEditor: IntegrationCaseEditor,
			IntegrationStepsEditor: IntegrationStepsEditor,
			IntegrationOverview: IntegrationOverview,
			DetailView: DetailView,
			DetailEditor: DetailEditor,
			FunctionField: FunctionField,
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
			CategorySidebar: CategorySidebar,
			CategoryPrompt: CategoryPrompt,
			EmptyState: EmptyState,
			// 集成测试演示：壳、页签与各层组件。
			TestPanelHost: TestPanelHost,
			TestModeTabs: TestModeTabs,
			IntegrationPanel: IntegrationPanel,
			IntegrationCaseEditor: IntegrationCaseEditor,
			IntegrationStepsEditor: IntegrationStepsEditor,
			IntegrationOverview: IntegrationOverview,
			buildIntegrationSeed: buildIntegrationSeed,
			itFilterRecords: itFilterRecords,
			itScenarioRows: itScenarioRows,
			fmtDuration: fmtDuration,
			runWasInterrupted: runWasInterrupted,
			runWasInterruptedIn: runWasInterruptedIn,
			runStateOf: runStateOf,
			CodeModal: CodeModal,
			Pager: Pager
		};
		return module.exports;
	}
});
