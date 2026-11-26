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
.dp-shell { max-width: 1180px; margin: 0 auto; padding: 26px 30px 16px; }
/* 右侧栏里的面板：容器窄，收紧留白并让工具栏折行，表格靠 .dp-card-scroll 横向滚动。 */
.dp-root.dp-docked .dp-shell { max-width: none; padding: 14px 12px 12px; }
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
/* 测试类型多选：横向铺开的复选框行。 */
.dp-type-checks { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 2px 0; }
.dp-type-check { display: inline-flex; align-items: center; gap: 6px; color: var(--dp-text2); font-size: 13px; line-height: 1.4; cursor: pointer; user-select: none; }
.dp-type-check-box { width: 14px; height: 14px; margin: 0; accent-color: var(--dp-brand); cursor: pointer; }
.dp-type-check.is-on .dp-type-check-label { color: var(--dp-text); font-weight: 600; }
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
/* 卡片限高 + 弹性列：表头吸顶、分页贴底，只有中间表格区滚动。 */
/* 卡片限高 + 弹性列：表头吸顶、分页贴底，只有中间表格区滚动。
   max-height 不在 CSS 里写死（vh - 固定值 换分辨率就错位），由 JS 实测后设 inline style。 */
.dp-card { position: relative; display: flex; flex-direction: column; border: 1px solid var(--dp-border); border-radius: 14px; background: var(--dp-bg); }
.dp-card-scroll { flex: 1 1 auto; min-height: 0; overflow-x: auto; overflow-y: auto; }
.dp-table { width: 100%; min-width: 720px; border-collapse: collapse; table-layout: fixed; }
.dp-table th { padding: 11px 12px; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .05em; text-align: center; white-space: nowrap; }
/* 表头吸顶：卡片内只有表格区滚动，所以 sticky 挂在滚动容器上。
   border-collapse 会把 sticky 状态的底边框吃掉，用 inset 阴影补回。 */
.dp-table thead th { position: sticky; top: 0; z-index: 2; box-shadow: inset 0 -1px 0 var(--dp-border); }
/* 表头统一居中：即使某列表头带了 dp-right，也按居中显示。 */
.dp-table th.dp-right { text-align: center; }
.dp-table td { padding: 12px; border-bottom: 1px solid var(--dp-border2); vertical-align: middle; letter-spacing: .02em; text-align: center; }
.dp-table tbody tr:last-child td { border-bottom: 0; }
.dp-row { transition: background .12s; }
.dp-row:hover { background: var(--dp-bg2); }
.dp-title-cell { display: flex; align-items: flex-start; justify-content: center; gap: 6px; min-width: 0; }
/* 「示例」标签在两行标题里要贴第一行走。 */
.dp-title-cell .dp-demo-tag { flex: 0 0 auto; margin-top: 1px; }
.dp-title-link { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; padding: 0; border: 0; background: none; color: var(--dp-text); font: inherit; font-weight: 550; text-align: left; cursor: pointer; }
.dp-title-link:hover { color: var(--dp-brand); }
.dp-title-link:hover .dp-title-text { text-decoration: underline; text-underline-offset: 3px; }
.dp-title-text { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 1; text-align: center; word-break: break-all; }
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
.dp-case-id { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 1; color: var(--dp-text2); font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 12px; line-height: 1.45; word-break: break-all; }
/* 用例行上的执行次数角标 */
.dp-run-count { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--dp-brand); color: var(--dp-on-brand); font-size: 10.5px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
/* 用例标识格：展开箭头固定宽度，标识在剩余宽度里居中；
   执行次数气泡（.dp-run-count）绝对定位到右侧，不参与居中计算 ——
   有气泡和没气泡的行，标识位置完全一致。右侧留的 padding 是气泡的地盘，不压文字。 */
.dp-title-cell.dp-case-cell { position: relative; display: grid; grid-template-columns: 20px 1fr; align-items: center; column-gap: 6px; padding-right: 26px; }
.dp-case-cell .dp-expand-btn { justify-self: center; }
.dp-case-cell .dp-case-id { min-width: 0; text-align: center; }
.dp-case-cell .dp-run-count { position: absolute; right: 0; top: 50%; transform: translateY(-50%); }
.dp-cell-text { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin: 0; color: var(--dp-text2); font-size: 12px; line-height: 1.55; text-align: center; white-space: pre-wrap; word-break: break-all; }
/* 要 3 行的列（测试说明 / 输入 / 预期输出）加这个类。 */
.dp-cell-text.dp-cell-3 { -webkit-line-clamp: 3; }
/* 单行截断的列（用例表 / 执行记录）：超出的用省略号，全文靠 title 悬停看。 */
.dp-cell-text.dp-cell-1 { -webkit-line-clamp: 1; }
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
 *   # / 时间 / 耗时 / 结果 / 操作：th 和 td 都居中，天然对齐。
 *   「实际输出」：表头与内容都居中 —— 与其它列统一，避免内容贴左看起来歪掉。
 *   输入 / 预期输出：表头居中，内容靠左（短文本，左对齐更易读）。
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
 */
.dp-run-table th.dp-left { text-align: left; }
.dp-run-table td { padding: 5px 8px; border-bottom: 1px solid var(--dp-border2); color: var(--dp-text2); vertical-align: middle; text-align: center; }
.dp-run-table td.dp-left { text-align: left; }
.dp-run-table tr:last-child td { border-bottom: 0; }
/* 操作列内容也居中，和它的表头对齐（表头已经是 text-align:center）。 */
.dp-run-ops { display: flex; justify-content: center; gap: 2px; }
/* 「实际输出」单元格里的原始文本：居中显示，超长时省略。 */
.dp-run-table td pre { margin: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; text-align: center; font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace; font-size: 11px; line-height: 1.5; color: var(--dp-text2); }
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
/* 左右两栏之间的拖拽调宽手柄：正好盖住两栏间距，平时不可见，悬停/拖动时显形。 */
.dp-resizer { position: relative; flex: 0 0 auto; align-self: stretch; width: 12px; margin: 0 -12px; cursor: col-resize; touch-action: none; }
.dp-root.dp-docked .dp-resizer { width: 8px; margin: 0 -8px; }
.dp-resizer::before { content: ""; position: absolute; top: 8px; bottom: 8px; left: 50%; width: 2px; transform: translateX(-50%); border-radius: 2px; background: transparent; transition: background .12s; }
.dp-resizer:hover::before,
.dp-resizer.is-dragging::before { background: color-mix(in srgb, var(--dp-brand) 45%, transparent); }
.dp-board.is-resizing,
.dp-board.is-resizing * { cursor: col-resize !important; user-select: none; }
.dp-board.is-resizing .dp-sidebar { transition: none; }
.dp-sidebar { display: flex; flex-direction: column; flex: 0 0 auto; width: 128px; max-height: 62vh; padding: 8px 6px; border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); transition: width .16s ease, padding .16s ease; }
/* 层级列表：唯一可滚动区，撑满除表头/分页外的剩余高度。 */
/* 层级列表：行保持正常行高，不拉伸；条目多时自己滚动。 */
.dp-cat-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
/* 表头：固定高度，不参与行拉伸。 */
.dp-sidebar-head { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }
.dp-main { flex: 1 1 auto; min-width: 0; }
.dp-sidebar-title { color: var(--dp-text3); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.dp-sidebar-tools { display: flex; align-items: center; gap: 2px; }
/* 表头「+」按钮：与行内操作图标同尺寸（20px），不抢标题的位置。 */
.dp-sidebar-tools .dp-icon-btn { width: 20px; height: 20px; }
/* 层级为空时的一句引导，不留空白。 */
.dp-cat-empty { padding: 4px 8px 6px; color: var(--dp-text3); font-size: 11px; line-height: 1.5; }
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
.dp-cat { position: relative; display: flex; align-items: center; gap: 2px; margin-bottom: 1px; border-radius: 7px; transition: background .12s; }
.dp-cat:hover { background: var(--dp-bg2); }
.dp-cat.is-active { background: color-mix(in srgb, var(--dp-brand) 9%, transparent); }
.dp-cat-main { display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12.5px; text-align: left; cursor: pointer; }
.dp-cat.is-active .dp-cat-main { color: var(--dp-brand); font-weight: 600; }
.dp-cat-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-cat-count { flex: 0 0 auto; color: var(--dp-text3); font-size: 11px; font-variant-numeric: tabular-nums; }
.dp-cat.is-active .dp-cat-count { color: var(--dp-brand); }
/*
 * 行内操作（改名 / 删除）。
 *
 * 用绝对定位**浮在行右侧**，而不是挤进 flex 流里：
 * 左栏 docked 形态只有 112px 宽，两个 20px 按钮 + 间距要 43px，
 * 挤进流里会把层级名压到只剩 2~3 个字（实测 nameClientW 78px → 33px），
 * 层级几乎没法辨认。浮起来之后名称宽度完全不变，hover 时才浮出操作。
 *
 * 底色用 --dp-bg（实色）盖住下面的文字，左侧用渐变收边；
 * 行底色在 hover / 选中时不同，所以两处各配一条渐变，避免出现一块硬边。
 */
.dp-cat-ops { position: absolute; right: 2px; top: 50%; display: none; align-items: center; gap: 1px; padding-left: 12px; transform: translateY(-50%); background: linear-gradient(to right, transparent, var(--dp-bg2) 12px); }
.dp-cat:hover .dp-cat-ops { display: flex; }
.dp-cat-ops.is-visible { display: flex; }
/* 选中行底色是品牌色混合，操作区跟着换底，否则白块在彩色行上很扎眼。 */
.dp-cat.is-active .dp-cat-ops { background: linear-gradient(to right, transparent, color-mix(in srgb, var(--dp-brand) 9%, var(--dp-bg)) 12px); }
.dp-cat-ops .dp-icon-btn { width: 20px; height: 20px; }
/* 「放入」用品牌色，和改名/删除区分开。 */
.dp-cat-ops .dp-cat-drop { color: var(--dp-brand); }
.dp-cat-ops .dp-cat-drop:hover { background: color-mix(in srgb, var(--dp-brand) 16%, transparent); color: var(--dp-brand); }
.dp-cat-flip { transform: rotate(180deg); }
/*
 * 左栏两段：上「自定义层级」、下「按被测函数」。
 * 两段各有一行小标题，切段时标题本身就是入口（点标题 = 切到该维度并回到「全部」）。
 * 两段是**互斥**的筛选维度：同一时刻只按其中一个过滤，不会叠加成 AND。
 */
/*
 * 段标题行：整行是一个按钮，而不是「div 里套文字按钮」。
 * 套按钮的话只有 75.8px 的文字区可点，行左右的内边距点上去没反应；
 * 用 label + count 两个 flex 子项平铺整行，点击热区就是整行。
 */
.dp-cat-section { display: flex; align-items: center; justify-content: space-between; gap: 4px; width: 100%; margin: 6px 0 2px; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--dp-text3); font: inherit; font-size: 10px; font-weight: 650; letter-spacing: .06em; text-align: left; cursor: pointer; appearance: none; -webkit-appearance: none; transition: background .12s, color .12s; }
.dp-cat-section:first-child { margin-top: 0; }
.dp-cat-section:hover { background: var(--dp-bg2); color: var(--dp-text2); }
/* 当前正在用的维度：标题用主题色，明确「现在按这个筛」。 */
.dp-cat-section.is-active { color: var(--dp-brand); }
.dp-cat-section-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-cat-section-count { flex: 0 0 auto; font-variant-numeric: tabular-nums; font-weight: 500; }
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
.dp-actions { display: flex; justify-content: center; align-items: center; gap: 0; }
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
.dp-export-btn,
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
.dp-export-btn:disabled,
.dp-log-btn:disabled { opacity: .55; cursor: not-allowed; }
.dp-run-all-btn:hover:not(:disabled),
.dp-report-btn:hover:not(:disabled),
.dp-export-btn:hover:not(:disabled),
.dp-log-btn:hover:not(:disabled),
.dp-run-all-btn:active:not(:disabled),
.dp-report-btn:active:not(:disabled),
.dp-export-btn:active:not(:disabled),
.dp-log-btn:active:not(:disabled) { background: var(--dp-bg2); border-color: var(--dp-border); }
/* focus 与 .dp-select:focus 一致，键盘操作时同一套高亮 */
.dp-run-all-btn:focus-visible,
.dp-report-btn:focus-visible,
.dp-export-btn:focus-visible,
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
/*
 * 背景：必须和单元测试一样用 var(--dp-bg)，不能是 transparent。
 *
 * 之前这里写 transparent，理由是「集成页只是套在 .dp-root 里的一层」。
 * 在白色主题下看不出问题（宿主底色也是白），但切到深色主题就露馅了：
 * 单元测试是 --dp-bg 的深灰，集成页是 transparent 透出宿主更深的底色，
 * 两者明显不是一个层级 —— 集成页看起来"陷进去"了一块。
 */
.it-root.dp-root {
	height: 100%;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	background: var(--dp-bg);
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
/* 「当前」小标签：只给排在第一位的那一项，明确告诉用户现在看的是哪版 */
.it-version-current { flex: 0 0 auto; padding: 0 5px; border-radius: 4px; background: color-mix(in srgb, var(--dp-brand) 14%, transparent); color: var(--dp-brand); font-size: 10px; line-height: 15px; font-weight: 600; }
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
/*
 * 「筛选」按钮 + 下拉 + 已筛选提示条（只在测试步骤页出现）。
 * 按钮沿用工具栏那套细边框（与「全部类型」下拉同档），
 * 选中过筛选项时描边强调，让用户知道当前看的是筛过的数据。
 */
.it-result-filter { position: relative; display: inline-flex; }
.it-filter-btn { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 11px; border: 1px solid var(--dp-border); border-radius: 9px; background: var(--dp-bg); color: var(--dp-text2); font: inherit; font-size: 12.5px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
.it-filter-btn:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-filter-btn.is-open { background: var(--dp-bg2); border-color: var(--dp-brand); color: var(--dp-brand); }
.it-filter-btn.is-filtered { border-color: var(--dp-brand); color: var(--dp-brand); }
/* 下拉顶部：说明文字 + 全选 / 清空 */
.it-filter-head { display: flex; align-items: center; gap: 8px; padding: 4px 6px 7px; border-bottom: 1px solid var(--dp-border2); margin-bottom: 4px; }
.it-filter-title { flex: 1 1 auto; color: var(--dp-text); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.it-filter-link { padding: 0; border: 0; background: none; color: var(--dp-brand); font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
.it-filter-link:hover { text-decoration: underline; text-underline-offset: 2px; }
/* 两列勾选项 */
.it-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; padding: 2px 6px 4px; }
.it-filter-cell { display: flex; align-items: center; gap: 7px; padding: 5px 2px; color: var(--dp-text2); font-size: 12.5px; cursor: pointer; }
.it-filter-cell:hover { color: var(--dp-text); }
/*
 * 勾选框。
 * 页面上默认是白底，原来用 var(--dp-bg)（也是白）配 var(--dp-border)（#e5e6eb）的细边，
 * 几乎和背景融在一起看不清。这里改成：边框加深、未选中时给一点浅灰底，
 * 选中时用主题色实心块 —— 无论白底还是暗底都能一眼分辨。
 */
.it-filter-box { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 1.5px solid var(--dp-text3); border-radius: 4px; background: var(--dp-bg2); color: #fff; transition: background .12s, border-color .12s; }
.it-filter-box:hover { border-color: var(--dp-brand); }
.it-filter-box.is-on { border-color: var(--dp-brand); background: var(--dp-brand); }
.it-filter-box.is-on svg { stroke-width: 2.6; }
/* 已筛选提示条：一条浅蓝底 + 可点的「清除筛选」，放在表格上方 */
.it-filter-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; padding: 7px 11px; border-radius: 8px; background: color-mix(in srgb, var(--dp-brand) 9%, transparent); color: var(--dp-text); font-size: 12.5px; }
.it-filter-bar b { color: var(--dp-brand); font-weight: 600; }
/*
 * 步骤孤岛提示：steps.json 有步骤、但没有一条能挂到用例上。
 * 用警示黄，和「筛选条」的品牌蓝区分开 —— 这是数据问题，不是筛选状态。
 */
.it-orphan-hint { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 9px; padding: 9px 11px; border: 1px solid color-mix(in srgb, var(--dp-warning) 40%, transparent); border-radius: 8px; background: color-mix(in srgb, var(--dp-warning) 10%, transparent); color: var(--dp-text2); font-size: 12px; line-height: 1.65; }
.it-orphan-hint b { color: var(--dp-warning); font-weight: 650; }
.it-orphan-hint code { padding: 1px 5px; border-radius: 4px; background: var(--dp-bg3); color: var(--dp-text); font-size: 11.5px; }
.it-orphan-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; border-radius: 50%; background: var(--dp-warning); color: var(--dp-bg); font-size: 11px; font-weight: 700; }
/* 主表上方的小工具条：左边说明标签，右边「筛选」，整行浅底以便和表格分开 */
.it-subbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 9px; padding: 6px 4px 6px 10px; border-radius: 9px; background: var(--dp-bg2); }
.it-subbar-label { color: var(--dp-text2); font-size: 12.5px; font-weight: 600; }
/* 左侧组：标题 + 「多选」。外面 .it-subbar 是 space-between，
   若两个元素直接做兄弟，「多选」会被挤到正中间 —— 必须包一层。 */
.it-subbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.it-toolbar .dp-select { flex: 0 0 auto; width: auto; }
/* 下拉的包裹层默认 flex-shrink:1，nowrap 下会被压扁；锁成固有宽度，只让搜索框收缩 */
.it-toolbar .it-switch,
.it-toolbar .it-version,
.it-toolbar .it-result-filter { flex: 0 0 auto; }
.it-toolbar-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; flex: 0 0 auto; }
.it-toolbar .it-version-btn { height: 36px; border-radius: 10px; padding: 0 10px; }
.it-toolbar .it-switch-btn { height: 36px; }
.it-toolbar .dp-btn { flex: 0 0 auto; }
/*
 * 工具栏的搜索框：吃剩余空间，但给个上限免得过宽。
 * （筛选器已经挪到测试步骤页内部，工具栏回到 6 个控件，不再那么挤。）
 */
.it-toolbar .dp-search { flex: 1 1 200px; min-width: 120px; max-width: 320px; }
/*
 * 极窄容器：控件实在放不下时才换行。
 * 实测 620px 宽仍能排成一行（控件总宽约 800px，搜索框会被压缩让位），
 * 所以断点收到 520px，只有真正的窄栏才折成多行。
 */
@media (max-width: 520px) {
	.it-toolbar { flex-wrap: wrap; row-gap: 6px; }
	.it-toolbar .dp-search { flex: 1 1 100%; min-width: 0; max-width: none; }
	/*
	 * 换行后第二行只剩「子页 / 类型」，操作区独占第三行会浪费高度。
	 * 这里让操作区紧跟其后排列，并把它的左外边距清零（否则会被推到最右撑满一行）。
	 */
	.it-toolbar-actions { margin-left: 0; flex: 1 1 auto; justify-content: flex-end; }
}
.it-notice { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--dp-brand) 30%, transparent); border-radius: 10px; background: color-mix(in srgb, var(--dp-brand) 6%, transparent); color: var(--dp-text); font-size: 12px; }
/* 提示文字占据剩余空间，长文案自动换行，不与关闭按钮挤在一起 */
.it-notice-text { flex: 1 1 auto; min-width: 0; line-height: 1.5; }
/* 关闭按钮：贴右上，默认淡出，hover 才明显 —— 保持提示条本身不抢视觉 */
.it-notice-close { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; margin: -2px -4px 0 0; padding: 0; border: 0; border-radius: 6px; background: none; color: var(--dp-text3); cursor: pointer; transition: background .12s, color .12s; }
.it-notice-close:hover { background: color-mix(in srgb, var(--dp-text) 10%, transparent); color: var(--dp-text); }
.it-notice-close:focus-visible { outline: none; color: var(--dp-text); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dp-brand) 40%, transparent); }

/* 场景侧栏 + 表格 */
.it-board { display: flex; align-items: flex-start; gap: 10px; }
.it-side { display: flex; flex-direction: column; flex: 0 0 auto; width: 128px; padding: 8px 6px; border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); transition: width .16s ease, padding .16s ease; }
/* 侧栏头部：标题 + 「新建功能项」按钮，与单元测试 .dp-sidebar-head 同构 */
.it-side-head { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }
.it-side-title { padding: 0; color: var(--dp-text3); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; white-space: nowrap; }
.it-side-tools { display: flex; align-items: center; gap: 2px; }
.it-side-tools .dp-icon-btn { width: 20px; height: 20px; }
/* 功能项列表：唯一可滚动区，撑满头部以下的剩余高度 */
.it-side-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.it-side-empty { padding: 4px 6px 6px; color: var(--dp-text3); font-size: 11px; line-height: 1.5; }
.it-side-item { display: flex; align-items: center; justify-content: space-between; gap: 5px; width: 100%; padding: 5px 7px; border: 0; border-radius: 7px; background: transparent; color: var(--dp-text2); font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.it-side-item:hover { background: var(--dp-bg2); color: var(--dp-text); }
.it-side-item.is-active { background: color-mix(in srgb, var(--dp-brand) 9%, transparent); color: var(--dp-brand); font-weight: 600; }
.it-side-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.it-side-count { flex: 0 0 auto; color: var(--dp-text3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.it-side-item.is-active .it-side-count { color: var(--dp-brand); }
.it-main { flex: 1 1 auto; min-width: 0; }
/* 拖动调宽时的全局态：光标统一、禁止选中，与单元测试 .dp-board.is-resizing 一致 */
.it-board.is-resizing, .it-board.is-resizing * { cursor: col-resize !important; user-select: none; }
.it-board.is-resizing .it-side { transition: none; }

/* 集成测试表：复用 dp-table 观感，列少、可横向滚动 */
.it-table-wrap { border: 1px solid var(--dp-border); border-radius: 12px; background: var(--dp-bg); overflow-x: auto; overscroll-behavior-x: contain; }
/*
 * 卡片容器：单元测试的表格是包在 .dp-card 里的 —— 一个带边框、圆角的卡片，
 * 表格在上、分页条在下（分页条有顶部分隔线和自己的底色）。
 * 集成页原来把表格和分页条平铺在页面上，看起来比单元测试"散"。
 * 这里补一层同款卡片，让两边结构一致。
 */
/* 卡片弹性列：表头吸顶、分页贴底，只有中间表格区滚动（与单元测试 .dp-card 一致）。
   高度不靠 JS 实测：整页 flex 撑满，页底不留空白。 */
.it-card { display: flex; flex-direction: column; border: 1px solid var(--dp-border); border-radius: 14px; background: var(--dp-bg); overflow: hidden; }
/* 卡片里的表格不再需要自己那层边框（会和卡片边框叠成双线） */
.it-card > .it-table-wrap { flex: 1 1 auto; min-height: 0; border: 0; border-radius: 0; overflow-y: auto; }
/* 卡片底部：分页条固定在这一条里，和单元测试的 .dp-card-foot 一致 */
.it-card > .it-pager { flex: 0 0 auto; margin: 0; padding: 10px 14px 11px; border-top: 1px solid var(--dp-border); background: var(--dp-bg); }
/* 表头吸顶：卡片内只有表格区滚动，所以 sticky 挂在滚动容器上。 */
.it-card .it-table thead th { position: sticky; top: 0; z-index: 2; }
/* 整页撑满：shell 变弹性列，看板占据剩余高度，卡片在其中铺满。 */
.it-root .dp-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; box-sizing: border-box; }
/*
 * ★ 报告页专用：解除「整页定高 + 卡内滚动」，改成内容自然撑开、外层整页滚动。
 *
 * 原因（2026-11-24 实修）：报告页有「组内每页条数」原生 <select> 下拉。
 * 定高布局下 .it-card / .it-report-group 都是 overflow:hidden + 内部滚动容器，
 * 下拉选项被裁掉且滚不到 —— 表现为「只会挤压不会展开，超出的部分看不到」。
 *
 * 现在：dp-shell 不再定高，高度由内容决定；滚动交给最外层 .it-root.dp-root（它本来就有 overflow-y:auto）。
 * 其他两个 tab（用例 / 步骤）保持原来的定高 + 表头吸顶 + 分页贴底，不受影响。
 */
.it-root.is-report-tab .dp-shell { height: auto; min-height: 100%; }
.it-root.is-report-tab .it-board { flex: 0 0 auto; }
.it-root.is-report-tab .it-main { flex: 0 0 auto; min-height: 0; }
.it-root.is-report-tab .it-card { flex: 0 0 auto; }
.it-root .it-board { flex: 1 1 auto; min-height: 0; align-items: stretch; }
.it-root .it-main { display: flex; flex-direction: column; min-height: 0; }
.it-root .it-card { flex: 1 1 auto; min-height: 0; }
.it-root .it-side { min-height: 0; }
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
		/*
		 * 用例描述整段显示，不做行数截断。
		 *
		 * 原来用 .it-cell-2（-webkit-line-clamp: 2）只露两行，用户要求全部显示：
		 * 描述里常带前置条件与具体输入，被截掉就失去审查价值。
		 * 用 pre-wrap 保留原文换行，长单词/长 ID 也要能断行溢出。
		 */
		.it-cell-full { margin: 0; color: var(--dp-text2); font-size: 11.5px; line-height: 1.55; text-align: left; white-space: pre-wrap; word-break: break-word; }
/* 用例名称后面的小标签：用例表里放用例标识，步骤表里放步骤数 */
.it-case-tag { display: inline-block; margin-left: 5px; padding: 0 6px; border-radius: 5px; background: var(--dp-bg3); color: var(--dp-text3); font-size: 10.5px; line-height: 16px; font-variant-numeric: tabular-nums; vertical-align: 1px; }
/* 用例名称是内容而不是入口：用纯文本，不再做成按钮 */
.it-name-text { color: var(--dp-text); font-weight: 550; word-break: break-word; }
/*
 * 步骤页的序号格：箭头 + 数字。箭头是整行唯一的下拉入口，
 * 放在序号左边才不会和右侧操作列抢注意力。
 */
.it-no-cell { display: inline-flex; align-items: center; gap: 4px; }
/* 步骤行的展开箭头 / 执行次数角标：直接复用单元测试的 .dp-expand-btn 与 .dp-run-count，
   不再各写一套（原来是 .it-row-toggle 18px 小箭头 + .it-case-tag 灰标签，两边度量不一致）。 */
.it-no-cell .dp-expand-btn { margin-top: 0; }
.it-table .it-name-text + .dp-run-count { margin-left: 5px; }
/*
 * 拖拽手柄：6 个灰点（3×2）、透明背景，只在测试用例页出现。
 * 鼠标移到行上才显现，避免整列都是点、看着吵；用 grab / grabbing 光标提示可拖。
 */
.it-drag-handle { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--dp-text3); cursor: grab; opacity: 0; transition: opacity .12s, color .12s; }
.it-table tr:hover .it-drag-handle,
.it-drag-handle.is-active { opacity: 1; }
.it-drag-handle:hover { color: var(--dp-text2); }
.it-drag-handle:active,
.it-drag-handle.is-active { cursor: grabbing; color: var(--dp-brand); }
/* 拖拽中的行：底色加重，明确「这一行正在被搬动」 */
.it-table tr.is-dragging > td { background: color-mix(in srgb, var(--dp-brand) 7%, transparent); }
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
/* 异常：执行过程本身出错（环境、超时、崩溃），和「未通过」用不同颜色区分 */
.it-pill[data-tone="error"] { background: color-mix(in srgb, var(--dp-warning) 15%, transparent); color: var(--dp-warning); }
.it-pill[data-tone="idle"] { background: var(--dp-bg3); color: var(--dp-text3); }
.it-pill[data-tone="brand"] { background: color-mix(in srgb, var(--dp-brand) 12%, transparent); color: var(--dp-brand); }
/* 测试类型胶囊：中性灰蓝，和「执行结果」的红绿黄区分开，一眼能分「类型」和「结果」 */
.it-pill[data-tone="type"] { background: color-mix(in srgb, #64748b 13%, transparent); color: #8b93a1; }
.it-ops { display: flex; justify-content: center; gap: 1px; }
.it-empty { padding: 34px 16px; color: var(--dp-text3); font-size: 12.5px; text-align: center; }
/* 空状态：标题稍重一点，说明文字更轻，比原来单行灰字更好读 */
.it-empty-title { margin-bottom: 6px; color: var(--dp-text2); font-size: 13.5px; font-weight: 600; }
.it-empty-hint { color: var(--dp-text3); font-size: 12px; line-height: 1.6; }

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
/*
 * 步骤表的列头。网格列与 .it-step-row 必须完全一致（含弹窗内的覆盖值），
 * 否则标题和输入框会错位 —— 两套网格一旦有一列宽度不同，后面所有列都会累积偏移。
 * 序号与操作列留空但仍占位。
 *
 * 列头文字给 12px 左内边距，和输入框内部的文字起点对齐（视觉上比对齐边框更整齐）。
 * 弹窗内的网格覆盖见 .it-steps-modal .it-step-head，两处必须成对修改。
 */
.it-step-head { display: grid; grid-template-columns: 22px 1fr 1fr 1fr auto; gap: 6px; padding: 0 0 7px; border-bottom: 1px solid var(--dp-border); margin-bottom: 2px; color: var(--dp-text3); font-size: 11px; font-weight: 600; letter-spacing: .03em; }
/* 操作列固定宽度：列头这里是空 span（宽 0），步骤行里是图标按钮。
   不固定的话两套网格的最后一列宽度不同，前面所有列都会被挤偏。
   宽度按「拖拽手柄 + 删除」两个按钮定，给 56px 足够。 */
.it-step-head > span:last-child { width: 56px; min-width: 56px; text-align: center; }
.it-step-row > .it-step-ops { width: 56px; justify-content: flex-end; }
/* 与输入框内部文字的起点对齐（输入框左内边距 10px，弹窗里 12px） */
.it-step-head > span:nth-child(2),
.it-step-head > span:nth-child(3),
.it-step-head > span:nth-child(4) { padding-left: 10px; }
/* 拖拽中的步骤行高亮，与测试用例页同一套观感 */
.it-step-row.is-dragging { background: color-mix(in srgb, var(--dp-brand) 7%, transparent); border-radius: 8px; }

/* 总体报告 */
.it-overview { display: flex; flex-direction: column; gap: 9px; }
.it-overview-stat { display: flex; flex-wrap: wrap; gap: 12px; color: var(--dp-text2); font-size: 12px; }
.it-overview-stat b { color: var(--dp-text); font-weight: 650; }

/*
 * 报告页：按场景分组的卡片列表（对齐原型）。
 * 每组一张卡片：可折叠的标题行 + 组内表格，标题行右侧是「通过 X / 失败 Y」。
 */
.it-report-groups { display: flex; flex-direction: column; gap: 9px; }
/*
 * ★ 报告卡片：**不用卡内滚动，改成整页滚动**（2026-11-24 修）。
 *
 * 原来这里是 flex: 1 1 auto; min-height: 0; overflow-y: auto，配合 .it-card 的
 * overflow: hidden，形成两层裁切上下文。后果：
 *   · 组内「每页 N 条」是原生 <select>，展开的选项被 .it-report-groups 裁掉，
 *     看起来「只会挤压不会自然展开」；
 *   · 内容超出卡片高度时既滚不到、也看不到，页面上半截被定死。
 *
 * 现在：卡片高度由内容撑开（height: auto），滚动交给最外层页面；
 * 底部翻页条用 sticky 贴视口底，滚到哪都能翻页。
 */
.it-card > .it-report-groups { flex: 0 0 auto; min-height: 0; overflow: visible; padding: 10px; }
/* 报告卡片本身不再裁切内容：下拉/悬浮层要能溢出到卡片外 */
.it-card.is-report { overflow: visible; height: auto; flex: 0 0 auto; }
/* 翻页条：贴视口底部（sticky 而不是 fixed，不会脱离卡片宽度） */
.it-card.is-report > .dp-pager.it-pager {
	flex: 0 0 auto;
	position: sticky;
	bottom: 0;
	z-index: 3;
	background: var(--dp-bg);
	box-shadow: 0 -1px 0 var(--dp-border);
}
/* 组卡片同理：不要裁掉下拉选项 */
.it-report-group { border: 1px solid var(--dp-border); border-radius: 11px; background: var(--dp-bg); overflow: visible; }
/* 组内表格自己带一层边框，和卡片边框叠在一起会显粗，这里让表格贴边无框 */
.it-report-group .it-table-wrap { border: 0; border-radius: 0; }
.it-report-head { display: flex; align-items: center; gap: 7px; width: 100%; padding: 9px 11px; border-bottom: 1px solid var(--dp-border); background: var(--dp-bg2); color: var(--dp-text); font: inherit; text-align: left; transition: background .12s; }
/* 折叠按钮本身只包箭头 + 名称 + 徽标，右侧「通过/失败」不属于点击区 */
.it-report-toggle { display: inline-flex; align-items: center; gap: 7px; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.it-report-toggle:hover .it-report-name { color: var(--dp-brand); }
.it-report-caret { display: inline-flex; color: var(--dp-text3); transform: rotate(90deg); transition: transform .14s; }
.it-report-toggle.is-collapsed .it-report-caret { transform: rotate(0deg); }
.it-report-name { flex: 0 0 auto; font-size: 13px; font-weight: 650; }
.it-report-badge { flex: 0 0 auto; padding: 0 7px; border-radius: 5px; background: color-mix(in srgb, var(--dp-brand) 11%, transparent); color: var(--dp-brand); font-size: 11px; line-height: 17px; }
.it-report-sum { flex: 1 1 auto; color: var(--dp-text3); font-size: 11.5px; text-align: right; }
.it-report-sum b { color: var(--dp-text2); font-weight: 600; }

/* 分页：复用单元测试 .dp-pager 的度量，只补集成页需要的间距 */
.it-pager { margin-top: 10px; }

/*
 * 报告页多选（对齐原型图 4）。
 * 非多选态：右上角一个「多选」文字按钮；
 * 多选态：整行换成「共 N 条报告（通过 X / 失败 Y） + 退出多选 + 导出已选报告 + 全选 + 清空」。
 */
/* 「多选」紧跟汇总文字之后，不要 margin-left:auto（那会把它推到最右） */
.it-multi-enter { margin-left: 2px; padding: 0; border: 0; background: none; color: var(--dp-brand); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.it-multi-enter:hover { text-decoration: underline; text-underline-offset: 3px; }
.it-multi-bar { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; color: var(--dp-text2); font-size: 12.5px; }
.it-multi-stat { color: var(--dp-text2); }
.it-multi-stat b { color: var(--dp-text); font-weight: 650; }
.it-multi-link { padding: 0; border: 0; background: none; color: var(--dp-text2); font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap; }
.it-multi-link:hover { color: var(--dp-brand); text-decoration: underline; text-underline-offset: 3px; }
.it-multi-link.is-strong { color: var(--dp-brand); font-weight: 600; }
/* 导出已选报告：浅底按钮，禁用时半透明（原型里未选时是灰的） */
.it-multi-export { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 11px; border: 1px solid transparent; border-radius: 8px; background: color-mix(in srgb, var(--dp-brand) 9%, transparent); color: var(--dp-brand); font: inherit; font-size: 12.5px; white-space: nowrap; cursor: pointer; }
.it-multi-export:hover:not(:disabled) { background: color-mix(in srgb, var(--dp-brand) 15%, transparent); }
.it-multi-export:disabled { opacity: .5; cursor: not-allowed; }
/* 「已选 N 条」计数：贴在这条最右侧，不挤主操作 */
.it-multi-picked { margin-left: auto; color: var(--dp-text2); white-space: nowrap; }
.it-multi-picked b { color: var(--dp-brand); font-weight: 650; }
/* 多选态下被勾中的行：淡品牌底色，和报告页的勾选观感一致 */
.it-table tr.is-picked > td { background: color-mix(in srgb, var(--dp-brand) 5%, transparent); }
/* 多选勾选框：跟单元测试表格里的 .dp-pick input 同一套度量 */
.it-table th input[type="checkbox"],
.it-table td input[type="checkbox"] { width: 14px; height: 14px; margin: 0; accent-color: var(--dp-brand); cursor: pointer; vertical-align: middle; }
/* 「多选」按钮：紧跟标题，间距交给 .it-subbar-left 的 gap 控制 */
.it-subbar .it-multi-enter { flex: 0 0 auto; }

/* 组内分页 / 子表分页共用一套（图 5 的形态）：共 N 条，每页 [15条/页] ‹ 1 › */
.it-sub-pager, .it-sub-pager-wrap { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 8px 10px; color: var(--dp-text2); font-size: 12.5px; }
.it-sp-total { color: var(--dp-text3); white-space: nowrap; }
.it-sp-select { height: 28px; padding: 0 22px 0 8px; border: 1px solid var(--dp-brand); border-radius: 7px; background: var(--dp-bg); color: var(--dp-text); font: inherit; font-size: 12.5px; outline: none; cursor: pointer; }
.it-sp-btn { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 1px solid var(--dp-border); border-radius: 7px; background: var(--dp-bg); color: var(--dp-text2); cursor: pointer; }
.it-sp-btn:hover:not(:disabled) { background: var(--dp-bg2); color: var(--dp-text); }
.it-sp-btn:disabled { opacity: .45; cursor: not-allowed; }
.it-sp-page { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 6px; border: 1px solid var(--dp-brand); border-radius: 7px; background: var(--dp-bg); color: var(--dp-brand); font: inherit; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; cursor: pointer; }
/* 组内分页条：贴在卡片下沿，去掉卡片自己的下边框重复感 */
.it-report-group > .it-sub-pager { border-top: 1px solid var(--dp-border2); justify-content: flex-end; }

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

/*
 * 步骤编辑弹窗：和用例弹窗不是一回事，单独给一套度量。
 *
 * 之前它只挂 it-case-modal，什么专属样式都没有，结果：
 *   · 宽度照抄 720px —— 但这里有「动作 / 输入步骤 / 预期结果」三列并排，
 *     每列都被挤到只能露出十来个字，看什么都得点进去才行；
 *   · 列表沿用 .it-scroll-5 的 132px 上限 —— 只够露出两行半，
 *     第三条被拦腰切断，看起来像坏了。
 *
 * 现在：宽度放到 1040（三列各自能放下整句），高度给上限但不强制撑满 ——
 * 步骤少的时候弹窗自然矮一点，步骤多的时候列表自己滚，底部按钮始终露在外面。
 */
.dp-modal.it-steps-modal { width: min(1040px, 96vw); max-height: min(84vh, 760px); }
.it-steps-modal .dp-modal-body {
	flex: 0 1 auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	padding: 6px 22px 12px;
}
.it-steps-modal .it-detail { min-height: 0; display: flex; flex-direction: column; gap: 0; }
/*
 * 步骤列表：随内容长高，但不超过剩余空间。
 * 用 max-height 而不是 flex:1 —— 否则步骤只有两三条时会留出一大块空白，
 * 底部「新增步骤」被推到很远的地方，看起来像布局坏了。
 */
/*
 * 步骤列表的滚动区。
 *
 * 高度按「5 行」定死（每行 38px 输入框 + 8px 上下内边距 + 1px 虚线分隔 ≈ 55px，
 * 5 行约 275px），超过 5 步就在这个区域里滚动，而不是把弹窗越撑越长。
 * 用 max-height 而不是 flex:1 —— 步骤少时不留大块空白，「新增步骤」紧跟其后。
 */
.it-steps-modal .it-steps-scroll {
	flex: 0 1 auto;
	min-height: 0;
	max-height: 278px;
	overflow-y: auto;
}
.it-steps-modal .it-steps-scroll .it-step-row { padding: 8px 0; }
/* 三列输入等宽，别再让「预期结果」被压成一条缝 */
.it-steps-modal .it-step-row { grid-template-columns: 24px 1fr 1fr 1fr auto; gap: 8px; }
.it-steps-modal .it-step-no { padding-top: 11px; }
/* 底部「新增步骤」固定在列表下方，列表再长也看得到它 */
.it-steps-modal .it-detail-foot { flex: 0 0 auto; padding-top: 10px; border-top: 1px solid var(--dp-border); }
/* 输入框与用例弹窗同档（14px / 38px）：三列并排时 42px 太占高度，压到 38 更耐看 */
.it-steps-modal .it-input { height: 38px; padding: 0 10px; font-size: 13.5px; border-radius: 8px; }
.it-steps-modal .it-step-row .it-input:focus { border-color: var(--dp-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dp-brand) 13%, transparent); outline: none; }
/* 步骤行的操作图标（上移 / 下移 / 删除）垂直对齐输入框中线 */
.it-steps-modal .it-step-ops { display: inline-flex; align-items: center; gap: 4px; height: 38px; }
/* 步骤弹窗里手柄常显（表格页才需要 hover 才出现，弹窗里是编辑态，直接露出更好找） */
.it-steps-modal .it-drag-handle.is-visible { opacity: 1; }
/* 弹窗内网格必须与 .it-steps-modal .it-step-row 完全一致（24px + 8px gap），否则会错位 */
.it-steps-modal .it-step-head { grid-template-columns: 24px 1fr 1fr 1fr auto; gap: 8px; }
/* 弹窗里输入框左内边距是 12px，列头文字跟着对齐 */
.it-steps-modal .it-step-head > span:nth-child(2),
.it-steps-modal .it-step-head > span:nth-child(3),
.it-steps-modal .it-step-head > span:nth-child(4) { padding-left: 12px; }

/* 窄面板：侧栏进一步收窄，工具栏两行 */
.it-root.is-narrow .it-side { width: 96px; }
.it-root.is-narrow .it-grid-2 { grid-template-columns: 1fr; }
.it-root.is-narrow .it-step-row { grid-template-columns: 20px 1fr auto; }
.it-root.is-narrow .it-step-row .it-step-col-3 { display: none; }

/* 参考图的淡紫灰视觉：仅覆盖颜色、圆角、边框与阴影，不改变布局和交互。 */
.dp-root, .dp-detail, .dp-mask {
	--dp-brand: #7c6ee6;
	--dp-page: color-mix(in srgb, var(--dp-brand) 4%, var(--dp-bg));
	--dp-border: color-mix(in srgb, var(--dp-brand) 6%, var(--dsw-alias-border-l1, #e5e6eb));
	--dp-border2: color-mix(in srgb, var(--dp-brand) 3%, var(--dsw-alias-border-l2, #eef0f3));
	--dp-control-shadow: 0 2px 6px rgba(64, 56, 120, .04);
	--dp-card-shadow: 0 6px 22px rgba(64, 56, 120, .055);
}
.dp-root, .it-root.dp-root { background: var(--dp-page); }
.dp-stat {
	border-color: color-mix(in srgb, var(--dp-brand) 4%, var(--dp-border));
	border-radius: 8px;
	box-shadow: var(--dp-control-shadow);
}
.dp-stat:first-child {
	border-color: transparent;
	background: color-mix(in srgb, var(--dp-brand) 9%, var(--dp-bg));
}
.dp-stat:first-child b { color: var(--dp-brand); }
.dp-stat:first-child span { color: color-mix(in srgb, var(--dp-brand) 72%, var(--dp-text2)); }
.dp-stat b { font-weight: 600; }
.dp-root:not(.it-root) .dp-stats .dp-stat:nth-child(6) b,
.dp-root:not(.it-root) .dp-stats .dp-stat:nth-child(6) span { color: var(--dp-warning); }
.dp-search input {
	border-color: color-mix(in srgb, var(--dp-brand) 36%, var(--dp-border));
	border-radius: 6px;
	background: var(--dp-bg);
	box-shadow: var(--dp-control-shadow);
}
.dp-search input:hover { border-color: color-mix(in srgb, var(--dp-brand) 62%, var(--dp-border)); }
.dp-toolbar .dp-select,
.dp-root .dp-btn,
.dp-run-all-btn, .dp-report-btn, .dp-export-btn, .dp-log-btn,
.it-switch-btn, .it-version-btn, .it-filter-btn {
	border-radius: 6px;
	box-shadow: var(--dp-control-shadow);
}
.dp-root .dp-toolbar .dp-btn-primary {
	border-color: var(--dp-border);
	background: var(--dp-bg);
	color: var(--dp-text);
}
.dp-root .dp-toolbar .dp-btn-primary:hover:not(:disabled) {
	border-color: color-mix(in srgb, var(--dp-brand) 24%, var(--dp-border));
	background: var(--dp-bg2);
	color: var(--dp-text);
	filter: none;
}
.dp-sidebar, .it-side { border-color: transparent; background: transparent; box-shadow: none; }
.dp-sidebar-title, .it-side-title { color: var(--dp-text2); }
.dp-cat, .dp-cat-main, .it-side-item { border-radius: 6px; }
.dp-cat.is-active, .it-side-item.is-active { background: color-mix(in srgb, var(--dp-brand) 10%, transparent); }
.dp-card, .it-card {
	border-color: var(--dp-border);
	border-radius: 10px;
	background: var(--dp-bg);
	box-shadow: var(--dp-card-shadow);
}
.it-table-wrap { border-color: var(--dp-border); border-radius: 10px; }
.dp-table th, .it-table th {
	border-bottom-color: var(--dp-border2);
	background: color-mix(in srgb, var(--dp-brand) 2%, var(--dp-bg2));
	color: var(--dp-text3);
	font-weight: 500;
}
.dp-table thead th { box-shadow: inset 0 -1px 0 var(--dp-border2); }
.dp-table td, .it-table td { border-bottom-color: var(--dp-border2); }
.dp-row:hover, .it-table tbody tr:hover { background: color-mix(in srgb, var(--dp-brand) 3%, var(--dp-bg)); }
.dp-row.is-open { background: color-mix(in srgb, var(--dp-brand) 5%, var(--dp-bg)); }
.dp-type {
	border-color: color-mix(in srgb, var(--dp-brand) 18%, transparent);
	border-radius: 4px;
	background: color-mix(in srgb, var(--dp-brand) 8%, transparent);
}
.dp-run-count { border-radius: 5px; background: var(--dp-bg3); color: var(--dp-text2); font-weight: 500; }
.dp-icon-btn { border-radius: 6px; background: var(--dp-bg2); }
.dp-card-foot, .it-card > .it-pager { border-top-color: var(--dp-border2); }
.dp-pager-btn, .dp-pager-size select, .it-sp-btn, .it-sp-page, .it-sp-select { border-radius: 6px; }
.dp-pager-page { border-color: transparent; background: transparent; }

/* ── 单元测试面板：内容区占满可视高度，分页条永远贴底 ── */
.dp-root:not(.it-root) .dp-shell {
	display: flex;
	flex-direction: column;
	min-height: 100%;
}
.dp-root:not(.it-root) .dp-board {
	flex: 1 1 auto;
	min-height: 240px;
}
.dp-root:not(.it-root) .dp-main {
	align-self: stretch;
	display: flex;
	flex-direction: column;
	min-height: 0;
}
.dp-root:not(.it-root) .dp-card {
	flex: 1 1 auto;
	min-height: 0;
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
		// 测试类型及下拉框顺序：功能 → 接口 → 边界 → 逻辑 → 性能。
var TEST_TYPES = {
	functional: { label: "功能测试", tone: "func" },
	api: { label: "接口测试", tone: "func" },
	boundary: { label: "边界测试", tone: "func" },
	logic: { label: "逻辑测试", tone: "func" },
	performance: { label: "性能测试", tone: "perf" }
};
var TEST_TYPE_KEYS = ["functional", "api", "boundary", "logic", "performance"];
var CASE_OUTCOME = { passed: "通过", failed: "未通过", error: "未通过", skipped: "跳过", unknown: "未确认", "": "" };
var CASE_TONE = { passed: "ok", failed: "bad", error: "bad", skipped: "idle", unknown: "idle", "": "" };
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
		 * 初始数据为空（见 buildIntegrationSeed 的说明）：需要拿真实项目跑技能时，
		 * 自带示例会干扰「哪些是模型生成的」这类判断，所以不再内置示例用例。
		 */
		var IT_SCENARIOS_ALL = "全部用例";
		var IT_SCENARIOS_NONE = "未分组";

		/*
		 * 集成测试的测试类型（七类，按工程口径定）。
		 * 顺序就是「全部类型」下拉与顶部看板的显示顺序：
		 * 功能 → 性能 → 边界 → 接口 → 强度 → 安全性 → 余量。
		 */
		var IT_TYPES = {
			functional: { label: "功能测试" },
			performance: { label: "性能测试" },
			boundary: { label: "边界测试" },
			api: { label: "接口测试" },
			stress: { label: "强度测试" },
			security: { label: "安全性测试" },
			margin: { label: "余量测试" }
		};
		var IT_TYPE_KEYS = ["functional", "performance", "boundary", "api", "stress", "security", "margin"];

		/**
		 * 测试类型的显示文案。
		 *
		 * 三个 tab（用例 / 步骤 / 报告）的主表都要显示「测试类型」列，
		 * 统一走这里取文案，别各写一套映射。
		 * 未知类型原样回显（不吞成空），空值给破折号。
		 */
		function itTypeLabel(type) {
			if (type === undefined || type === null || type === "") return "—";
			var meta = IT_TYPES[type];
			return (meta && meta.label) || String(type);
		}

		/**
		 * 测试类型单元格：一个浅色胶囊，和「执行结果」的 it-pill 同族但不同色。
		 *
		 * 用 data-tone="type" 区分语义色，避免各表自己写颜色。
		 */
		function itTypePill(type) {
			var label = itTypeLabel(type);
			if (label === "—") return "—";
			return h("span", { className: "it-pill it-type-pill", "data-tone": "type" }, label);
		}

		var IT_STATUS = {
			pass: { label: "通过", tone: "ok" },
			fail: { label: "未通过", tone: "bad" },
			error: { label: "异常", tone: "error" },
			none: { label: "未执行", tone: "idle" }
		};

		/**
		 * 执行结果筛选可选的值。
		 *
		 * 四态：通过 / 未通过 / 异常 / **未执行**。
		 * 「未执行」= 还没有任何执行记录（itLatestResult 返回 none）。
		 * 它让用户能主动筛出「还没跑过的用例」，而不是只在跑过的结果里翻。
		 */
		var IT_RESULT_FILTERS = [
			{ key: "pass", label: "通过" },
			{ key: "fail", label: "未通过" },
			{ key: "error", label: "异常" },
			/*
			 * 「未执行」= 这条用例还没有任何执行记录。
			 *
			 * 它与「没通过筛选」不是一回事：加它是为了让用户能**主动筛出还没跑过的用例**，
			 * 在一堆跑过的结果里找剩下没跑的。取值用 none，与 IT_STATUS.none 对齐。
			 */
			{ key: "none", label: "未执行" }
		];

		/**
		 * 一条用例当前显示的「执行结果」：取它最新一次执行记录的结果。
		 *
		 * 为什么取 records[0] 而不是 record.status：
		 *   status 是父组件算好的汇总值，但步骤表这一列要的是「最新一次跑的怎么样」，
		 *   两者在数据被局部改动（比如新增/删除某条记录）时可能不一致。
		 * records 按时间倒序存放（最新在最前），所以直接取第一条。
		 * 没有执行记录时返回 none，由调用方显示成「未执行」。
		 */
		function itLatestResult(record) {
			var runs = Array.isArray(record && record.records) ? record.records : [];
			if (runs.length === 0) return "none";
			var latest = runs[0] || {};
			var result = latest.result;
			return IT_STATUS[result] ? result : "none";
		}

		/**
		 * 生成一份集成测试示例数据。
		 *
		 * 每次调用返回全新对象，避免多个会话/多次挂载共享同一份引用
		 * （改一个版本的数据会串到别处）。
		 */
		function buildIntegrationSeed() {
			/*
			 * 集成测试初始数据：**空**。
			 *
			 * 历史：这里曾经写死 9 条示例用例（V0.0.1）+ 2 条（V0.0.2），
			 * 用来验证「页面能看到、点得动」「切版本后数据隔离」。
			 * 现在要拿真实项目跑集成测试 Skill，示例数据会干扰判断
			 * （分不清哪些是模型生成的、哪些是自带演示的），所以整份清空。
			 *
			 * 保留一个空版本 V0.0.1 作为起点：
			 *   - 面板需要「当前版本」才能渲染，完全没有版本会到处显示未就绪；
			 *   - 空版本比无版本更接近真实首次使用（用户还没生成过任何用例）。
			 *
			 * 不再提供 V0.0.2：没有数据可切，留着反而是噪音。
			 * 真实版本由「生成用例」动作按技能流程追加。
			 */
			return {
				versions: [
					{ name: "V0.0.1", at: new Date().toISOString(), status: "current" }
				],
				activeVersion: "V0.0.1",
				byVersion: {
					"V0.0.1": []
				}
			};
		}

		/** 取某条用例的步骤数（编辑后可能是空数组）。 */
		function itStepCount(record) {
			return Array.isArray(record && record.steps) ? record.steps.length : 0;
		}

		/**
		 * 取某条用例的执行记录条数。
		 *
		 * 步骤页主表用例名称后的角标就显示这个数字：它告诉用户「这条跑过几次」，
		 * 与「有几个步骤」(itStepCount) 是两件事，不要混用。
		 * 子表里一条记录 = 一次执行（单步执行一次算一条，一键执行一次也算一条）。
		 */
		function itRunCount(record) {
			return Array.isArray(record && record.records) ? record.records.length : 0;
		}

		/** 某条用例按场景归属；空场景算「未分组」。 */
		function itScenarioOf(record) {
			var name = typeof record?.scenario === "string" ? record.scenario.trim() : "";
			return name === "" ? IT_SCENARIOS_NONE : name;
		}

		/**
		 * 界面上要显示的用例标识。
		 *
		 * 规范（生成用例时就必须产出 `caseCode`）要求**显示用 caseCode**，
		 * 格式形如 `GN-651-JYSG_SRS_UI_TESTING-1-T001.CTD`；
		 * 而 `caseId` 是内部主键（面板、执行记录、报告都靠它关联），不该占人眼那一列。
		 *
		 * 兜底：老数据可能只有 caseId 没有 caseCode（规范加进来之前生成的），
		 * 这时退回 caseId，不要显示空 —— 否则整列空白比显示旧编号更糟。
		 */
		function caseLabel(record) {
			var code = record && typeof record.caseCode === "string" ? record.caseCode.trim() : "";
			if (code !== "") return code;
			var id = record && typeof record.caseId === "string" ? record.caseId.trim() : "";
			return id !== "" ? id : "—";
		}

		/**
		 * 场景清单：全部用例固定第一，其余按名称排，空场景落到「未分组」。
		 *
		 * @param records 用例列表
		 * @param names   features.json 里的显式功能项名（可选）
		 *
		 * 口径与单元测试的 `layerRows()` 一致：**显式清单 ∪ 用例里实际用到的**。
		 * 只按用例聚合的话，新建出来但还没放用例的功能项会立刻消失 ——
		 * 用户点完「新建」什么也看不到，会以为没生效。
		 */
		function itScenarioRows(records, names) {
			var counts = Object.create(null);
			(Array.isArray(records) ? records : []).forEach(function (record) {
				var name = itScenarioOf(record);
				counts[name] = (counts[name] || 0) + 1;
			});
			// 显式清单先并进来，用 0 兜底 —— 空的功能项也要出现在侧栏里。
			(Array.isArray(names) ? names : []).forEach(function (name) {
				if (typeof name !== "string") return;
				var trimmed = name.trim();
				if (trimmed === "") return;
				if (counts[trimmed] === undefined) counts[trimmed] = 0;
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

		/**
		 * 把版本号（"V0.0.12" 这种）转成可比较的数字。
		 *
		 * 直接用字符串比较会出错：V0.0.10 < V0.0.9（'1' < '9'），
		 * 而实际它是更晚的版本。这里取每段的数字，按 major * 1e6 + minor * 1e3 + patch
		 * 压缩成一个整数 —— 覆盖到千位足够版本号用。
		 */
		function itVersionValue(name) {
			var text = typeof name === "string" ? name.replace(/^[Vv]/, "") : "";
			var parts = text.split(".");
			var major = parseInt(parts[0], 10) || 0;
			var minor = parseInt(parts[1], 10) || 0;
			var patch = parseInt(parts[2], 10) || 0;
			return major * 1000000 + minor * 1000 + patch;
		}

		/**
		 * 按搜索结果过滤集成用例：标识 / 名称 / 说明 / 场景 / 类型名。
		 *
		 * options.results 是「执行结果」多选筛选：空数组表示不限，
		 * 非空时只保留最新一次执行结果命中其中任一值的用例。
		 */
		function itFilterRecords(records, options) {
			var query = typeof options?.query === "string" ? options.query.trim().toLowerCase() : "";
			var scenario = typeof options?.scenario === "string" ? options.scenario : "";
			var type = typeof options?.type === "string" ? options.type : "all";
			var status = typeof options?.status === "string" ? options.status : "all";
			var results = Array.isArray(options?.results) ? options.results : [];
			return (Array.isArray(records) ? records : []).filter(function (record) {
				if (scenario !== "" && scenario !== IT_SCENARIOS_ALL) {
					if (itScenarioOf(record) !== scenario) return false;
				}
				if (type !== "all" && record.type !== type) return false;
				if (status !== "all" && (record.status || "none") !== status) return false;
				if (results.length > 0 && results.indexOf(itLatestResult(record)) === -1) return false;
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
				// 下载：向下箭头 + 底部托盘。用于「导出报告」——
				// 它和「查看报告」（eye）必须有明显区别，原来两个都是文件/眼睛图标，容易点混。
				case "download":
					children = [
						h("path", { key: "a", d: "M12 4v10" }),
						h("path", { key: "b", d: "m7.5 10 4.5 4.5 4.5-4.5" }),
						h("path", { key: "c", d: "M5 19h14" })
					];
					break;
				// 拖拽手柄：3 列 × 2 行共 6 个实心圆点。
				// 用 fill 而不是 stroke —— 圆点要实心才像抓手，描边会变成小圈。
				case "grip":
					children = [4.5, 8.5].flatMap(function (cy, row) {
						return [8, 12, 16].map(function (cx, col) {
							return h("circle", { key: "d" + row + col, cx: cx, cy: cy + 3, r: 1.35, fill: "currentColor", stroke: "none" });
						});
					});
					break;
				// 筛选：漏斗。用于「筛选」按钮（对齐原型里的漏斗图标）。
				case "filter":
					children = [h("path", { key: "a", d: "M4 5h16l-6.2 7.4V19l-3.6-2v-4.6z" })];
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
		function callApi(path, init, timeoutMs) {
			// 本地宿主正常都是毫秒级；加超时避免某次请求挂住，界面一直停在“正在查找…”。
			var controller = typeof AbortController === "function" ? new AbortController() : null;
			var budget = typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 8000;
			var timer = controller !== null ? setTimeout(function () { controller.abort(); }, budget) : null;
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
				if (error && error.name === "AbortError") throw new Error("请求超时（" + Math.round(budget / 1000) + " 秒），请稍后重试");
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
		function prepareRun(sessionId, scope, caseId, caseIds) {
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
			if (scope === "cases") body.caseIds = Array.isArray(caseIds) ? caseIds : [];
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
		function displayRunLog(data) {
			if (!data || !data.exists) return "";
			return (data.content || "") + (data.analysis ? "\n\n── 模型异常分析（辅助判断，非执行器原始输出）──\n" + data.analysis : "");
		}
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
			// 默认仍是 <label>（点标题能聚焦输入框）；传 asDiv 时用 <div>，
			// 供复选框组使用——否则外层 label 会把整块区域的点击都转给第一个复选框。
			var tag = props.asDiv ? "div" : "label";
			return h(tag, { className: cn("dp-field", props.full ? "full" : "") },
				h("span", { className: "dp-label" }, props.label, props.required ? h("em", null, "*") : null),
				props.children,
				props.hint ? h("span", { className: "dp-hint" }, props.hint) : null
			);
		}

		function TypeTag(props) {
			if (Array.isArray(props.testTypes) && props.testTypes.length > 1) {
				return h("span", null, props.testTypes.map(function (type) { return h(TypeTag, { key: type, testType: type }); }));
			}
			var meta = TEST_TYPES[props.testType] || { label: "待重新分类", tone: "func" };
			return h("span", { className: "dp-type", "data-tone": meta.tone }, meta.label);
		}

		function CaseId(props) {
			var value = props.caseId || "";
			return h("span", { className: "dp-case-id", title: value || "未填写用例标识" }, value || "—");
		}
		function typesOf(record) {
			return [record.testType].concat(record.testTypes || []).filter(function (type, index, all) {
				return TEST_TYPE_KEYS.indexOf(type) !== -1 && all.indexOf(type) === index;
			});
		}
		function runSummaryKey(records) {
			return records.map(function (record) {
				return String(record.id || "") + "\u0000" + String(record.caseId || "");
			}).join("\u0001");
		}
		function updateCaseStatus(previous, id, latestStatus) {
			var next = Object.assign({}, previous);
			if (latestStatus) next[id] = latestStatus;
			else delete next[id];
			return next;
		}
		/**
		 * 测试类型：五类全部铺开成复选框，可多选。
		 * 选中项同时写回 testTypes（全部）与 testType（第一个，保证原有字段语义）。
		 */
		function TestTypeChecks(props) {
			var selected = typesOf(props.values).filter(function (type) { return TEST_TYPE_KEYS.indexOf(type) !== -1; });
			return h("div", { className: "dp-type-checks" },
				TEST_TYPE_KEYS.map(function (key) {
					var on = selected.indexOf(key) !== -1;
					// 注意：外层 Field 已经是 <label>，这里不能再嵌 label，否则整块区域都会关联到第一个复选框。
					var toggle = function () {
						var next = on
							? selected.filter(function (type) { return type !== key; })
							: selected.concat(key);
						next = TEST_TYPE_KEYS.filter(function (type) { return next.indexOf(type) !== -1; });
						props.onChange(next);
					};
					return h("span", {
						key: key,
						className: cn("dp-type-check", on ? "is-on" : ""),
						onClick: function (event) {
							// 点复选框本身由 onChange 处理，避免重复切换。
							if (event && event.target && event.target.type === "checkbox") return;
							toggle();
						}
					},
						h("input", {
							type: "checkbox",
							className: "dp-type-check-box",
							value: key,
							checked: on,
							onClick: function (event) { event.stopPropagation(); },
							onChange: toggle
						}),
						h("span", { className: "dp-type-check-label" }, TEST_TYPES[key].label)
					);
				})
			);
		}

		/** 单元格文本。默认截断 2 行；lines={1} 单行 + title 悬停看全文，lines={3} 截断 3 行。 */
		function CellText(props) {
			var value = props.value || "";
			var cls = props.lines === 1 ? "dp-cell-1" : props.lines === 3 ? "dp-cell-3" : "";
			return h("p", {
				className: cn("dp-cell-text", cls, value ? "" : "empty"),
				// 单行截断时把全文放 title，否则鼠标悬停看不到被截掉的部分。
				title: value && props.lines === 1 ? value : undefined
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
					h(TypeTag, { testType: record.testType, testTypes: typesOf(record) })
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
							content: displayRunLog(logData),
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
							content: displayRunLog(log),
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

		/**
		 * 自定义层级名：记录里的 category 字段，空串表示「默认（未分层）」。
		 * 与 subjectFunction 是两套独立维度，不能用其中一个推断另一个。
		 */
		function categoryOf(record) {
			return typeof record?.category === "string" ? record.category.trim() : "";
		}

		/**
		 * 自定义层级左栏行。
		 *
		 * 第一行「全部层级」（value 空串）固定在最前，点它 = 清掉层级筛选；
		 * 其余按名字排。「空层级」也要出现在列表里 —— 建完就能改名/删除/往里放用例，
		 * 只在记录里聚合的话新建的空层级会立刻消失。
		 * 所以显式清单（snap.categories）∪ 记录里实际用到的，与后端 categoryList 口径一致。
		 */
		function layerRows(records, names) {
			var list = Array.isArray(records) ? records : [];
			var seen = Object.create(null);
			(Array.isArray(names) ? names : []).forEach(function (name) {
				if (typeof name === "string" && name.trim() !== "") seen[name.trim()] = true;
			});
			list.forEach(function (record) {
				var name = categoryOf(record);
				if (name !== "") seen[name] = true;
			});
			var rows = [{ key: "__all__", value: "", label: "全部用例", count: list.length }];
			Object.keys(seen).sort(function (a, b) { return a.localeCompare(b, "zh-CN"); }).forEach(function (name) {
				rows.push({
					key: "layer:" + name,
					value: name,
					label: name,
					count: list.filter(function (record) { return categoryOf(record) === name; }).length
				});
			});
			return rows;
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

		/*
		 * 两种用途共用同一个弹窗，靠 props.mode 分流：
		 *   "function"（默认）—— 给选中的用例设置「被测函数」，带 datalist 可选已有函数
		 *   "layer"          —— 新建 / 重命名「自定义层级」，纯文本、60 字符上限
		 * 两者校验规则不同（函数 240 / 层级 60，层级还禁用内置名），所以必须分开。
		 */
		function CategoryPrompt(props) {
			var layerMode = props.mode === "layer";
			var valueState = useState(props.initialValue || "");
			var value = valueState[0];
			var setValue = valueState[1];
			var errorState = useState("");
			var error = errorState[0];
			var setError = errorState[1];

			function submit() {
				var name = value.trim();
				if (layerMode) {
					if (name === "") { setError("层级名不能为空"); return; }
					if (name === "默认") { setError("「默认」是内置层级，换个名字"); return; }
					if (name.length > 60) { setError("层级名最多 60 个字符"); return; }
					props.onSubmit(name);
					return;
				}
				if (name.length > 240) { setError("被测函数最多 240 个字符"); return; }
				props.onSubmit(name);
			}

			return h(Modal, {
				title: props.title,
				subtitle: props.subtitle,
				onClose: props.onClose,
				footer: [
					h(Button, { key: "cancel", onClick: props.onClose }, "取消"),
					h(Button, { key: "ok", variant: "primary", "data-it": layerMode ? "layer-name-ok" : "function-name-ok", onClick: submit }, "确定")
				]
			},
				layerMode
					? h(Field, { label: "层级名称", full: true, hint: "填新名字就是新建一个层级；建好后可以把用例放进去。" },
						h("input", {
							className: "dp-input",
							value: value,
							maxLength: 60,
							placeholder: "填写层级名称",
							"data-it": "layer-name-input",
							onChange: function (event) { setValue(event.target.value); setError(""); },
							onKeyDown: function (event) { if (event.key === "Enter") submit(); }
						})
					)
					: h(FunctionField, { value: value, functions: props.functions, listId: "dp-bulk-functions", onChange: function (next) { setValue(next); setError(""); } }),
				layerMode ? null : h("p", { className: "dp-hint" }, "填写已有或新的被测函数；清空后确定可解除所选用例的函数关联。"),
				error ? h("p", { className: "dp-hint", style: { color: "var(--dp-danger)" } }, error) : null
			);
		}

		/**
		 * 新建功能项弹窗（集成测试）。
		 *
		 * 为什么不直接复用 CategoryPrompt：它的校验文案是「层级名不能为空」，
		 * 在集成侧会让人以为改到了单元测试的层级。这里字段名、提示、上限都按功能项来，
		 * 上限 30 与用例编辑器里的 `scenario: 30` 同一口径 —— 超了会被用例表单拒掉。
		 */
		function FeaturePrompt(props) {
			var valueState = useState("");
			var value = valueState[0];
			var setValue = valueState[1];
			var errorState = useState("");
			var error = errorState[0];
			var setError = errorState[1];

			function submit() {
				var name = value.trim();
				if (name === "") { setError("功能项名称不能为空"); return; }
				if (name.length > 30) { setError("功能项名称最多 30 个字符"); return; }
				props.onSubmit(name);
			}

			return h(Modal, {
				title: "新建功能项",
				subtitle: "功能项是用例的分组维度，属于当前用例版本",
				onClose: props.onClose,
				footer: [
					h(Button, { key: "cancel", onClick: props.onClose }, "取消"),
					h(Button, { key: "ok", variant: "primary", "data-it": "feature-name-ok", onClick: submit }, "确定")
				]
			},
				h(Field, { label: "功能项名称", full: true, hint: "建好后可以把用例归到这一项下；名称在当前版本内不能重复。" },
					h("input", {
						className: "dp-input",
						value: value,
						maxLength: 30,
						placeholder: "填写功能项名称",
						"data-it": "feature-name-input",
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
			// 轮询看到这次 run 已经落盘后，用 settledRunId 记住它，不再当“正在执行”过滤掉。
			var settledState = useState("");
			var settledRunId = settledState[0];
			var setSettledRunId = settledState[1];
			pendingRef.current = awaiting && settledRunId !== (props.pendingRunId || "")
				? props.pendingRunId || ""
				: null;

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
				if (typeof props.onRunsLoaded === "function") {
					var latestOutcome = runs.length > 0 ? (runs[0].caseOutcome || runs[0].status || "") : "";
					props.onRunsLoaded(record.id, runs.length, latestOutcome);
				}
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


			// 执行结束后自动刷新一次：只要这次 run 还没落盘（status 仍是 running），
			// 就每 3 秒轻量重读一遍；一旦看到它结束就重读记录，用户不用去点表头的「刷新」。
			// 有界（最多 40 次，约 2 分钟），且不监听对话、不做无上限轮询。
			useEffect(function () {
				var pendingRunId = props.pendingRunId || "";
				if (!awaiting || sessionId === "" || pendingRunId === "") return undefined;
				var alive = true;
				var attempts = 0;
				var timer = setInterval(function () {
					if (!alive) return;
					attempts += 1;
					if (attempts > 40) { clearInterval(timer); return; }
					fetchRunList(sessionId, "case", record.caseId).then(function (data) {
						if (!alive) return;
						var runs = (data && data.runs) || [];
						var hit = null;
						for (var i = 0; i < runs.length; i += 1) {
							if (runs[i].runId === pendingRunId) { hit = runs[i]; break; }
						}
						if (hit === null || hit.status === "running") return;
						// 这次 run 已经落盘：不再把它当“正在执行”，然后重读一次记录。
						// 落盘了就把它记成“已结束”：下一次渲染不再把它当正在执行过滤掉，
						// 即使父组件的 awaiting 还没清（清它要等用户点刷新）。
						setSettledRunId(pendingRunId);
						clearInterval(timer);
						setReloadTick(function (n) { return n + 1; });
					}).catch(function () {
						// 网络抖动不打断轮询；到次数上限后会自己停。
					});
				}, 3000);
				return function () {
					alive = false;
					clearInterval(timer);
				};
			}, [awaiting, props.pendingRunId, sessionId, record.caseId]);

			function remove(runId) {
				props.onRemove(runId, function (done) {
					if (done) setReloadTick(function (n) { return n + 1; });
				});
			}

			var body = null;
			// 等结果期间只显示执行状态，完成后在记录里显示耗时。
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
							h("th", { style: { width: "132px" } }, "执行时间"),
							h("th", { style: { width: "72px" } }, "耗时"),
							// 输入 / 预期输出：取那次执行的快照值（用例事后改了也不影响已跑过的记录）。
							h("th", { style: { width: "150px" } }, "输入"),
							h("th", { style: { width: "150px" } }, "预期输出"),
							h("th", { className: "dp-grow", style: { width: "24%" } }, "实际输出"),
							h("th", { style: { width: "72px" } }, "结果"),
							h("th", { style: { width: "100px" } }, "操作")
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
								h(CellText, { value: run.input, lines: 1 })
							),
							h("td", { className: "dp-left" },
								h(CellText, { value: run.expected, lines: 1 })
							),
							h("td", null,
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
						log: displayRunLog(logData),
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
				placeholder: props.placeholder || "搜索用例名称 / 用例标识 / 测试说明 / 执行状态",
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
		 * 左栏「用例层级」，两段：
		 *   上段「自定义层级」—— 手动新建/改名/删除的层级（记录里的 category 字段）
		 *   下段「按被测函数」—— 由 subjectFunction 自动聚合，不能手工增删
		 *
		 * 两段是**互斥**的筛选维度：同一时刻只按其中一个过滤。
		 * 选自定义层级会清掉函数选择，反之亦然（见 DataPanelView 的 pickLayer / pickFunction）。
		 *
		 * 两条约束来自用户反馈：
		 *   1. 左栏高度跟着表格走 —— 表格矮而层级多时不能无限拉长，
		 *      高度到表格为止，剩下的靠分页翻；
		 *   2. 表格高、层级少时不分页，保持原样。
		 * 高度由父组件量好（props.boardHeight）传进来，这里只负责按行高反算每页几条。
		 * 自己量自己的话会陷入「内容变高 → 自己更高 → 又能放更多」的循环。
		 */
		function CategorySidebar(props) {
			var functionRowsList = Array.isArray(props.rows) ? props.rows : [];
			var activeCategory = props.activeCategory;
			var activeLayer = props.activeLayer;
			// 默认（也是唯一）的维度：按被测函数分组。
			// 「自定义层级 / 按被测函数」两个切换按钮已移除，层级不再作为独立的可切维度。
			var axis = "function";
			// 去掉「未关联函数」那一行，只留「全部用例」+ 各被测函数。
			var rows = functionRowsList.filter(function (row) { return row.value !== null; });

			var docked = props.docked === true;
			var boardHeight = Number(props.boardHeight) || 0;
			// 不再分页：层级多时靠 .dp-cat-scroll 自己滚动。
			var listRows = rows;


			return h("aside", {
				className: "dp-sidebar",
				// 固定高度：直通底部，不跟着内容走（有量到表格高度就用它，否则用 CSS 兜底 62vh）。
				// 宽度同理：拖动过就锁用户选的宽度，没拖过沿用 CSS 默认值。
				style: (boardHeight > 0 || props.width > 0)
					? {
						height: boardHeight > 0 ? boardHeight + "px" : undefined,
						// CSS 里的 62vh 只是首帧兜底；量到真实高度后不再限制上限。
						maxHeight: boardHeight > 0 ? "none" : undefined,
						width: props.width > 0 ? props.width + "px" : undefined
					}
					: null,
			},
				// 表头：标题 + 「新建层级」按钮（只作用于自定义层级那一段）。
				h("div", { className: "dp-sidebar-head" },
					h("span", { className: "dp-sidebar-title" }, "用例层级"),
					h("div", { className: "dp-sidebar-tools" },
						h(IconButton, {
							name: "plus",
							label: "新建层级",
							"data-it": "cat-create",
							onClick: function () {
								if (typeof props.onCreate === "function") props.onCreate();
							}
						})
					)
				),
				h("div", { className: "dp-cat-scroll" },
					// 只有「全部用例」时也不留空提示（函数分组总是有首行）。
					listRows.map(function (row) {
						// 首行「全部用例」：value 为空串，点它 = 清掉层级筛选。
						if (row.value === "") {
							return h("button", {
								key: row.key,
								type: "button",
								className: cn("dp-cat-group", activeCategory === "" && activeLayer === "" ? "is-active" : ""),
								// 条数本来就常驻显示，tooltip 里不再重复。
								title: "显示全部用例",
								onClick: function () { props.onSelect(""); }
							},
								h("span", { className: "dp-cat-group-name" }, row.label),
								h("span", { className: "dp-cat-group-count" }, String(row.count))
							);
						}
						var selected = row.kind === "layer" ? activeLayer === row.value : activeCategory === row.value;
						return h("div", {
							key: row.key,
							className: cn("dp-cat", selected ? "is-active" : ""),
						},
							h("button", {
								type: "button",
								className: "dp-cat-main",
								// 同上：条数已常驻显示，tooltip 只留名字。
								title: row.label,
								onClick: function () { props.onSelect(row.value, row.kind); },
							},
								h("span", { className: "dp-cat-name" }, row.label),
								h("span", { className: "dp-cat-count" }, String(row.count))
							),
							// 只有自定义层级才有改名/删除；函数行是自动聚合的。
							row.kind === "layer"
								? h("span", { className: "dp-cat-ops" },
									h("span", {
										role: "button",
										className: "dp-icon-btn",
										title: "重命名层级",
										"data-it": "cat-rename-" + row.value,
										onClick: function () { if (typeof props.onRename === "function") props.onRename(row.value); }
									}, h(Icon, { name: "edit", size: 12 })),
									h("span", {
										role: "button",
										className: "dp-icon-btn danger",
										title: "删除层级（用例退回默认层）",
										"data-it": "cat-delete-" + row.value,
										onClick: function () { if (typeof props.onDelete === "function") props.onDelete(row.value); }
									}, h(Icon, { name: "trash", size: 12 }))
								)
								: null
						);
					})
				),
			);
		}

		function RecordFormModal(props) {
			// 用例名称 = 「函数短名 + 中文测试类型」，与服务端 resolveCaseTitle 同一规则。
			// 面板只负责展示与提交时带上派生值；最终定稿以服务端为准。
			function caseFunctionShortName(raw) {
				var text = String(raw || "").trim();
				if (!text) return "";
				if (text.indexOf("::") !== -1) {
					var parts = text.split("::").filter(function (part) { return part !== ""; });
					text = parts.length > 0 ? parts[parts.length - 1] : "";
				} else {
					// `Order.discount` 是「类.方法」，`order.cpp` 是文件名：只对已知源码扩展名去后缀。
					var segment = text.split(/[\\/]/).filter(function (part) { return part !== ""; }).pop() || "";
					text = segment.replace(/\.(?:c|cc|cpp|cxx|h|hpp|hxx|py|js|ts|tsx|jsx|go|rs|java|cs|rb|php|swift|kt|m|mm)$/i, "");
				}
				text = text.replace(/\(.*$/, "").trim();
				var pieces = text.split(/[.:>]/).filter(function (part) { return part !== ""; });
				return (pieces.pop() || "").trim();
			}

			function derivedTitle(values) {
				var short = caseFunctionShortName(values && values.subjectFunction);
				var meta = values && TEST_TYPES[values.testType] ? TEST_TYPES[values.testType] : null;
				if (!short || meta === null) return "";
				return short + "-" + meta.label;
			}
			var initial = props.record || {};
			var state = useState(function () {
				return {
					caseId: initial.caseId || "",
					title: initial.title || "",
					testType: TEST_TYPE_KEYS.indexOf(initial.testType) !== -1 ? initial.testType : (props.mode === "edit" ? "" : "functional"),
					testTypes: typesOf(initial),
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
				// 能派生就以派生名为准；派生不出来（没填被测函数）时沿用已有名字，与服务端一致。
				var title = derivedTitle(values) || String(values.title || "").trim();
				if (!title) {
					setLocalError("请先填写被测函数与测试类型，用例名称会自动生成");
					return;
				}
				if (TEST_TYPE_KEYS.indexOf(values.testType) === -1) {
					setLocalError("请选择测试类型");
					return;
				}
				setLocalError("");
				// 标题不以面板输入为准：带上派生值，服务端也会再按同一规则定稿。
				props.onSubmit(Object.assign({}, values, { title: title }));
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
					// 用例名称由「被测函数 + 测试类型」自动派生，不再让人手填 T001。
					h(Field, {
						label: "用例名称（自动生成）",
						full: true,
						hint: "= 函数短名 + 中文测试类型（如 addLine-边界测试）。填了被测函数就按规则定稿，写别的也不会生效。",
					},
						h("input", {
							ref: firstRef,
							className: "dp-input",
							value: derivedTitle(values) || String(values.title || ""),
							maxLength: 200,
							readOnly: true,
							placeholder: "填写被测函数与测试类型后自动生成",
						})
					),
					h(Field, { label: "用例标识", hint: "留空会自动生成一个 TC-xxxxxxxx。", full: true },
						h("input", {
							className: "dp-input dp-input-mono",
							value: values.caseId,
							maxLength: 80,
							placeholder: "GN-ZZKZ-RINGBUFF-T001",
							onChange: function (event) { set("caseId", event.target.value); }
						})
					),
					h(Field, { label: "测试类型", full: true, asDiv: true },
						h(TestTypeChecks, {
							values: values,
							onChange: function (types) { set("testTypes", types); set("testType", types[0] || ""); }
						})
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
			var records = snap.records || [];
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
			var savedHintState = useState("");
			var savedHint = savedHintState[0];
			var setSavedHint = savedHintState[1];
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
			// 每条用例已执行的次数（来自 run list）。
			var runCountsState = useState({});
			var runCounts = runCountsState[0];
			var setRunCounts = runCountsState[1];
			// 每条用例最新一次执行的结果（passed / failed / error）。
			var caseStatusesState = useState({});
			var caseStatuses = caseStatusesState[0];
			var setCaseStatuses = caseStatusesState[1];
			var summaryRecordsKey = runSummaryKey(records);

			// 首次加载时批量拉取所有用例的执行计数和最新状态。
			useEffect(function () {
				var sessionId = panelSessionId(props);
				if (!sessionId || records.length === 0) return;
				var active = true;
				var promises = records.map(function (r) {
					return fetchRunList(sessionId, "case", r.caseId).then(function (data) {
						var runs = (data && data.runs) || [];
						var latest = runs[0];
						return { id: r.id, count: runs.length, status: latest ? (latest.caseOutcome || latest.status || "") : "" };
					}).catch(function () { return { id: r.id, count: 0, status: "" }; });
				});
				Promise.all(promises).then(function (results) {
					if (!active) return;
					var counts = {};
					var statuses = {};
					results.forEach(function (r) {
						counts[r.id] = r.count;
						if (r.status) statuses[r.id] = r.status;
					});
					setRunCounts(counts);
					setCaseStatuses(statuses);
				});
				return function () { active = false; };
			}, [summaryRecordsKey, panelSessionId(props)]);
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
			/*
			 * 自定义层级（记录的 category 字段）的筛选值。
			 * 与 activeCategory（被测函数）是**互斥**的两套维度：
			 *   axis === "function" → 按 activeCategory 过滤
			 *   axis === "layer"    → 按 activeLayer 过滤
			 * 同时只用一个，避免两个条件叠成 AND 后筛出空表。
			 */
			var layerState = useState("");
			var activeLayer = layerState[0];
			var setActiveLayer = layerState[1];
			// 左栏固定按被测函数分组（不再提供维度切换）。
			var axisState = useState("function");
			var axis = axisState[0];
			var setAxis = axisState[1];
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
			// 左栏宽度：0 表示沿用 CSS 默认宽度（普通 128 / 侧栏 112），拖动后锁成用户选的像素值。
			var sidebarWidthState = useState(0);
			var sidebarWidth = sidebarWidthState[0];
			var setSidebarWidth = sidebarWidthState[1];
			var resizingState = useState(false);
			var resizing = resizingState[0];
			var setResizing = resizingState[1];

			/*
			 * 左栏拖拽调宽：把手正好盖在两栏间距上。
			 * 拖动时直接改 DOM 宽度（不逐帧 setState，避免整张表格重渲染），松手后再写回状态。
			 */
			function startSidebarResize(event) {
				if (!event || (event.pointerType === "mouse" && event.button !== 0)) return;
				var handle = event.currentTarget;
				var aside = handle ? handle.previousElementSibling : null;
				if (!aside) return;
				event.preventDefault();
				var board = handle.parentElement;
				var startX = event.clientX;
				var startWidth = Math.round(aside.getBoundingClientRect().width) || (docked ? 112 : 128);
				var lastWidth = startWidth;
				var clientX = startX;
				var frame = 0;
				setResizing(true);
				handle.classList.add("is-dragging");

				function apply() {
					frame = 0;
					var boardWidth = board ? board.getBoundingClientRect().width : 0;
					// 至少给右侧表格留 280px；极窄时仍保证左栏 96px。
					var maxWidth = Math.max(96, Math.min(420, boardWidth - 280));
					var next = Math.round(startWidth + (clientX - startX));
					if (next < 96) next = 96;
					if (next > maxWidth) next = maxWidth;
					lastWidth = next;
					aside.style.width = next + "px";
				}
				function move(moveEvent) {
					clientX = moveEvent.clientX;
					if (frame) return;
					if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(apply);
					else apply();
				}
				function stop() {
					if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
					frame = 0;
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", stop);
					window.removeEventListener("pointercancel", stop);
					handle.classList.remove("is-dragging");
					setResizing(false);
					setSidebarWidth(lastWidth);
				}
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", stop);
				window.addEventListener("pointercancel", stop);
			}

			// 删掉了原来那个「卡片高度 → 左栏容量」的 ResizeObserver：
			// 卡片内容少时高度也跟着矮，左栏层级就被切成一页只放两三层，整个目录缩在顶部。
			// 现在两栏统一用「窗口可用高度」，不随表格内容多少变。

			// 可用高度 = 窗口高度 - 卡片顶边（实测，不用 vh - 固定值，换分辨率/缩放都对）。
			// 卡片用 height 撑满（不是 max-height）：左边层级栏和右边表格等高，页码永远贴底，
			// 用例多少都不会把左栏缩上去。
			useEffect(function () {
				if (typeof window === "undefined") return undefined;
				var frame = 0;
				function apply() {
					frame = 0;
					var node = boardRef.current;
					if (!node) return;
					var top = node.getBoundingClientRect().top;
					if (!(top > 0)) return;
					var avail = Math.round(window.innerHeight - top - 16);
					if (avail < 240) avail = 240;
					node.style.height = avail + "px";
					setBoardHeight(avail);
				}
				function schedule() {
					if (frame) return;
					if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(apply);
					else frame = setTimeout(apply, 16);
				}
				schedule();
				// 数据加载后表头 / 统计行可能换行，卡片顶边会变，再量一次。
				var late = setTimeout(schedule, 400);
				window.addEventListener("resize", schedule);
				return function () {
					window.removeEventListener("resize", schedule);
					clearTimeout(late);
					if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
				};
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

			/**
			 * 「导出」：把最近一次整体执行的 Word 报告另存到用户选的文件夹。
			 *
			 * 不复用集成页那套导出函数：它们写在 IntegrationPanel 内部、
			 * 绑着那边的 sessionId 与提示状态。这里让单元页自成一套，
			 * 不改集成页，也不给两页之间增加耦合；宿主端点相同，
			 * 所以「只导 docx，不导 PDF」这点两页一致。
			 */
			var UNIT_EXPORT_PICK_DIR_TIMEOUT_MS = 5 * 60 * 1000;

			function pickExportDirForUnit() {
				var sid = panelSessionId(props);
				return callApi("/data-panel/export/pick-dir", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ sessionId: sid, cwd: cwdOf(sid) }),
				}, UNIT_EXPORT_PICK_DIR_TIMEOUT_MS).then(function (data) {
					if (data && data.canceled === true) return "";
					return data && typeof data.dir === "string" ? data.dir : "";
				});
			}

			function exportTotalReport() {
				var sid = panelSessionId(props);
				if (sid === "") { store.setError("还没取得当前会话"); return; }
				setRunResult("正在查找最近的测试报告…");
				fetchReportLatest(sid, "all", "").then(function (result) {
					if (!result || !result.exists) { setRunResult(""); store.setError("还没有生成总报告。"); return null; }
					if (!result.docx || !result.docx.path) { setRunResult(""); store.setError("最近一次整体执行还没有生成 Word 报告。"); return null; }
					setRunResult("请选择导出到的文件夹…");
					return pickExportDirForUnit().then(function (dir) {
						if (dir === "") { setRunResult("已取消导出。"); return null; }
						setRunResult("正在导出报告…");
						return callApi("/data-panel/export", {
							method: "POST",
							headers: { "content-type": "application/json", accept: "application/json" },
							body: JSON.stringify({ sessionId: sid, cwd: cwdOf(sid), dir: dir, paths: [result.docx.path] }),
						}, 120000).then(function (data) {
							var exported = Array.isArray(data && data.exported) ? data.exported : [];
							if (exported.length === 0) {
								setRunResult("");
								store.setError("导出失败：" + ((data && data.error) || "没有成功导出报告"));
								return null;
							}
							setRunResult("已导出到 " + (data.dir || dir));
							return data;
						});
					});
				}).catch(function (failure) {
					setRunResult("");
					store.setError("导出失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			useEffect(function () {
				// 面板打开是一个明确信号：至少此刻要确保会话订阅已经建立，
				// 否则用户切换会话时这里不会自动刷新（重启后曾出现过）。
				ensureSessionSubscription(true);
				store.load().catch(function () {});
			}, []);

			var filtered = useMemo(function () {
				var needle = query.trim().toLowerCase();
				return records.filter(function (record) {
					/*
					/*
					 * 左栏已合成一份扁平列表：层级行和函数行混排，两者互斥。
					 *   有 activeLayer → 只按记录 category 筛；
					 *   否则有 activeCategory → 按统一函数字段筛。
					 */
					if (activeLayer !== "") {
						if (categoryOf(record) !== activeLayer) return false;
					} else if (activeCategory !== "") {
						var owned = subjectFunctionOf(record);
						if (activeCategory === null ? owned !== "" : owned !== activeCategory) return false;
					}
					if (type !== "all" && typesOf(record).indexOf(type) === -1) return false;
					if (!needle) return true;
					// 搜索范围：标识 / 名称 / 说明 / 输入 / 预期 / 被测函数 + 执行状态（仅新增，不改原逻辑）。
					var runStatus = caseStatuses[record.id] || "";
					var statusLabel = CASE_OUTCOME[runStatus] || "未执行";
					return [record.caseId, record.title, record.description, record.input, record.expected, record.subjectFunction, statusLabel, runStatus, runStatus === "" ? "未执行" : ""]
						.join(" ")
						.toLowerCase()
						.indexOf(needle) !== -1;
				});
			}, [records, query, type, activeCategory, activeLayer, axis, caseStatuses]);


			var categoryRows = useMemo(function () { return functionRows(records); }, [records]);
			var functionNames = categoryRows.slice(2).map(function (row) { return row.value; });
			// 自定义层的左栏行：显式清单 ∪ 记录里用到的（空层级也要能看见）。
			var layerRowsData = useMemo(function () { return layerRows(records, snap.categories); }, [records, snap.categories]);
			// 左栏合并成一份扁平列表：全部用例 → 自定义层级 → 按被测函数分组。
			// 层级行和函数行同级并列，靠 kind 区分点击后走哪个筛选。
			var sidebarRows = useMemo(function () {
				var allRow = categoryRows.slice(0, 1).map(function (row) { return { key: row.key, value: row.value, label: row.label, count: row.count, kind: "all" }; });
				var layerOnly = layerRowsData.slice(1).map(function (row) { return { key: row.key, value: row.value, label: row.label, count: row.count, kind: "layer" }; });
				var fnOnly = categoryRows.slice(2).map(function (row) { return { key: row.key, value: row.value, label: row.label, count: row.count, kind: "function" }; });
				return allRow.concat(layerOnly, fnOnly);
			}, [categoryRows, layerRowsData]);

			var pickedSet = useMemo(function () {
				var map = Object.create(null);
				picked.forEach(function (id) { map[id] = true; });
				return map;
			}, [picked]);

			var typeCounts = {};
			TEST_TYPE_KEYS.forEach(function (key) { typeCounts[key] = 0; });
			records.forEach(function (record) {
				typesOf(record).forEach(function (type) { typeCounts[type] += 1; });
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
				setSavedHint("");
				setFormError("");
				// 新建时把当前筛的两个维度带进表单：正在看哪个层级/函数，就默认落到那里。
				setForm({
					mode: "create",
					record: {
						subjectFunction: axis === "function" ? (activeCategory || "") : "",
						category: axis === "layer" ? (activeLayer || "") : ""
					}
				});
			}

			function openEdit(record) {
				setSavedHint("");
				setFormError("");
				setForm({ mode: "edit", record: record });
			}

			/*
			 * ── 自定义层级：新建 / 改名 / 删除 ──
			 *
			 * 数据落在记录的 category 字段上，清单由后端 categoryList 维护
			 * （显式清单 ∪ 记录里用到的，所以空层级也能存在、能改名、能删）。
			 * 这三个操作都不碰用例本身：删除层级只把用例退回默认层，一条都不删。
			 */

			/**
			 * 左栏两段互斥切换。
			 * 切维度时把另一维的选择清掉 —— 否则「按层级」还留着上次的函数筛选，
			 * 一次都筛不到会让人以为用例丢了。
			 */
			function pickAxis(next) {
				setAxis(next === "layer" ? "layer" : "function");
				if (next === "layer") setActiveCategory("");
				else setActiveLayer("");
				setPage(1);
				setPicked([]);
			}

			function pickLayer(value) {
				setAxis("layer");
				setActiveCategory("");
				setActiveLayer(typeof value === "string" ? value : "");
				setPage(1);
				setPicked([]);
			}

			function pickFunction(value) {
				setAxis("function");
				setActiveLayer("");
				setActiveCategory(value);
				setPage(1);
				setPicked([]);
			}

			/** 新建层级：不要求先勾用例，建完再往里放（旧版就是这个行为）。 */
			function submitLayerName(name) {
				var pending = categoryPrompt;
				if (pending === null) return;
				setCategoryPrompt(null);
				setBusy(true);
				var action = pending.mode === "rename"
					? store.renameCategory(pending.from, name).then(function () {
						setActiveAxisLayer(name);
					})
					: store.createCategory(name).then(function () {
						setActiveAxisLayer(name);
						// 建完重拉一次，左栏拿到的是落盘后的真实清单（含空层级）。
						return store.load(true).catch(function () {});
					});
				action
					.then(function () { store.setError(""); })
					.catch(function (failure) {
						store.setError((pending.mode === "rename" ? "重命名层级失败：" : "新建层级失败：")
							+ (failure && failure.message ? failure.message : String(failure)));
					})
					.finally(function () { setBusy(false); });
			}

			/** 新建/改名成功后把筛选切到那个层级，用户能立刻看到它。 */
			function setActiveAxisLayer(name) {
				setAxis("layer");
				setActiveCategory("");
				setActiveLayer(name);
				setPage(1);
			}

			function deleteLayer(name) {
				setConfirm({ kind: "deleteCategory", category: name });
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
						setSavedHint("用例已保存。若修改了输入、预期结果或测试场景，请同步检查对应测试代码，确保两者一致。");
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
					// 只解散层级：里面的用例退回默认层（category = ""），一条都不删。
					action = store.deleteCategory(confirm.category).then(function () {
						// 正在看这个层级的话，筛掉后会是空表，切回全部层级。
						if (activeLayer === confirm.category) {
							setActiveLayer("");
							setPage(1);
						}
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
			 * 表头全选框：作用**当前筛选结果的全部用例**（跨页，不只当前页），且不覆盖已勾的。
			 *
			 * 传入的是 filtered（筛选后的全量）：勾选时并为并集，已全选时只移除这一批。
			 * 以前传的是 pageRecords，只看当前页；现在改为全量。
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

			/**
			 * 执行选中的用例（多选）。
			 *
			 * 与单条执行同一套机制：宿主先冻结快照 + 拼命令，再把命令预填到面板所属会话。
			 * 区别只在 scope="cases" 与 caseIds；执行后保留勾选，方便对同一批连跑。
			 */
			function runPicked() {
				if (picked.length === 0) {
					store.setError("请先勾选要执行的用例。");
					return;
				}
				var targetSession = panelSessionId(props);
				var all = snap.records || [];
				var byId = Object.create(null);
				all.forEach(function (record) { byId[record.id] = record; });
				var chosen = picked.map(function (id) { return byId[id]; }).filter(Boolean);
				if (chosen.length === 0) {
					store.setError("选中的用例已经不在了，刷新后再试。");
					return;
				}
				var runnable = chosen.filter(function (record) { return record.demo !== true; });
				if (runnable.length === 0) {
					store.setError("选中的都是示例数据，没有可执行的测试代码。");
					return;
				}
				var caseIds = runnable.map(function (record) { return record.caseId; });
				setRunResult("正在准备执行 " + caseIds.length + " 条用例…");
				prepareRun(targetSession, "cases", "", caseIds).then(function (prep) {
					var outcome = prefillDraft(targetSession, runPickedPrompt(runnable, targetSession, prep));
					if (!outcome.ok) { setRunResult(""); store.setError("执行：" + outcome.message); return; }
					store.setError("");
					setRunResult(outcome.message + "  运行编号：" + prep.runId + "  框架：" + (prep.framework || prep.frameworkId || "未知"));
					// 标记这些行正在执行（不自动展开：全选时会展开上千行）。
					setAwaiting(function (previous) {
						var next = Object.assign({}, previous);
						runnable.forEach(function (record) {
							next[record.id] = { caseId: record.caseId, runId: prep.runId || "" };
						});
						return next;
					});
					// 勾选保留：方便对同一批用例连跑（要取消点勾选栏的「取消选择」）。
				}).catch(function (failure) {
					setRunResult("");
					store.setError("执行准备失败：" + (failure && failure.message ? failure.message : String(failure)));
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
						// 执行 / 报告 / 日志：三个同高、同规格，顺序固定为 执行选中 → 报告 → 日志。
						// 「执行选中」只看勾选：未勾选不可点，勾了之后文案带条数。
						h("div", { className: "dp-toolbar-actions" },
							h(Button, {
								className: "dp-run-all-btn",
								disabled: snap.status === "refreshing" || picked.length === 0,
								title: picked.length === 0
									? "请先勾选要执行的用例"
									: ("执行选中的 " + picked.length + " 条用例"),
								onClick: runPicked,
							},
								h(Icon, { name: "play", size: 15 }),
								picked.length > 0 ? ("执行选中 (" + picked.length + ")") : "执行选中"),
							h(Button, {
								className: "dp-report-btn",
								onClick: function () { openLatestTotalReport(); },
								title: "打开最近一次整体执行的 Word 报告"
							},
								h(Icon, { name: "doc", size: 15 }),
								"报告"),
							h(Button, {
								className: "dp-export-btn",
								onClick: function () { exportTotalReport(); },
								title: "把最近一次整体执行的 Word 报告导出到本地文件夹"
							},
								h(Icon, { name: "download", size: 15 }),
								"导出"),
							SHOW_REPORT_LIST ? h(Button, {
								onClick: function () { setReportView(true); },
								title: "查看已生成的测试报告列表"
							}, "报告列表") : null,
							h(Button, {
								className: "dp-log-btn",
								onClick: function () { setLogView({ record: null }); },
								title: "查看本节全部用例的执行日志"
							},
								h(Icon, { name: "log", size: 15 }),
								"日志")
						)
					),
					// 勾选反馈放在表格下方（不占表格上方的空间）。
					runResult ? h("div", { className: "dp-run-result" }, runResult) : null,
					savedHint ? h("div", { className: "dp-hint", role: "status" }, savedHint) : null,
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
				h("div", { className: cn("dp-board", resizing ? "is-resizing" : "") },
					h(CategorySidebar, {
						rows: sidebarRows,
						layerRows: layerRowsData,
						axis: axis,
						activeCategory: activeCategory,
						activeLayer: activeLayer,
						pickedCount: picked.length,
						docked: docked,
						boardHeight: boardHeight,
						width: sidebarWidth,
						onSelect: function (value, kind) {
							if (kind === "layer") pickLayer(value);
							else pickFunction(value);
						},
						onAxisChange: pickAxis,
						onCreate: function () { setCategoryPrompt({ mode: "layer" }); },
						onRename: function (name) { setCategoryPrompt({ mode: "rename", from: name }); },
						onDelete: deleteLayer
					}),
					h("div", {
						className: "dp-resizer",
						role: "separator",
						"aria-orientation": "vertical",
						"aria-label": "拖动调整用例层级宽度",
						title: "拖动调整宽度",
						onPointerDown: startSidebarResize
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
											onGoDefault: function () { setActiveCategory(""); setActiveLayer(""); setPicked([]); },
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
											h("col", { style: { width: "7%" } }),
												h("col", { style: { width: "16%" } })
											),
											h("thead", null,
												h("tr", null,
													h("th", { className: "dp-pick" },
												h("input", {
													type: "checkbox",
													"aria-label": "全选全部用例",
													// 全选的是当前筛选结果的全部（不只当前页）；跟进搜索/类型/状态条件。
													checked: filtered.length > 0 && filtered.every(function (record) { return pickedSet[record.id] === true; }),
													ref: function (node) { if (node) node.indeterminate = picked.length > 0 && !(filtered.length > 0 && filtered.every(function (record) { return pickedSet[record.id] === true; })); },
													title: "全选当前筛选下的全部用例（共 " + filtered.length + " 条）",
													onChange: function () { togglePickAll(filtered.map(function (record) { return record.id; })); }
												})
											),
											h("th", null, "用例标识"),
													h("th", null, "用例名称"),
													h("th", null, "测试类型"),
													h("th", null, "测试说明"),
													h("th", null, "输入"),
													h("th", null, "预期输出"),
											h("th", null, "执行状态"),
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
													h("div", { className: "dp-title-cell dp-case-cell" },
														h("button", {
															type: "button",
															className: "dp-expand-btn",
															"data-open": isOpen ? "true" : "false",
															title: isOpen ? "收起执行记录" : "展开执行记录",
															"aria-label": (isOpen ? "收起 " : "展开 ") + record.caseId + " 的执行记录",
															"aria-expanded": isOpen,
															onClick: function () { toggleExpand(record.id); }
														}, h(Icon, { name: "chevron", size: 19 })),
														h(CaseId, { caseId: record.caseId }),
																																							runCounts[record.id] > 0 ? h("span", { className: "dp-run-count", title: "已执行 " + runCounts[record.id] + " 次" }, String(runCounts[record.id])) : null
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
													h("td", null, h(TypeTag, { testType: record.testType, testTypes: typesOf(record) })),
													h("td", null, h(CellText, { value: record.description, lines: 1 })),
													h("td", null, h(CellText, { value: record.input, lines: 1 })),
													h("td", null, h(CellText, { value: record.expected, lines: 1 })),
											h("td", null, caseStatuses[record.id] ? h("span", { className: "dp-run-state", "data-tone": CASE_TONE[caseStatuses[record.id]] || "idle" }, CASE_OUTCOME[caseStatuses[record.id]] || caseStatuses[record.id]) : null),
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
																																																				setRunCounts(function (prev) { var next = Object.assign({}, prev); next[record.id] = (next[record.id] || 0) + 1; return next; });
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
													h("td", { colSpan: 9, className: "dp-run-cell" },
														h(RunRecords, {
															record: record,
															sessionId: panelSessionId(props),
															awaiting: awaiting[record.id] !== undefined,
															pendingRunId: awaiting[record.id] ? awaiting[record.id].runId : "",
															refreshTick: runRefreshTick,
											onReport: function (run) { openRunReport(record, run); },
											onLog: function (run) { setLogView({ record: record, runId: run.runId }); },
															onRemove: function (runId, done) { setRemoveRun({ record: record, runId: runId, done: done }); },
																										onRunsLoaded: function (id, count, latestStatus) { setRunCounts(function (prev) { var next = Object.assign({}, prev); next[id] = count; return next; }); setCaseStatuses(function (prev) { return updateCaseStatus(prev, id, latestStatus); }); },

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
								h(Button, { size: "sm", disabled: busy, onClick: function () { setCategoryPrompt({ mode: "function", initialValue: activeCategory || "" }); } }, "关联被测函数"),
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
				categoryPrompt !== null ? (categoryPrompt.mode === "layer" || categoryPrompt.mode === "rename"
					? h(CategoryPrompt, {
						mode: "layer",
						title: categoryPrompt.mode === "rename" ? "重命名层级" : "新建层级",
						subtitle: categoryPrompt.mode === "rename"
							? "当前：" + categoryPrompt.from
							: "层级用来把用例按业务模块分组，不影响「按被测函数」那一套。",
						initialValue: categoryPrompt.mode === "rename" ? categoryPrompt.from : "",
						onSubmit: submitLayerName,
						onClose: function () { setCategoryPrompt(null); }
					})
					: h(CategoryPrompt, {
						title: "关联被测函数",
						subtitle: "为已选的 " + picked.length + " 条用例设置源码中的业务函数。",
						initialValue: categoryPrompt.initialValue || "",
						functions: functionNames,
						onSubmit: submitCategoryName,
						onClose: function () { setCategoryPrompt(null); }
					})) : null,
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
							: "删除这条用例？"),
					message: confirm.kind === "clearDemo"
						? "只会移除标记为示例的用例，你后来新建或编辑过的内容会保留。"
						: (confirm.kind === "deleteCategory"
							? "层级会消失，里面的用例退回「默认」层，一条都不会被删。"
							: "删除后无法恢复，右侧已打开的详情页也会变为空。"),
					detail: confirm.kind === "delete"
						? h("span", null, "即将删除：", h("b", null, confirm.record.title))
						: (confirm.kind === "deleteCategory"
							? h("span", null, "解散层级：", h("b", null, confirm.category), "（用例保留，退回默认层）")
							: null),
					confirmLabel: confirm.kind === "clearDemo"
						? "清空示例"
						: (confirm.kind === "deleteCategory" ? "删除层级" : "删除"),
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
					testTypes: typesOf(record),
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
					h(Field, { label: "用例标识", full: true },
						h("input", {
							className: "dp-input dp-input-mono",
							value: values.caseId,
							maxLength: 80,
							placeholder: "GN-ZZKZ-RINGBUFF-T001",
							onChange: function (event) { set("caseId", event.target.value); }
						})
					),
					h(Field, { label: "测试类型", full: true, asDiv: true },
						h(TestTypeChecks, {
							values: values,
							onChange: function (types) { set("testTypes", types); set("testType", types[0] || ""); }
						})
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
						h(TypeTag, { testType: record.testType, testTypes: typesOf(record) }),
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
					h("h4", null, "旧测试代码位置"),
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
			var savedHintState = useState("");
			var savedHint = savedHintState[0];
			var setSavedHint = savedHintState[1];

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
				setSavedHint("");
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
						setSavedHint("用例已保存。若修改了输入、预期结果或测试场景，请同步检查对应测试代码，确保两者一致。");
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
				!editing && savedHint ? h("div", { className: "dp-hint", role: "status" }, savedHint) : null,
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
					type: source.type || "functional",
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
					field("title", "用例名称", "填写这条用例验证什么", { required: true }),
					/*
					 * 测试类型：7 类固定枚举（与 Skill 的 type-7-criteria.md 一致）。
					 *
					 * 为什么必须有这个下拉：
					 *   · 三个 tab 的主表都新增了「测试类型」列，值就取用例的 type；
					 *   · 用户在面板上手建/改用例时得能选类型，不能让模型生成的那次决定死；
					 *   · 原来这里没有控件、默认值还写成了 "ui"（非法值），
					 *     新建的用例类型是空的或乱的，表格里显示成原始英文串。
					 *
					 * stress（强度测试）本轮不生成，但历史数据里可能有，所以：
					 *   · 编辑已存在 stress 用例 → 仍然列出并保持选中（不然一保存就被改掉）
					 *   · 新建 → 不提供 stress 选项（Skill 明令禁止生成）
					 */
					(function () {
						var currentType = form.type || "functional";
						var keys = IT_TYPE_KEYS.filter(function (key) {
							// 新建时不提供 stress；编辑已有 stress 用例时才保留这一项
							if (key === "stress" && currentType !== "stress") return false;
							return true;
						});
						return h("label", { key: "type", className: "it-field" },
							labelRow("测试类型", false),
							readonly
								? h("div", { className: "it-input", style: { minHeight: "30px", background: "var(--dp-bg2)" } }, itTypeLabel(currentType))
								: h("div", { className: "it-input-wrap" },
									h("select", {
										className: "it-input",
										value: currentType,
										"data-it": "field-type",
										"aria-label": "测试类型",
										onChange: edit("type")
									},
										keys.map(function (key) {
											return h("option", { key: key, value: key }, IT_TYPES[key].label);
										})
									)
								)
						);
					})(),
					/*
					 * 用例功能项：下拉选择已有功能项。
					 * 功能项由对话框按代码/需求规则生成（集成测试场景），
					 * 所以这里只能选、不能当场新建。
					 */
					h("label", { key: "scenario", className: "it-field" },
						labelRow("用例功能项", false),
						readonly
							? h("div", { className: "it-input", style: { minHeight: "30px", background: "var(--dp-bg2)" } }, form.scenario || "—")
							: h("div", { className: "it-input-wrap" },
								h("select", {
									className: "it-input",
									value: form.scenario,
									"data-it": "field-scenario",
									onChange: edit("scenario")
								},
									h("option", { value: "" }, "请选择功能项"),
									(Array.isArray(props.scenarios) ? props.scenarios : []).map(function (name) {
										return h("option", { key: name, value: name }, name);
									})
								)
							)
					),
					field("description", "用例描述", "这条用例验证什么行为", { multiline: true })
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
				// 副标题只留用例名称：用例标识（IT-001）已按要求去掉
				subtitle: source.title || "",
				className: "it-steps-modal",
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
			/*
			 * 拖拽排序状态。组件自己管，因为 IntegrationStepsEditor 是独立组件，
			 * 拿不到 IntegrationPanel 里那套 dragFrom / dragIndex。
			 * 语义和测试用例页一致：按下记起点，移动到别的行时真实换位，松手结束。
			 */
			var dragFromState = useState(null);
			var dragFrom = dragFromState[0];
			var setDragFrom = dragFromState[1];
			var dragIndexState = useState(null);
			var dragIndex = dragIndexState[0];
			var setDragIndex = dragIndexState[1];

			function renumber(list) {
				return list.map(function (row, index) {
					return Object.assign({}, row, { no: index + 1 });
				});
			}
			function beginDrag(index) {
				setDragFrom(index);
				setDragIndex(index);
			}
			function endDrag() {
				setDragFrom(null);
				setDragIndex(null);
			}
			/** 把第 from 行移动到第 to 行（拖动时实时换位）。 */
			function moveRow(from, to) {
				if (from === null || to === null || from === to) return;
				if (from < 0 || from >= rows.length || to < 0 || to >= rows.length) return;
				var next = rows.slice();
				var item = next.splice(from, 1)[0];
				next.splice(to, 0, item);
				apply(function () { return next; });
				setDragFrom(to);
				setDragIndex(to);
			}

			// 拖动中松手要结束：鼠标可能已经离开列表，所以监听挂在 document 上。
			useEffect(function () {
				if (dragFrom === null) return undefined;
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined;
				function onUp() { endDrag(); }
				document.addEventListener("mouseup", onUp);
				return function () { document.removeEventListener("mouseup", onUp); };
			}, [dragFrom]);
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

			return h("div", { className: "it-steps-editor" },
				/*
				 * 列头：三列内容靠 placeholder 提示不够，长文本一填进去就看不出来是哪一列。
				 * 序号 / 操作两列没有标题，用空字符串占位保持网格对齐。
				 */
				h("div", { className: "it-step-head" },
					h("span", null, ""),
					h("span", null, "测试方法"),
					h("span", { className: "it-step-head-3" }, "输入步骤"),
					h("span", null, "预期结果"),
					h("span", null, "操作")
				),
				/*
				 * 列表容器：嵌在弹窗里时（embedded）用 it-steps-scroll 吃满剩余高度；
				 * 独立使用时退回 it-scroll-5 的紧凑上限（约五行）。
				 */
				h("div", { className: props.embedded === true ? "it-steps-scroll" : "it-scroll-5" },
					rows.length === 0
						? h("div", { className: "it-empty" }, "还没有步骤，点下面「新增步骤」加一条")
						: rows.map(function (row, index) {
							return h("div", {
								key: index,
								className: cn("it-step-row", dragIndex === index ? "is-dragging" : ""),
								onMouseEnter: function () { if (dragFrom !== null) moveRow(dragFrom, index); }
							},
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
									/*
									 * 拖拽手柄：与测试用例页同一个组件（6 个灰点的 grip 图标）。
									 * 按住后在行间移动即可换位，松手落定。
									 *
									 * 顺序调整只靠这个手柄 —— 不再另放上移/下移按钮，
									 * 两套入口做同一件事只会让操作列更挤。
									 */
									h("span", {
										className: cn("it-drag-handle is-visible", dragIndex === index ? "is-active" : ""),
										role: "button",
										tabIndex: 0,
										title: "拖动调整顺序",
										"data-it": "step-drag-" + index,
										onMouseDown: function (event) {
											if (event && typeof event.preventDefault === "function") event.preventDefault();
											beginDrag(index);
										}
									}, h(Icon, { name: "grip", size: 14 })),
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
						"data-it": "overview-export",
						onClick: function () {
							if (typeof props.onExport !== "function") {
								if (typeof props.onNotice === "function") props.onNotice("导出入口还没接好。");
								return;
							}
							props.onExport(shown);
						}
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
										h("td", { className: "it-case-id" }, caseLabel(record)),
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
			var seedState = useState(function () {
				// 测试可直接注入种子（同步），生产环境永远是 null → 走 /data-panel/integration。
				return props.initialSeed || buildIntegrationSeed();
			});
			var seed = seedState[0];
			var setSeed = seedState[1];
			/*
			 * 真实数据接入。
			 *
			 * 数据来自 <项目>/.dsh/test-sessions/<SID>/integration/ 下三套版本目录，
			 * 由宿主 /data-panel/integration 读出来。面板不再只靠内存种子：
			 *   · loadState = "idle" | "loading" | "ready" | "error"
			 *   · 加载成功后把后端的用例灌进 seed.byVersion，后面的渲染逻辑一行不用改
			 *   · 后端没有数据（首次使用）就是空列表，不是错误
			 */
			var loadStatePair = useState("idle");
			var loadState = loadStatePair[0];
			var setLoadState = loadStatePair[1];
			var loadErrorPair = useState("");
			var loadError = loadErrorPair[0];
			var setLoadError = loadErrorPair[1];
			/* 后端返回的原始三类数据（步骤页/报告页要用），原样存着。 */
			var remotePair = useState(null);
			var remote = remotePair[0];
			var setRemote = remotePair[1];
			// 当前版本：切版本会换一整套用例数据，互不影响。
			var versionState = useState(seed.activeVersion);
			var version = versionState[0];
			var setVersion = versionState[1];
			var versionOpenState = useState(false);
			var versionOpen = versionOpenState[0];
			var setVersionOpen = versionOpenState[1];
			/*
			 * 报告页的版本 = 「某一次一键执行」，与用例/步骤版本是**两套编号**。
			 *
			 * 关键坑（用户第 7 点）：原来报告页的版本下拉直接复用了 `version`（用例版本），
			 * 于是不管一键执行几次，报告页永远只显示 V0.0.1 —— 看起来像"没新建版本"。
			 * 实际上根本没有读 `report-versions/index.json`。
			 * 现在三套数据各用各的状态：
			 *   · version        → 用例页 / 步骤页（case-versions）
			 *   · reportVersion  → 报告页（report-versions）
			 */
			var reportVersionsState = useState([]);
			var reportVersions = reportVersionsState[0];
			var setReportVersions = reportVersionsState[1];
			var reportVersionState = useState("");
			var reportVersion = reportVersionState[0];
			var setReportVersion = reportVersionState[1];
			/*
			 * 报告生成器的真实路径，由宿主按插件包自身位置解析后回传
			 * （`GET /data-panel/integration` 的 `reportScript` 字段）。
			 *
			 * 为什么不在前端写死：以前话术里硬编码了一个本机仓库的绝对路径，
			 * 别人把仓库 clone 到别的盘就直接失效，报告生成不出来。
			 * 现在一律用宿主解析出来的值，拿不到才退化成相对描述。
			 */
			var reportScriptState = useState("");
			var reportScript = reportScriptState[0];
			var setReportScript = reportScriptState[1];
			// 子页下拉（测试用例 / 测试步骤 / 测试报告）是否展开。
			var switchOpenState = useState(false);
			var switchOpen = switchOpenState[0];
			var setSwitchOpen = switchOpenState[1];
			// 两个下拉的触发按钮：菜单用 fixed 定位，需要按钮的矩形。
			var switchBtnRef = useRef(null);
			var versionBtnRef = useRef(null);

			/*
			 * 点空白处 / 按 Esc 关闭所有下拉。
			 *
			 * 判断方式用 ref.contains(target)，而不是逐级比对 data-it：
			 *   · ItMenu 虽然 CSS 是 position:fixed，DOM 上仍是触发按钮的同级/子节点，
			 *     所以 contains 能正确区分「点菜单里」和「点菜单外」；
			 *   · 原来那套 data-it 白名单要求每个新菜单都往名单里加一项，漏一个就关不掉，
			 *     而且会漏掉菜单内部的文本节点/图标节点。
			 *
			 * 两个事件都监听：mousedown 处理常规点击，click 兜底某些环境里
			 * mousedown 被宿主或 preventDefault 吃掉的情况。重复关闭是幂等的。
			 */
			useEffect(function () {
				if (!switchOpen && !versionOpen && !resultOpen) return undefined;
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined;

				/*
				 * 判断点击是否落在某个下拉内部。
				 *
				 * 这里不用 ref.contains()：ItResultFilter 是普通函数、不是 React 组件
				 * （它在 IntegrationPanel 渲染时被直接调用），传进去的 ref 不会被 React 绑定，
				 * ref.current 永远是 null —— 那会导致「点菜单内部也被当成外部」，菜单立刻关掉。
				 *
				 * 改用 DOM 属性：三个下拉的容器都带 data-dropdown="switch|version|result"，
				 * 菜单本身在容器内部（ItMenu 虽然 position:fixed，DOM 上仍是子孙节点），
				 * 所以从事件目标逐级向上找这个属性即可。
				 */
				function insideDropdown(kind, target) {
					var node = target;
					while (node && node !== document) {
						if (node.getAttribute && node.getAttribute("data-dropdown") === kind) return true;
						node = node.parentNode;
					}
					return false;
				}

				function onDown(event) {
					var target = event && event.target;
					// 落在任一已打开的菜单内部 → 交给它们的 onClick 处理，不在这里关。
					if (switchOpen && insideDropdown("switch", target)) return;
					if (versionOpen && insideDropdown("version", target)) return;
					if (resultOpen && insideDropdown("result", target)) return;
					setSwitchOpen(false);
					setVersionOpen(false);
					setResultOpen(false);
				}
				function onKey(event) {
					if (event && event.key === "Escape") {
						setSwitchOpen(false);
						setVersionOpen(false);
						setResultOpen(false);
					}
				}
				document.addEventListener("mousedown", onDown, true);
				// click 兜底：个别宿主/浏览器里 mousedown 会被吞掉或先被 preventDefault，
				// 再挂一个 click 保证「点空白一定关」。重复关闭是幂等的。
				document.addEventListener("click", onDown, true);
				document.addEventListener("keydown", onKey);
				return function () {
					document.removeEventListener("mousedown", onDown, true);
					document.removeEventListener("click", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, [switchOpen, versionOpen, resultOpen]);
			// 子页：cases / steps / reports。默认进入测试用例页。
			var tabState = useState("cases");
			var tab = tabState[0];
			var setTab = tabState[1];
			/*
			 * 左栏宽度与拖拽态。
			 *
			 * 宽度是**用例页和步骤页共用的一份**：两个子页的侧栏是同一个东西，
			 * 各存一份的话，用户在用例页拖好宽度、切到步骤页又变回默认，会以为没生效。
			 * 0 表示沿用 CSS 默认宽度（128px），拖动后锁成用户选的像素值。
			 */
			var sideWidthState = useState(0);
			var sideWidth = sideWidthState[0];
			var setSideWidth = sideWidthState[1];
			var sideResizingState = useState(false);
			var sideResizing = sideResizingState[0];
			var setSideResizing = sideResizingState[1];
			// 高度不靠 JS 量：整页用 flex 撑满（见 .it-root / .it-board / .it-card 样式），
			// 面板在 display:none 时也能正确铺满，切页签无需重新计算。
			/*
			 * 显式功能项清单（features.json 里的 name 列表）。
			 *
			 * 侧栏的可选项 = 这份清单 ∪ 用例里用到的 scenario（见 itScenarioRows）。
			 * 只存名字不存 id：面板不改动功能项的 id/code/description，
			 * 写回时按名字对回原对象，对不上的才新建一条。
			 */
			var featureNamesState = useState([]);
			var featureNames = featureNamesState[0];
			var setFeatureNames = featureNamesState[1];
			// 新建功能项弹窗：null = 关闭，弹窗内部自己管输入与校验。
			var featurePromptState = useState(null);
			var featurePrompt = featurePromptState[0];
			var setFeaturePrompt = featurePromptState[1];
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
			/*
			 * 步骤孤岛：steps.json 里有步骤、但没有任何用例的 caseId 与之匹配。
			 * { count: 孤岛步骤数, sample: 前几个对不上的 caseId }
			 * 只用于步骤页顶部提示，不参与业务判断。
			 */
			var stepOrphanState = useState({ count: 0, sample: [] });
			var stepOrphan = stepOrphanState[0];
			var setStepOrphan = stepOrphanState[1];
			var reportPageState = useState(1);
			var reportPage = reportPageState[0];
			var setReportPage = reportPageState[1];
			/*
			 * 报告页是「每个功能项一组、组内各自分页」，所以页码按组名各存一份。
			 * 用 state 存 map，切换某组页码时只改那一项。
			 */
			var reportMapState = useState({});
			var reportPageMap = reportMapState[0];
			var setReportPageMap = reportMapState[1];
			function setReportPageMapSet(groupName, page) {
				setReportPageMap(function (previous) {
					var next = Object.assign({}, previous);
					next[groupName] = page;
					return next;
				});
			}
			/*
			 * 报告页的外层分页：只控制「每页显示几个功能项分组」，
			 * 组内分页（reportPageMap）保持原样，形成两级分页。
			 */
			var reportGroupPageState = useState(1);
			var reportGroupPage = reportGroupPageState[0];
			var setReportGroupPage = reportGroupPageState[1];
			var reportGroupSizeState = useState(10);
			var reportGroupSize = reportGroupSizeState[0];
			var setReportGroupSize = reportGroupSizeState[1];
			var pageSizeState = useState(10);
			var pageSize = pageSizeState[0];
			var setPageSize = pageSizeState[1];
			/*
			 * 测试用例页的拖拽排序。
			 * dragFrom 是「当前页可见列表里的下标」，null 表示没在拖；
			 * dragIndex 只用来给正在拖的那一行加高亮。
			 * 移动过程中就真实换位，松手即落定 —— 不做浮层预览，
			 * 因为表格行高一致，直接换位反而更直观。
			 */
			var dragFromState = useState(null);
			var dragFrom = dragFromState[0];
			var setDragFrom = dragFromState[1];
			var dragIndexState = useState(null);
			var dragIndex = dragIndexState[0];
			var setDragIndex = dragIndexState[1];
			/*
			 * 步骤页子表（执行记录）自己的分页。
			 * 每条用例各记一个页码（按 record.id 存），展开多条时互不干扰；
			 * 每页条数全局共用一个，选项按需求是 15 / 30 / 50 / 100。
			 */
			var subPageState = useState({});
			var subPage = subPageState[0];
			var setSubPage = subPageState[1];
			var subSizeState = useState(15);
			var subSize = subSizeState[0];
			var setSubSize = subSizeState[1];
			/*
			 * 报告页哪些功能项分组是「展开」的。
			 *
			 * 默认空数组 = 全部收起，点标题才展开 —— 这与「所有下拉菜单默认为关闭」
			 * 的要求一致：一进报告页看到的是各功能项的小结，而不是一屏铺开的表格。
			 * 点刷新也会清空，回到全收起状态。
			 */
			var expandedGroupState = useState([]);
			var expandedGroups = expandedGroupState[0];
			var setExpandedGroups = expandedGroupState[1];
			/*
			 * 报告页的多选态。
			 * multiSelect 为 true 时每行和每个分组标题前出现勾选框，
			 * 顶部换成「退出多选 / 导出已选报告 / 全选 / 清空」这一行。
			 * selected 存 record.id。
			 */
			var multiState = useState(false);
			var multiSelect = multiState[0];
			var setMultiSelect = multiState[1];
			var selectedState = useState([]);
			var selected = selectedState[0];
			var setSelected = selectedState[1];
			/*
			 * 「执行结果」多选筛选（通过 / 未通过 / 异常）。
			 * 空数组 = 不筛选；选了几项就只显示最新执行结果命中这几项的用例。
			 */
			var resultFilterState = useState([]);
			var resultFilter = resultFilterState[0];
			var setResultFilter = resultFilterState[1];
			var resultOpenState = useState(false);
			var resultOpen = resultOpenState[0];
			var setResultOpen = resultOpenState[1];
			var resultBtnRef = useRef(null);
			/*
			 * 步骤页里被展开的行（存 record.id）。
			 * 只有测试步骤这一页有行内下拉：箭头挂在序号格里，展开后是执行结果子表。
			 */
			var stepOpenState = useState([]);
			var stepOpen = stepOpenState[0];
			var setStepOpen = stepOpenState[1];
			/*
			 * 测试步骤页的多选态。
			 *
			 * 与报告页的 multiSelect / selected 是两套独立状态：两个子页各自勾各自的，
			 * 切页不该串味。命名上加了 step 前缀就是为了防止两边共用一份。
			 */
			var stepMultiState = useState(false);
			var stepMultiSelect = stepMultiState[0];
			var setStepMultiSelect = stepMultiState[1];
			/*
			 * 多选只认「执行记录」，不认「用例」。
			 *
			 * 键是 `用例id|runId` —— 一次执行就是一条，勾主表等于把它下面所有记录一起勾上。
			 * 为什么不存 record.id：那样 10 条记录只算 1 条，计数就错了。
			 * 这也是「已选 N 条」的唯一数据源，主表复选框只是它的派生视图。
			 */
			var stepPickedRunsState = useState([]);
			var stepPickedRuns = stepPickedRunsState[0];
			var setStepPickedRuns = stepPickedRunsState[1];

			/** 某条用例下所有执行记录的勾选键。 */
			function runKeysOf(record) {
				return (Array.isArray(record && record.records) ? record.records : [])
					.filter(function (run) { return run && run.runId; })
					.map(function (run) { return record.id + "|" + run.runId; });
			}
			/** 某条用例是否「全部记录都被勾上」（至少 1 条记录）。 */
			function recordFullyPicked(record) {
				var keys = runKeysOf(record);
				return keys.length > 0 && keys.every(function (k) { return stepPickedRuns.indexOf(k) !== -1; });
			}
			/** 勾 / 取消勾一条用例下的全部执行记录。 */
			function setRecordPicked(record, on) {
				var keys = runKeysOf(record);
				if (keys.length === 0) return;
				setStepPickedRuns(function (prev) {
					if (on) {
						var add = keys.filter(function (k) { return prev.indexOf(k) === -1; });
						return add.length === 0 ? prev : prev.concat(add);
					}
					return prev.filter(function (k) { return keys.indexOf(k) === -1; });
				});
			}
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

			/**
			 * 请求集成测试数据层。
			 *
			 * 成功后把后端的用例灌进 seed，并切到后端给的 activeVersion；
			 * 失败不清空当前界面（避免一次网络抖动把用户的编辑冲掉），只提示。
			 */
			function loadIntegration(keepVersion) {
				if (typeof fetch !== "function") return;
				var sid = sessionId;
				if (sid === "") { setLoadState("ready"); return; }
				setLoadState("loading");
				var url = "/data-panel/integration?sessionId=" + encodeURIComponent(sid);
				fetch(url, { method: "GET", headers: { accept: "application/json" } })
					.then(function (response) {
						return response.json().catch(function () { return {}; }).then(function (data) {
							if (!response.ok || data.ok === false) {
								throw new Error((data && data.error) || ("请求失败（HTTP " + response.status + "）"));
							}
							return data;
						});
					})
					.then(function (data) {
						var kinds = (data && data.kinds) || {};
						var caseKind = kinds.case || {};
						var stepKind = kinds.step || {};
						var reportKind = kinds.report || {};
						/*
						 * 宿主解析出的报告生成器路径（按插件包自身位置算，不写死）。
						 * 拿不到时留空，话术里会退化成「用集成测试 Skill 里给的路径」。
						 */
						setReportScript(typeof data.reportScript === "string" ? data.reportScript : "");
						var rawList = (caseKind.data && Array.isArray(caseKind.data.cases)) ? caseKind.data.cases : [];
						var features = (caseKind.data && Array.isArray(caseKind.data.features)) ? caseKind.data.features : [];
						var versions = Array.isArray(caseKind.index && caseKind.index.versions) ? caseKind.index.versions : [];
						/*
						 * 报告版本单独一套（与用例/步骤版本无关）。
						 * 只存下来供报告页的版本下拉使用，不参与 records 的选取 ——
						 * 报告页的行数据仍然来自 exec-records（按 runId 关联 run 目录）。
						 */
						var reportVersionList = Array.isArray(reportKind.index && reportKind.index.versions)
							? reportKind.index.versions
							: [];
						/*
						 * 字段映射：面板的「功能项」左栏是按用例的 scenario 聚合的，
						 * 而 Skill 约定里用例带的是 featureId。这里按 features[] 查表补上
						 * scenario = 功能项名称，不改动原始 featureId（报告还要用）。
						 */
						var featureName = Object.create(null);
						features.forEach(function (item) {
							if (item && typeof item.id === "string") featureName[item.id] = item.name || item.id;
						});
						/*
						 * ★ 把「生成测试步骤」产出的步骤合并进用例。
						 *
						 * 关键：用例存在 case-versions/<V>/cases.json，步骤存在
						 * step-versions/<V>/steps.json，是两份文件。面板的步骤页是按
						 * record.steps 渲染的，不合并的话步骤页永远是空的 —— 这正是
						 * 「产物里有 60 行步骤、面板却不显示」的原因。
						 *
						 * 匹配依据是 caseId（不是数组下标：用户可能在用例页删过/调过顺序）。
						 */
						var stepByCaseId = Object.create(null);
						var stepCases = (stepKind.data && Array.isArray(stepKind.data.cases)) ? stepKind.data.cases : [];
						stepCases.forEach(function (item) {
							if (!item || typeof item.caseId !== "string") return;
							stepByCaseId[item.caseId] = Array.isArray(item.steps) ? item.steps : [];
						});
						/*
						 * ★ 兼容「扁平 steps」写法：按 caseId 自己分组。
						 *
						 * steps.json 有两种形态，后端 integration-store 两种都读下来了：
						 *   A 分组式（契约形态）{ cases: [{ caseId, steps: [...] }, ...] }
						 *   B 扁平式           { steps: [{ caseId, no, ... }, ...] } 或直接是数组
						 *
						 * 面板原先**只读 A**：B 时 stepCases 为空 → stepByCaseId 全空 →
						 * 测试步骤页整片空白，但磁盘上明明有步骤。
						 * 用户 2026-11-23 踩到的就是这个：模型写成扁平数组，界面什么都不显示。
						 *
						 * 这里在 A 没给出内容时，把后端的 data.steps 按 caseId 归组兜底。
						 * 注意只补**空**的键：A 里显式给了空 steps 的用例，不该被扁平数据覆盖。
						 */
						var flatSteps = (stepKind.data && Array.isArray(stepKind.data.steps))
							? stepKind.data.steps
							: [];
						if (flatSteps.length > 0) {
							var grouped = Object.create(null);
							flatSteps.forEach(function (step) {
								if (!step || typeof step.caseId !== "string") return;
								if (!grouped[step.caseId]) grouped[step.caseId] = [];
								grouped[step.caseId].push(step);
							});
							Object.keys(grouped).forEach(function (caseId) {
								if (stepByCaseId[caseId] === undefined) {
									stepByCaseId[caseId] = grouped[caseId];
								}
							});
						}
						/*
						 * ★ 把执行记录合并进用例（子表 + 名称后的角标都靠它）。
						 *
						 * exec-records.json 的结构是 { 步骤版本: { caseId: [记录...] } }，
						 * 记录只有 runId/at/result/durationMs 四个字段（详细结果在
						 * runs/<runId>/ 里）。少合这一步，子表就永远是空的、角标永远是 0 ——
						 * 即使磁盘上已经跑过。
						 */
						var execGroups = (stepKind.data && stepKind.data.execRecords && typeof stepKind.data.execRecords === "object")
							? stepKind.data.execRecords
							: {};
						// 优先取「当前步骤版本」那一组；没有就摊平所有组（单步执行可能落在别的版本下）。
						var execByCaseId = Object.create(null);
						var activeStepVersion = stepKind.activeVersion || '';
						(function () {
							var pick = execGroups[activeStepVersion];
							if (!pick || typeof pick !== "object") {
								pick = {};
								Object.keys(execGroups).forEach(function (key) {
									var group = execGroups[key];
									if (!group || typeof group !== "object") return;
									Object.keys(group).forEach(function (caseId) {
										var arr = Array.isArray(group[caseId]) ? group[caseId] : [];
										pick[caseId] = (pick[caseId] || []).concat(arr);
									});
								});
							}
							Object.keys(pick).forEach(function (caseId) {
								var arr = Array.isArray(pick[caseId]) ? pick[caseId] : [];
								// 子表按时间倒序（最新在最前），与面板取 records[0] 显示最新结果一致。
								execByCaseId[caseId] = arr.slice().sort(function (a, b) {
									return String(b && b.at || '').localeCompare(String(a && a.at || ''));
								});
							});
						})();
						var list = normalizeCaseList(rawList, featureName, stepByCaseId, execByCaseId);
						/*
						 * ★ 步骤孤岛检测：steps.json 里有步骤，但一条都挂不到用例上。
						 *
						 * 最典型的成因是 caseId 前缀与步骤版本对不上：
						 *   用例 V0_0_1-IT-001，步骤却写成 V0_0_01-IT-001 / V0.0.1-IT-001 / V1-IT-001
						 * 面板按 caseId 精确匹配，对不上就是「步骤页该行『输入步骤』『预期结果』
						 * 两列全是破折号」，而且**不报任何错** —— 用户只会以为是模型没生成步骤，
						 * 回头重新生成一遍，问题照样存在。
						 *
						 * 这里把「有步骤但一条都对不上」算出来，交给步骤页顶部提示，
						 * 让用户一眼看到真实原因（而不是去猜）。
						 */
						var orphanStepCount = 0;
						var orphanSample = [];
						var caseIds = new Set();
						(Array.isArray(rawList) ? rawList : []).forEach(function (item) {
							if (item && typeof item.caseId === "string" && item.caseId !== "") caseIds.add(item.caseId);
						});
						Object.keys(stepByCaseId).forEach(function (caseId) {
							var arr = Array.isArray(stepByCaseId[caseId]) ? stepByCaseId[caseId] : [];
							if (arr.length === 0) return;
							if (caseIds.has(caseId)) return;
							orphanStepCount += arr.length;
							if (orphanSample.length < 3) orphanSample.push(caseId);
						});
						setStepOrphan({ count: orphanStepCount, sample: orphanSample });
						setRemote({ kinds: kinds, features: features });
						/*
						 * 显式功能项清单进状态：侧栏的「新建功能项」要往这份清单里加，
						 * 清单本身也要能写回 features.json。取 name，忽略没有 name 的脏数据。
						 */
						setFeatureNames(features
							.map(function (item) { return item && typeof item.name === "string" ? item.name.trim() : ""; })
							.filter(function (name) { return name !== ""; }));
						setSeed(function () {
							/*
							 * 后端没有版本时保留一个空 V0.0.1，与 buildIntegrationSeed 的
							 * 空态一致：面板需要「当前版本」才能渲染。
							 */
							var names = versions.length > 0
								? versions.map(function (item) { return item.name; })
								: ["V0.0.1"];
							/*
							 * ★ 所有版本都灌上真实内容，不能只填 activeVersion。
							 *
							 * 原来这里是 `byVersion[name] = name === activeVersion ? list : []`，
							 * 非当前版本一律给空数组。于是用户「生成了 V0.0.2，面板里切过去是
							 * 空的，得回对话框让模型切版本」—— 切版本这种日常操作被迫依赖对话。
							 *
							 * 现在后端 readAll 会把每个版本的内容一起带上来（caseKind.byVersion），
							 * 这里逐个归一化后填进去；某一版没有内容时才退到空数组。
							 */
							var allByVersion = caseKind.byVersion && typeof caseKind.byVersion === "object"
								? caseKind.byVersion
								: {};
							var byVersion = {};
							names.forEach(function (name) {
								var raw = Array.isArray(allByVersion[name] && allByVersion[name].cases)
									? allByVersion[name].cases
									: (name === caseKind.activeVersion ? rawList : null);
								if (raw === null) {
									// 后端没给这一版的内容：保持空，等切过去时再按需加载。
									byVersion[name] = [];
									return;
								}
								byVersion[name] = normalizeCaseList(raw, featureName, stepByCaseId, execByCaseId);
							});
							if (byVersion[caseKind.activeVersion] === undefined) {
								byVersion[caseKind.activeVersion || names[0]] = list;
							}
							return {
								versions: versions.length > 0
									? versions
									: [{ name: "V0.0.1", at: new Date().toISOString(), status: "current" }],
								activeVersion: caseKind.activeVersion || names[0],
								byVersion: byVersion,
								features: features
							};
						});
						if (!keepVersion) {
							setVersion(caseKind.activeVersion || "V0.0.1");
						}
						// 报告版本：始终对齐后端（新建版本后刷新就能看到新的）
						setReportVersions(reportVersionList);
						setReportVersion(function (previous) {
							// 后端给了当前版本就用它；否则保持用户已选的那一个
							if (typeof reportKind.activeVersion === "string" && reportKind.activeVersion !== "") {
								return reportKind.activeVersion;
							}
							return previous !== "" ? previous : (reportVersionList[0] && reportVersionList[0].name ? reportVersionList[0].name : "");
						});
						setLoadState("ready");
						/*
						 * 刷新成功要给出可感知的反馈。
						 *
						 * 用户反馈「点刷新没反应」：数据没变化时界面本来就一样，
						 * 不给一句话就分不清是「刷新了但没变」还是「点了没生效」。
						 * 这里只在**手动刷新**（keepVersion=true）时提示，首次加载不打扰。
						 */
						if (keepVersion === true) {
							var total = Array.isArray(list) ? list.length : 0;
							setNotice("已刷新：当前版本 " + (caseKind.activeVersion || "V0.0.1") + " 共 " + total + " 条用例。");
						}
					})
					.catch(function (error) {
						setLoadError(error && error.message ? error.message : String(error));
						setLoadState("error");
						if (keepVersion === true) {
							setNotice("刷新失败：" + (error && error.message ? error.message : String(error)));
						}
					});
			}

			// 挂载时拉一次；切回集成页签时如果还没成功过也再拉一次。
			// 注入了 initialSeed（测试场景）就不同步 fetch，直接用注入的数据。
			useEffect(function () {
				if (!active) return undefined;
				if (props.initialSeed) { setLoadState("ready"); return undefined; }
				if (loadState === "idle") loadIntegration(false);
				return undefined;
			}, [active]);

			/**
			 * 把一份 cases.json 的原始数组归一化成面板内部的行结构。
			 *
			 * 必须做的事（漏一件界面就出问题）：
			 *   1. 补 id          —— 文件里没有，但展开/勾选/key 全靠它
			 *   2. 补 scenario    —— 由 featureId 查功能项名
			 *   3. 合并 steps / records —— 从 step 版本、执行记录里按 caseId 关联
			 *   4. 推导 status / lastRunAt —— 看板与报告都读这两个字段
			 *
			 * 抽成函数是因为「当前版本」和「其他版本」都要走同一套归一化，
			 * 两处各写一遍必然有一处漏改（原来其他版本直接给空数组，就是这个毛病）。
			 */
			function normalizeCaseList(rawList, featureName, stepByCaseId, execByCaseId) {
				return (Array.isArray(rawList) ? rawList : []).map(function (item, itemIndex) {
					if (!item || typeof item !== "object") return item;
					var next = Object.assign({}, item);
					/*
					 * ★ 补 id：cases.json 里没有这个字段，但面板内部处处按 id 认行
					 *   （展开子表、勾选、React key）。不补的话 record.id 恒为
					 *   undefined，步骤页点一次展开就把 undefined 塞进数组，
					 *   于是 **所有行一起展开**（用户 2026-11-20 报的现象）。
					 *
					 * 用 caseId 兜底最稳：它在同一版本内唯一，且不依赖文件里有没有 id。
					 * 文件里真写了 id 就用文件里的（兼容 Skill 将来的约定）。
					 */
					if (typeof next.id !== "string" || next.id === "") {
						next.id = typeof next.caseId === "string" && next.caseId !== ""
							? next.caseId
							: "case-" + String(itemIndex);
					}
					if (!next.scenario && next.featureId && featureName[next.featureId]) {
						next.scenario = featureName[next.featureId];
					}
					var own = Array.isArray(next.steps) ? next.steps : [];
					if (own.length === 0 && next.caseId && stepByCaseId[next.caseId]) {
						next.steps = stepByCaseId[next.caseId];
					}
					var ownRuns = Array.isArray(next.records) ? next.records : [];
					if (ownRuns.length === 0 && next.caseId && execByCaseId[next.caseId]) {
						next.records = execByCaseId[next.caseId];
					}
					/*
					 * ★ 由执行记录推导 status / lastRunAt。
					 *
					 * cases.json 里**没有**这两个字段（用例本身是静态定义），
					 * 面板的看板、报告页、总体报告统计都读 record.status。
					 * 不在这里补，所有用例都会显示「未执行」、通过数恒为 0。
					 *
					 * 取最新一条记录（records 已按时间倒序）：
					 *   result pass → status "pass"
					 *   result 其它 → status "fail"（error 也算没通过）
					 *   没有记录    → status "none"
					 */
					var runs = Array.isArray(next.records) ? next.records : [];
					if (runs.length > 0) {
						var latestRun = runs[0];
						next.status = latestRun.result === "pass" ? "pass" : "fail";
						next.lastRunAt = latestRun.at || "";
					} else if (!next.status) {
						next.status = "none";
						next.lastRunAt = "";
					}
					return next;
				});
			}

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

			/*
			 * 「按状态筛选」只在测试步骤页存在，所以这里拆成两个列表：
			 *   baseCurrent —— 搜索 + 功能项 + 类型，三页共用
			 *   current     —— 再叠加执行结果筛选，只给测试步骤页用
			 * 用例页和报告页拿 baseCurrent，筛选不会漏到那两页去。
			 */
			function filteredBase() {
				return itFilterRecords(records, { query: query, scenario: scenario, type: type, status: status });
			}

			function filtered() {
				return itFilterRecords(records, { query: query, scenario: scenario, type: type, status: status, results: resultFilter });
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

			/*
			 * 拖拽排序（仅测试用例页）。
			 *
			 * 做法：手柄按下时记下起始下标；鼠标进入别的行时把两行真实换位；
			 * 松开（全局 mouseup）结束。全程手写，不依赖任何拖拽库。
			 *
			 * 换位操作作用于「过滤后的完整列表」而不是当前页的切片：
			 * 这样跨页拖动也能落到正确位置，序号自然跟着重排。
			 * 换位后把结果写回当前版本的数据（patchRecords）。
			 */
			function visibleOffset() {
				var pageCount = Math.max(1, Math.ceil(filtered().length / pageSize));
				var current = Math.min(Math.max(1, casePage), pageCount);
				return (current - 1) * pageSize;
			}

			function beginDrag(index) {
				setDragFrom(index);
				setDragIndex(index);
			}

			function endDrag() {
				setDragFrom(null);
				setDragIndex(null);
			}

			/** 把列表中 from 位置的行移动到 to 位置（都在「过滤后列表」坐标系里）。 */
			function moveRecord(from, to) {
				if (from === to || from === null || to === null) return;
				var base = visibleOffset();
				var list = filtered();
				var a = base + from;
				var b = base + to;
				if (a < 0 || b < 0 || a >= list.length || b >= list.length) return;
				var movedId = list[a].id;
				var targetId = list[b].id;
				// 在完整 records 里按 id 交换两者的位置，其余不动。
				var full = records.slice();
				var ia = full.findIndex(function (r) { return r.id === movedId; });
				var ib = full.findIndex(function (r) { return r.id === targetId; });
				if (ia === -1 || ib === -1) return;
				var item = full.splice(ia, 1)[0];
				full.splice(ib, 0, item);
				patchRecords(full);
				setDragFrom(b);
				setDragIndex(b);
			}

			// 拖动过程中松手要结束，鼠标可能已经离开表格，所以监听挂在 document 上。
			useEffect(function () {
				if (dragFrom === null) return undefined;
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined;
				function onUp() { endDrag(); }
				document.addEventListener("mouseup", onUp);
				return function () { document.removeEventListener("mouseup", onUp); };
			}, [dragFrom]);

			function refresh() {
				/*
				 * 刷新时把所有下拉、以及报告页的功能项分组都收起来。
				 * 用户点刷新就是想看最新的完整列表，留着半开的菜单/分组只会挡视线。
				 */
				setSwitchOpen(false);
				setVersionOpen(false);
				setResultOpen(false);
				setExpandedGroups([]);
				/*
				 * 真正重读磁盘：重拉集成测试数据层，而不是只提示「演示数据」。
				 *
				 * 先给一句「正在刷新」——用户点完立刻有反馈，不会以为按钮坏了。
				 * 完成/失败的具体结果由 loadIntegration 自己回填 notice。
				 */
				setNotice("正在刷新…");
				loadIntegration(true);
			}
			/**
			 * 把一段话术填进对话输入框（用户审阅后自己点发送）。
			 *
			 * 复用单元测试的 prefillDraft：它处理了「输入框正在发送中」的闸门、
			 * 官方预填接口不可用时的降级，并且失败会给一句能读懂的原因。
			 * 这里只负责「把话说清楚」+ 把结果告诉用户，不自己发消息。
			 */
			function prefillToComposer(text, okHint) {
				var outcome = prefillDraft(sessionId, text);
				if (outcome && outcome.ok) {
					setNotice(okHint || outcome.message);
					return true;
				}
				setNotice((outcome && outcome.message) || "没能把话术填进输入框。");
				return false;
			}

			/** 用例清单（喂给话术）：按功能项分组，逐条列出 caseId + 标题 + 类型。 */
			function caseLinesForPrompt() {
				var groups = Object.create(null);
				var order = [];
				records.forEach(function (item) {
					var name = itScenarioOf(item);
					if (!groups[name]) { groups[name] = []; order.push(name); }
					groups[name].push(item);
				});
				var lines = [];
				order.forEach(function (name) {
					lines.push("");
					lines.push("### 功能项：" + name + "（" + groups[name].length + " 条）");
					groups[name].forEach(function (item) {
						var typeLabel = (IT_TYPES[item.type] && IT_TYPES[item.type].label) || item.type || "—";
						lines.push("- " + (item.caseId || item.id) + "｜" + (item.title || "") + "｜" + typeLabel);
						if (item.description) lines.push("  说明：" + item.description);
					});
				});
				return lines.join("\n");
			}

			/**
			 * 「生成测试步骤」按钮：把完整话术填进对话框，用户审阅后发送。
			 *
			 * 话术必须自带足够上下文：用例清单、步骤怎么写、代码不外露、快照与映射规则。
			 * 否则模型要么漏用例，要么写出界面能看见的代码。
			 */
			function generateSteps() {
				if (records.length === 0) {
					setNotice("还没有测试用例，先在用例页生成或手动新增，再点「生成测试步骤」。");
					return;
				}
				var text = [
					"按集成测试 Skill 为下面这些用例生成测试步骤。",
					"",
					"本轮用例版本：" + version + "（共 " + records.length + " 条用例）",
					"来源用例：case-versions/" + version.replace(/\./g, "_") + "/cases.json",
					"",
					"## 要处理的用例（按功能项分组）",
					caseLinesForPrompt(),
					"",
					"## 生成要求",
					"1. 为**每条用例的每个步骤**生成步骤三元组：action（动作）/ operation（输入步骤）/ expected（预期结果）。",
					"2. 同时产出一一对应的测试代码（模型内部产物）：一个步骤 = 一个测试函数，",
					"   每个步骤函数**自带前置准备**，保证单独执行第 N 步也能跑通。",
					"3. 步骤写到 integration/step-versions/<新版本>/steps.json，",
					"   用例快照写到同目录 cases.snapshot.json（生成步骤时冻结，执行只认快照）。",
					"4. 代码写到 integration/tests/。",
					"",
					"## 硬性约束",
					"- **测试代码是内部产物**：面板、API、报告里只出现步骤，不出现测试函数名、代码片段、codeRef。",
					"- 步骤格式：{ no, action, operation, expected, target, channel }。",
					"  channel 说明这一步走哪条通道：code=产品源码白盒编入，service=启停被测服务，runner=调工装测试函数（主力），cmd=构建门/环境检查。",
					"- 本次新建一个步骤版本，**不要覆盖已有版本**；旧版本保留。",
					"- 步骤版本要记 sourceCaseVersion = " + version + "。",
					"- 强度测试不做。",
					"",
					"生成后**停下来等我审查步骤**，不要自己接着执行测试。"
				].join("\n");
				prefillToComposer(text, "已把「生成测试步骤」的话术填进对话输入框，审阅后按回车发送。");
			}

			/**
			 * 总体报告的「导出」：把**整项目那份** docx 另存到用户选的目录。
			 *
			 * 与单条报告的区别：
			 *   · 单条报告 → reports/<runId>/cases/…docx，只含 4.1.1 那张表
			 *   · 总体报告 → reports/<runId>/…整项目….docx，按配置项测试模板整体排版
			 *
			 * 所以这里要挑 kind === "overall" 的那份。先找最近一次一键执行的 runId。
			 */
			function exportOverallReport(shown) {
				var list = Array.isArray(shown) ? shown : [];
				var latest = null;
				list.forEach(function (record) {
					(Array.isArray(record.records) ? record.records : []).forEach(function (run) {
						if (!run || run.source !== "all") return;
						if (latest === null || String(run.at || "") > String(latest.at || "")) latest = run;
					});
				});
				if (latest === null) {
					setNotice("还没有一键执行的记录，没有总体报告可导出。先在步骤页点「一键执行」。");
					return;
				}
				var runId = String(latest.runId || "");
				if (runId === "") { setNotice("这次执行没有 runId，无法定位总体报告。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				setNotice("正在查找总体报告…");
				fetchReportOf(sessionId, runId).then(function (detail) {
					var files = (detail && Array.isArray(detail.files)) ? detail.files.filter(function (file) {
						return file && typeof file.name === "string" && /\.docx$/i.test(file.name) && file.path;
					}) : [];
					var overall = files.filter(function (file) {
						return file.kind === "overall" || file.name.indexOf("整项目") !== -1;
					})[0];
					if (!overall) {
						setNotice("这次执行还没有生成总体报告（runId " + runId + "）。让模型按配置项测试模板出一份整项目报告。");
						return;
					}
					exportReportsTo([overall.path], 1);
				}).catch(function (failure) {
					setNotice("读取总体报告失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			/**
			 * 打开「项目总体报告」——直接开 tab 页展示那份 Word。
			 *
			 * 用户要求的是 tab 页，不是弹窗里的 HTML 汇总。真正的总体报告
			 * （`reports/<runId>/…整项目….docx`）按配置项测试模板整体排版、
			 * 含所有用例步骤表的汇总，只有打开 docx 才能看到完整内容。
			 *
			 * @param shown 纳入范围的用例（弹窗里排除过之后的）；不传就用全部。
			 */
			function openOverallReport(shown) {
				var list = Array.isArray(shown) ? shown : [];
				// 取最近一次一键执行的 runId（records 已按时间倒序）。
				var latest = null;
				list.forEach(function (record) {
					(Array.isArray(record.records) ? record.records : []).forEach(function (run) {
						if (!run || run.source !== "all") return;
						if (latest === null || String(run.at || "") > String(latest.at || "")) latest = run;
					});
				});
				if (latest === null) {
					setNotice("还没有一键执行的记录，没有总体报告可导出。先在步骤页点「一键执行」。");
					return;
				}
				var runId = String(latest.runId || "");
				if (runId === "") { setNotice("这次执行没有 runId，无法定位总体报告。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				setNotice("正在查找总体报告…");
				fetchReportOf(sessionId, runId).then(function (detail) {
					var files = (detail && Array.isArray(detail.files)) ? detail.files.filter(function (file) {
						return file && typeof file.name === "string" && /\.docx$/i.test(file.name) && file.path;
					}) : [];
					// 总体报告：kind 为 overall，或文件名带「整项目」。
					var overall = files.filter(function (file) {
						return file.kind === "overall" || file.name.indexOf("整项目") !== -1;
					})[0];
					if (!overall) {
						setNotice("这次执行还没有生成总体报告（runId " + runId + "）。让模型按配置项测试模板出一份整项目报告。");
						return;
					}
					openReportFile(overall.path, sessionId, function () { setNotice("已打开项目总体报告。"); });
				}).catch(function (failure) {
					setNotice("读取总体报告失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			/**
			 * 报告页的「查看 / 导出报告」：打开这条用例**最新一次**执行的报告。
			 *
			 * 报告页是按用例看结果的，用户点的是「这条用例的报告」而不是某个 runId，
			 * 所以取子表里最新那条记录（records 已按时间倒序）的 runId。
			 */
			function viewLatestReportOfCase(record) {
				/*
				 * 报告页只认**一键执行**的记录（单步执行的报告不进报告页）。
				 * 所以这里筛出 source === "all" 的，取最新一条。
				 */
				var runs = (Array.isArray(record && record.records) ? record.records : []).filter(function (run) {
					return run && run.source === "all";
				});
				if (runs.length === 0) {
					setNotice("这条用例还没有一键执行的记录，先在步骤页点「一键执行」。");
					return;
				}
				// 传 caseId：同一个 runId 目录下有多份报告，要挑这条用例那一份。
				viewRunReport(runs[0], record.caseId);
			}

			/**
			 * 子表里点「查看报告」：按该次执行的 runId 打开 Word 报告。
			 *
			 * ★ 注意：这里**只借用了「按 runId 定位文件」这一条通用约定**，
			 *   报告的内容、排版、生成脚本全部走集成测试自己那一套
			 *   （`integration_report.py` 的 `build_single_step` / `build_full`），
			 *   与单元测试的 `bridge.py` + `report-tool/` **没有任何关系**。
			 *
			 *   两套报告在数据形态上就不同，不能互相套用：
			 *     · 单元测试：result.json 有 `tests[]`、`scope`、覆盖率、复杂度
			 *     · 集成测试：result.json 有 `steps[]`、`stepVersion`、`caseVersion`，
			 *       没有 `tests`、没有 `scope`、没有覆盖率
			 *   所以单元测试的报告填表逻辑套到集成数据上会直接取不到值。
			 */
			function viewRunReport(run, caseId) {
				var runId = run && run.runId ? String(run.runId) : "";
				if (runId === "") { setNotice("这条执行记录没有 runId，无法定位报告。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				setNotice("正在查找这次执行的报告…");
				fetchReportOf(sessionId, runId).then(function (detail) {
					// 传 caseId：一键执行的目录里有多份报告，要挑这条用例那一份（只含 4.1.1 那张表）。
					var doc = docxFor(detail, caseId);
					if (!doc) {
						setNotice("这次执行还没有生成 Word 报告（runId " + runId + "）。跑完执行后让模型生成报告，或点「一键执行」出总体报告。");
						return;
					}
					openReportFile(doc.path, sessionId, function () { setNotice("已打开报告。"); });
				}).catch(function (failure) {
					setNotice("读取报告失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			/**
			 * 报告页的「导出报告」图标：把这条用例**最新一次一键执行**的报告另存到用户选的目录。
			 *
			 * 与「查看」的区别：查看是开在右侧栏预览；导出是复制一份 docx 出去。
			 * 报告页只认一键执行的记录（单步报告不进报告页），所以筛 source === "all"。
			 */
			function exportLatestReportOfCase(record) {
				var runs = (Array.isArray(record && record.records) ? record.records : []).filter(function (run) {
					return run && run.source === "all";
				});
				if (runs.length === 0) {
					setNotice("这条用例还没有一键执行的记录，先在步骤页点「一键执行」。");
					return;
				}
				exportRunReport(runs[0], record.caseId);
			}

			/**
			 * 报告页的「导出已选报告」：多选态下把勾中的用例各导一份。
			 *
			 * selected 存的是 record.id（用例），报告页按「用例」概念勾选，
			 * 与步骤页按「执行记录」勾选不同 —— 两页的语义本来就不同，不能共用一套键。
			 */
			function exportPickedCases(ids) {
				var list = Array.isArray(ids) ? ids : [];
				if (list.length === 0) { setNotice("还没有勾选任何报告，先勾上再导出。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				var targets = [];
				list.forEach(function (id) {
					var record = records.filter(function (r) { return r.id === id; })[0];
					if (!record) return;
					var runs = (Array.isArray(record.records) ? record.records : []).filter(function (run) {
						return run && run.source === "all";
					});
					if (runs.length === 0) return;
					targets.push({ run: runs[0], caseId: record.caseId });
				});
				if (targets.length === 0) {
					setNotice("已选 " + list.length + " 条用例都还没有一键执行的报告，无可导出。");
					return;
				}
				exportRuns(targets, list.length);
			}

			/**
			 * 弹原生文件夹选择框，返回用户选的绝对路径（取消时给空串）。
			 *
			 * 走宿主不是为了绕远路：浏览器侧拿不到绝对路径，导出必须知道往哪写。
			 * 这个请求要等用户操作对话框，给 5 分钟预算，不能用默认的 8 秒。
			 */
			var PICK_DIR_TIMEOUT_MS = 5 * 60 * 1000;

			function pickExportDir() {
				return callApi("/data-panel/export/pick-dir", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ sessionId: sessionId, cwd: cwdOf(sessionId) }),
				}, PICK_DIR_TIMEOUT_MS).then(function (data) {
					if (data && data.canceled === true) return "";
					return data && typeof data.dir === "string" ? data.dir : "";
				});
			}

			/**
			 * 把一批报告复制到用户选的目录，成功后汇总提示。
			 *
			 * 只支持 docx：本次需求明确如此，PDF 是查看时按需生成的载体，不作为导出格式。
			 * 「不覆盖已有文件」由宿主保证（同名自动加 ` (1)` 后缀），前端只负责报结果。
			 *
			 * ★ 一份 → 复制单份；多份 → 宿主合并成**一份**汇总 Word（一张表一页）。
			 *   合并是后端做的，前端只看返回的 merged 标记来给对应文案。
			 */
			function exportReportsTo(paths, totalWanted) {
				var list = (Array.isArray(paths) ? paths : []).filter(function (p) {
					return typeof p === "string" && p !== "";
				});
				if (list.length === 0) {
					setNotice("没有找到可导出的 docx 报告。");
					return Promise.resolve();
				}
				setNotice("请选择导出到的文件夹…");
				return pickExportDir().then(function (dir) {
					if (dir === "") {
						setNotice("已取消导出。");
						return null;
					}
					setNotice(list.length > 1 ? ("正在合并 " + list.length + " 份报告…") : "正在导出报告…");
					return callApi("/data-panel/export", {
						method: "POST",
						headers: { "content-type": "application/json", accept: "application/json" },
						body: JSON.stringify({ sessionId: sessionId, cwd: cwdOf(sessionId), dir: dir, paths: list }),
					}, 120000).then(function (data) {
						var exported = Array.isArray(data && data.exported) ? data.exported : [];
						var skipped = Array.isArray(data && data.skipped) ? data.skipped : [];
						if (exported.length === 0) {
							setNotice("导出失败：" + ((data && data.error) || skipped[0] && skipped[0].reason || "没有成功导出任何报告"));
							return null;
						}
						var text;
						if (data && data.merged === true) {
							text = "已合并 " + (data.count || list.length) + " 份报告为一份，存到 " + (data.dir || dir);
						} else {
							var wanted = typeof totalWanted === "number" ? totalWanted : list.length;
							text = "已导出 " + exported.length + " 份到 " + (data.dir || dir);
							if (wanted > exported.length) text += "（共选 " + wanted + " 份，" + (wanted - exported.length) + " 份没有可用报告，已跳过）";
						}
						if (data && typeof data.warning === "string" && data.warning !== "") text += "；" + data.warning;
						if (skipped.length > 0) text += "；" + skipped.length + " 份失败：" + (skipped[0].reason || "未知原因");
						setNotice(text);
						return data;
					});
				}).catch(function (failure) {
					setNotice("导出失败：" + (failure && failure.message ? failure.message : String(failure)));
					return null;
				});
			}

			/**
			 * 把一批执行记录的报告导出到同一个目录。
			 *
			 * 先逐条查出 docx 路径（每份报告的 runId 不同，要分别问宿主），
			 * 再一次性交给导出接口 —— 只弹一次文件夹框，用户不用为每份报告点一遍。
			 */
			function exportRuns(targets, totalWanted) {
				var list = Array.isArray(targets) ? targets : [];
				if (list.length === 0) { setNotice("没有可导出的执行记录。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				setNotice("正在查找 " + list.length + " 份报告…");
				Promise.all(list.map(function (target) {
					var runId = target && target.run && target.run.runId ? String(target.run.runId) : "";
					if (runId === "") return Promise.resolve(null);
					return fetchReportOf(sessionId, runId).then(function (detail) {
						var doc = docxFor(detail, target.caseId);
						return doc && doc.path ? doc.path : null;
					}).catch(function () { return null; });
				})).then(function (paths) {
					var found = paths.filter(function (p) { return typeof p === "string" && p !== ""; });
					if (found.length === 0) {
						setNotice("已选的执行记录都还没有生成 Word 报告，无法导出。");
						return null;
					}
					return exportReportsTo(found, typeof totalWanted === "number" ? totalWanted : list.length);
				});
			}

			/**
			 * 批量导出「已选执行记录」的报告（步骤页）。
			 *
			 * 入参是勾选键数组，每个键 `用例id|runId` 对应一份报告。
			 * 单独提供 exportRunReport 会误以为按用例导出，这里按记录逐条走。
			 */
			function exportPickedRuns(keys) {
				var list = Array.isArray(keys) ? keys : [];
				if (list.length === 0) { setNotice("还没有勾选任何执行记录，先勾上再导出。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }

				var targets = [];
				list.forEach(function (key) {
					var parts = String(key).split("|");
					var recordId = parts[0];
					var runId = parts[1];
					var record = records.filter(function (r) { return r.id === recordId; })[0];
					if (!record || !runId) return;
					var run = (Array.isArray(record.records) ? record.records : [])
						.filter(function (r) { return r.runId === runId; })[0];
					if (run) targets.push({ run: run, caseId: record.caseId });
				});

				if (targets.length === 0) {
					setNotice("已选 " + list.length + " 条执行记录都找不到对应数据，可能已被删除。");
					return;
				}
				// 一次导出全部：只弹一次文件夹框，不是每份报告弹一遍。
				exportRuns(targets, list.length);
			}

			/** 单条导出：查一条执行的报告，然后交给统一的导出流程。 */
			function exportRunReport(run, caseId) {
				var runId = run && run.runId ? String(run.runId) : "";
				if (runId === "") { setNotice("这条执行记录没有 runId，无法导出报告。"); return; }
				if (sessionId === "") { setNotice("当前会话还没就绪，切到对话再点一次。"); return; }
				setNotice("正在查找报告…");
				fetchReportOf(sessionId, runId).then(function (detail) {
					var doc = docxFor(detail, caseId);
					if (!doc || !doc.path) {
						setNotice("这次执行还没有生成 Word 报告，无法导出（runId " + runId + "）。");
						return;
					}
					exportReportsTo([doc.path], 1);
				}).catch(function (failure) {
					setNotice("导出失败：" + (failure && failure.message ? failure.message : String(failure)));
				});
			}

			/**
			 * 删除某次执行记录（只删这条记录，不动 runs/ 下的文件与用例）。
			 *
			 * 写回 exec-records.json：把该 caseId 数组里匹配 runId 的那条去掉。
			 */
			function removeRunRecord(record, run) {
				var runId = run && run.runId ? String(run.runId) : "";
				if (runId === "") return;
				var left = (Array.isArray(record.records) ? record.records : []).filter(function (item) {
					return String(item && item.runId) !== runId;
				});
				var updated = records.map(function (item) {
					return item.id === record.id ? Object.assign({}, item, { records: left }) : item;
				});
				patchRecords(updated);
				persistExecRecords(updated);
				setNotice("已删除这条执行记录。");
			}

			/** 把执行记录写回磁盘（exec-records.json），结构是 { 步骤版本: { caseId: [记录] } }。 */
			function persistExecRecords(list) {
				if (typeof fetch !== "function" || sessionId === "" || loadState !== "ready") return;
				var group = {};
				(list || []).forEach(function (item) {
					if (!item || !item.caseId) return;
					var arr = Array.isArray(item.records) ? item.records : [];
					if (arr.length > 0) group[item.caseId] = arr;
				});
				var payload = {};
				payload[version] = group;
				fetch("/data-panel/integration", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ sessionId: sessionId, kind: "step", op: "saveVersion", version: version, execRecords: payload })
				}).then(function (response) {
					return response.json().catch(function () { return {}; }).then(function (data) {
						if (!response.ok || data.ok === false) throw new Error((data && data.error) || ("保存失败（HTTP " + response.status + "）"));
						return data;
					});
				}).catch(function (error) {
					setNotice("执行记录写回磁盘失败：" + (error && error.message ? error.message : String(error)) + "。界面上的改动还在。");
				});
			}

			/**
			 * 报告生成器路径的提示文案。
			 *
			 * 宿主已经在 `/data-panel/integration` 的响应里回传
			 * `reportScript`（按插件包自身位置解析，与仓库放在哪个盘无关）。
			 * 这里只做「有就用、没有就退化」的处理，**绝不写死绝对路径** ——
			 * 写死就意味着换台机器/换个 clone 目录，报告直接生成不出来。
			 */
			function generatorPathNote() {
				if (typeof reportScript === "string" && reportScript !== "") {
					return "`" + reportScript + "`";
				}
				return "集成测试 Skill 里给出的报告生成器路径（按插件包 assets/ 或仓库 integrationReport/ 定位）";
			}

			/**
			 * 单条用例的「执行」按钮：把这一步的完整信息填进对话框。
			 *
			 * 与「一键执行」的区别只在范围：这里只跑用户点的那一条用例的步骤，
			 * 结果留在步骤页该行下面的子表里，**不产生报告版本、不进报告页**。
			 * 话术要把这条用例的全部步骤摊开，模型才知道每一步该做什么、期望什么。
			 */
			function runStepPrompt(record) {
				if (!record) return;
				var steps = Array.isArray(record.steps) ? record.steps : [];
				if (steps.length === 0) {
					setNotice("这条用例还没有测试步骤，先回用例页点「生成测试步骤」。");
					return;
				}
				var typeLabel = (IT_TYPES[record.type] && IT_TYPES[record.type].label) || record.type || "—";
				var promptSteps = steps.map(function (item) {
					var channel = item.channel === "code" ? "白盒编入（code）" : (item.channel === "service" ? "启停服务（service）" : (item.channel === "runner" ? "测试函数（runner）" : (item.channel === "cmd" ? "命令步骤（cmd）" : (item.channel === "cua" || item.channel === "uia" ? "界面操作（历史，已停用）" : "未标注"))));
					return [
						"  第 " + (item.no || 0) + " 步",
						"    动作：" + (item.action || "—"),
						"    输入步骤：" + (item.operation || "—"),
						"    预期结果：" + (item.expected || "—"),
						"    通道：" + channel
					].join("\n");
				}).join("\n");

				var text = [
					"按集成测试 Skill 单步执行下面这条用例的测试步骤。",
					"",
					"## 用例信息",
					"- 用例标识：" + (record.caseId || "—"),
					"- 用例名称：" + (record.title || "—"),
					"- 测试类型：" + typeLabel,
					"- 功能项：" + itScenarioOf(record),
					"- 步骤版本：" + version,
					"- 用例说明：" + (record.description || "—"),
					"- 前置条件：" + (record.precondition || "—"),
					"- 预期结果：" + (record.expectedResult || "—"),
					"",
					"## 要执行的步骤（共 " + steps.length + " 步）",
					promptSteps,
					"",
					"## 执行要求",
					"1. 严格按上面列出的步骤执行，**只认步骤版本冻结的用例快照**，不读当前用例版本。",
					"2. 按步骤的 channel 执行：code=把产品源码编进测试做白盒验证，service=启停被测服务，runner=调工装测试函数走 run_tests.py，cmd=跑构建门/环境检查。自己直接执行，不要回来问我。",
					"3. 这是**单步执行**：结果写到测试步骤页这条用例的子表里，",
					"   **不产生报告版本、不进测试报告页**。",
					"   （每次执行对这条用例只追加一条执行记录。）",
					"",
					"4. **执行记录必须标 source = \"step\"**（表示这是单步执行）。",
					"   面板靠它区分：单步记录只留在步骤页子表，**不会出现在测试报告页**。",
					"   记录字段：{ runId, at, result, durationMs, source }。",
					"",
					"## ★ 必须为这次单条执行生成报告",
					"- 生成时间：执行结束、拿到结果之后**立即生成**，不要等用户再点一次。",
					"- **必须调生成器生成**：" + generatorPathNote() + "",
					"  **不许自己写填表逻辑，不许复制生成器改，生成器缺失要明确报错**（不要降级成简化版）。",
					"- 存放位置：`integration/reports/<本次 runId>/`（**用这次执行的 runId 建目录**）。",
					"- **只取「4.1.1 测试结果总结」那一张表**，不要按整本配置项测试模板排版。",
					"- **不要章节号和表题**：不写「4.1 功能项名」、不写「4.1.1 测试结果总结」、",
					"  不写「表1 标识 xxx 第 N 步」。单条报告 = 标题 + 一张填好的表。",
					"  原型已经按这个规则改好了，**你只要把数据喂给它**。",
					"- **测试类型按用例自身 type 填**（functional→功能测试、api→接口测试、boundary→边界测试…）；",
					"  **测试方法固定「黑盒测试」**。两个格不一样，不要都写黑盒测试。",
					"- **人员三字段暂定都写 `admin`；软件问题单编号写「无」**（原型里已是默认值）。",
					"  单条报告要喂的数据结构：",
					"    · people { designer, reviewer, tester }（都填 admin）",
					"    · feature { code, name }",
					"    · case { caseId, title, type, requirement, description, precondition, executedAt, outcome, steps[] }",
					"    · steps[]：**整条用例的全部步骤**都要列出，本次未执行的标 outcome=\"notRun\"，",
					"      observed 写「未执行（本次只执行第 N 步）」—— 不要只写执行的那一步。",
					"- 文件名：`集成测试报告-<caseId>-第<N>步-<版本>.docx`。",
					"- 报告生成后**停下来告诉我路径**，我要在步骤页子表点「查看报告」直接打开它。",
					"",
					"## 硬性约束",
					"- 回写 observed 必须是**真实读到的现象**，不能把预期抄成观察。",
					"- 找不到证据标「未确认」，不冒充 runner 证据。",
					"- 编译错误、依赖缺失视为失败，不是通过。",
					"- 报告/界面里不出现测试代码与函数名。"
				].join("\n");

				prefillToComposer(text, "已把这条用例的执行话术填进对话输入框，审阅后按回车发送。");
			}

			/**
			 * 「一键执行」按钮：把执行话术填进对话框，用户审阅后发送。
			 *
			 * 这里不预先跑 runner —— 命令与 runId 由模型在收到话术后再准备，
			 * 面板只负责把「跑什么、怎么记录、怎么取证」说清楚。
			 */
			function runAllIntegrationPrompt() {
				var stepCount = records.reduce(function (sum, item) {
					return sum + (Array.isArray(item.steps) ? item.steps.length : 0);
				}, 0);
				if (stepCount === 0) {
					setNotice("当前还没有测试步骤，先在用例页点「生成测试步骤」。");
					return;
				}
				var text = [
					"按集成测试 Skill 一键执行当前步骤版本的全部步骤。",
					"",
					"步骤版本：" + version + "（共 " + records.length + " 条用例、" + stepCount + " 个步骤）",
					"来源：integration/step-versions/" + version.replace(/\./g, "_") + "/steps.json",
					"",
					"## 执行要求",
					"1. 严格按步骤版本执行，**只认 cases.snapshot.json 冻结的用例**，不读当前用例版本。",
					"2. 按步骤的 channel 执行：code=把产品源码编进测试做白盒验证，service=启停被测服务，runner=调工装测试函数走 run_tests.py，cmd=跑构建门/环境检查。自己直接执行，四种并存是正常的，分别记录、分别标来源。",
					"3. 执行记录要挂到测试步骤页主表每一行下面的子表里（每次一键执行对每条用例只加一条）。",
					"   **每条记录必须标 source = \"all\"**（表示这是一键执行），否则报告页看不到它：",
					"   面板靠 source 区分「单步执行（step，只在步骤页）」和「一键执行（all，进报告页）」。",
					"4. 报告分两类，**排版方式完全不同，不要混用**（见下「报告要出什么」）。",
					"",
					"## ★ 报告要出什么（两类，别混淆）",
					"",
					"### 共用铁律：报告一律调生成器，不许自己写填表逻辑",
					"- 生成器路径：" + generatorPathNote() + "",
					"- 它对外只有两个函数：`build_single_step(...)` 单条报告、`build_full(...)` 总体报告。",
					"",
					"### ★ 首选：直接跑 bridge.py，不要自己写转换脚本",
					"- 仓库里已有数据转换层 `integrationReport/bridge.py`（与单元测试的 bridge.py 同一分工）：",
					"  ```",
					"  cd <仓库根>\\integrationReport",
					"  python bridge.py --session-root <会话>/integration --run-id <本次 runId> \\",
					"                   --project-code <项目缩写> --software-name \"<软件名>\" \\",
					"                   --software-version <版本> --report-version <面板分配的版本号>",
					"  ```",
					"- 它会写 `report-plan.json` + `report-data.json`，然后调生成器出总体报告 + 每条用例的单条报告。",
					"- **不要自己重写一份转换脚本**：",
					"  · 只有 bridge.py 在仓库里，别人拉取后才有；会话目录里的临时脚本别人没有；",
					"  · 已踩过：`result.json` 的步骤号字段是 `stepNo` 不是 `no`，写错会让 173 个步骤",
					"    只匹配到 74 条证据、结论全部变成「未执行」。",
					"- 只有 bridge.py 真的不满足需求时，才自己写脚本，且职责仍然只有「取数据 + 调生成器」。",
					"",
					"### 共用铁律",
					"- **不许自己实现表格填充**（会漏规范：不要章节号 / 类型映射 / 一页显示 / 人员默认值等）。",
					"- **不许把生成器复制一份改**（规范会分叉）。要改就改生成器本身。",
					"- **生成器缺失时明确报错**，不许自己写个简化版冒充。",
					"- **不许混用单元测试的报告工具**（`bridge.py` / `report-tool/` 是另一套，数据模型不同）。",
					"",
					"### A. 每条用例一份「单用列表」报告 —— 只取 4.1.1 那一张表",
					"- **不要套整本配置项测试模板**，只取模板里 **4.1.1「测试结果总结」那一张表**并填好。",
					"  模板里其它章节（1 范围、2 引用文档、3 评估、5 注释、附录）**全部不要**。",
					"- **更不要章节号和表题**：不写「4.1 功能项名」、不写「4.1.1 测试结果总结」、",
					"  不写「表1 标识 xxx 第 N 步」。单条报告 = 标题 + 一张填好的表。",
					"- 生成方式：调原型的 `build_single_step()`，**不要用 `build_full()`**。",
					"- **测试类型按用例自身填**（界面用例写「功能测试」、接口用例写「接口测试」…），",
					"  **测试方法固定写「黑盒测试」**。两个格不一样，不要都写黑盒测试。",
					"- **人员三字段暂定都写 `admin`；软件问题单编号写「无」**。",
					"- 存放位置：`integration/reports/<本次 runId>/cases/`",
					"- 文件名：`集成测试报告-<caseId>-全步骤-<版本>.docx`",
					"- 内容：这条用例的**全部步骤**（no/action/operation/expected/observed/outcome），",
					"  逐步骤填实；本次未执行的步骤标 outcome=\"notRun\"，observed 写「未执行（本次未执行该步）」。",
					"- **每条用例都要有**，60 条用例就是 60 份。",
					"",
					"### B. 整个项目一份「总体报告」—— 按阶段分章，套整本模板",
					"- 这一类**才**用整本模板：`1 范围` … `注释` + 附录A/B。",
					"- 生成方式：用 `build_full()`，**数据要按 stages 组织**（不是平铺 features）：",
					"  data = { meta, people, stages: [ { name, features:[{name,cases}], issues, inconsistent, regression } ] }",
					"- **按测试阶段分章**：第 1 个阶段是 4 章，第 2 个是 5 章…（章号 = 阶段序号 + 3）。",
					"  每个阶段内部：N.1 <功能点名称> → N.1.1 测试结果总结（**该功能点下所有用例表**）",
					"  → N.2 <下一个功能点> → N.2.1 测试结果总结 … 依此类推",
					"  → N.n 遇到的问题（n = 功能点数 + 1，写「详见附录A软件问题报告单」）",
					"  → N.n+1 与测试用例/规程的不一致（一般写「无」）",
					"  → N.n+2 回归测试（章内最后一节，只放本阶段未通过的用例重跑结果）；",
					"    其下的 N.n+2.r <功能点名> **下面直接接表**，没有 .1 那层测试结果总结。",
					"- **3.1 总体评估按阶段数展开段落**（模板是制式段「共 x 个这样的段」）：",
					"  有几个阶段就复制几段，每段填该阶段数据；最后一段固定的「经本次配置项测试验证…」。",
					"- **表2 分布统计**：表头「测试功能」要写成「**功能测试**」；7 类没有的写 **0** 不要空着；",
					"  测试阶段列**不能空**。",
					"- **表3 问题分类**：「合计问题数」没有写 **0**；「测试问题归零解决情况」没有写 **无**。",
					"- **表4 记录单**：测试阶段不能空；详细需求追踪条目 = 用例标识去掉 `-N-Tnnn.CTD`。",
					"- 存放位置：`integration/reports/<本次 runId>/`（与 cases/ 平级）",
					"- 文件名：`集成测试报告-<项目名>-整项目-<报告版本>.docx`",
					"",
					"### ★ 报告版本号：必须向面板要，不许自己写死（用户踩过的坑）",
					"",
					"**每次一键执行都要新建一个报告版本，而且只新建一次。**",
					"第 1 次执行 = V0.0.1，第 2 次 = V0.0.2，第 3 次 = V0.0.3……",
					"绝不能在脚本里写死 `V0.0.1`，也绝不能整体覆盖 `report-versions/index.json`。",
					"**必须在生成报告之前，向面板要版本号，且一次一键执行只调一次：**",
					"",
					"```",
					"POST /data-panel/integration",
					'{ "sessionId": "<当前会话>", "kind": "report", "op": "createVersion",',
					'  "runId": "<本次 runId>", "sourceStepVersion": "<步骤版本>" }',
					"→ { ok: true, name: \"V0.0.1\", index: {...} }",
					"```",
					"",
					"**★ 只调一次，不要为「试探」或「预检」再调第二次。**",
					"面板是从 `index.json` 当前最大值 +1 分配版本号的，每调一次就真的多出一个版本。",
					"典型错误：先调一次看能不能通、再调一次当正式版本 → 第一次执行就变成 V0.0.2。",
					"**调用前先看返回的 `name` 是否已经是你要的那个**——它就是本次报告的版本号，直接用。",
					"",
					"拿返回的 `name` 去命名 docx 与 `report-versions/<name 换下划线>/report.json`：",
					"  · `report.json` 里写 `reportVersion: <name>`、`runId`、`stepVersion`、`caseVersion`；",
					"  · **不要**自己改写 `report-versions/index.json`（面板已经写好了）。",
					"",
					"为什么必须这样：runId 精度只到分钟，同一分钟内连点两次「一键执行」会拿到同一个",
					"runId。旧实现把版本号写死成 V0.0.1 并重写 index.json，于是第二次执行直接盖掉了",
					"第一次 —— 用户看到的就是「执行了两次，报告页还是只有 V0.0.1」。",
					"",
					"### ★ 用例标识规范（每条用例生成时就必须产出 caseCode）",
					"- 格式：`测试类型缩写-651-项目缩写_需求来源_章节英文名-1或2-T序号.CTD`",
					"- 例：`GN-651-JYSG_SRS_UI_TESTING-1-T001.CTD`、`JK-651-JYSG_DM_API_TESTING-2-T002.CTD`",
					"- 类型缩写：功能=GN 接口=JK 安全=AQ 性能=XN 边界=BJ 强度=QD 余量=YL",
					"- `651` 与结尾 `.CTD` **固定不变**；项目缩写如 肌颜时光→JYSG",
					"- 需求来源：有需求文档=`SRS`，按代码归纳=`DM`",
					"- 章节名：需求文档章节英文名；无需求文档用功能点英文名（如 `API_TESTING`）",
					"- 倒数第二段：`1`=正常用例，`2`=专门测异常情况的用例",
					"- **详细需求追踪条目** = 用例标识去掉 `-1-T001.CTD` 尾部",
					"- 存进用例的 `caseCode` 字段；内部主键 `caseId` 保持不变（面板/执行靠它关联）",
					"- **面板的四个表格都要显示这一列**（都是「测试用例标识」列）：",
					"  ① 测试用例页主表  ② 测试步骤页主表  ③ 步骤页展开的执行记录子表  ④ 报告页子表",
					"  显示值一律取 `caseCode`；老数据没有 `caseCode` 时才退回 `caseId`。",
					"",
					"### 怎么记录这两类报告的位置",
					"执行结束后写一份 `reports/<runId>/report-data.json`，至少包含：",
					"  { runId, stepVersion, caseVersion, generatedAt, summary, overallDocx, features }",
					"其中 `overallDocx` 指向 B 那份总体报告；每条用例的单条报告路径记在 features 下各用例项里。",
					"面板的「查看报告」按 runId 找目录，**只要目录里有 docx 就能打开**。",
					"",
					"## 硬性约束",
					"- 回写 observed 必须是**真实读到的现象**，不能把预期抄成观察。",
					"- 找不到证据标「未确认」，不冒充 runner 证据。",
					"- 编译错误、依赖缺失视为失败，不是通过。",
					"- 报告里不出现测试代码与函数名。"
				].join("\n");
				prefillToComposer(text, "已把「一键执行」的话术填进对话输入框，审阅后按回车发送。");
			}

			/**
			 * 把当前版本的用例写回磁盘。
			 *
			 * 与单元测试一致：先改界面（乐观更新），再 POST 回去。
			 * 写失败只提示、不回滚界面 —— 用户能再点一次保存，比悄悄丢掉改动好。
			 * 没有真实数据源（未加载成功 / 无会话）时跳过，避免报一堆红。
			 */
			function persistCases(nextList) {
				if (typeof fetch !== "function") return;
				if (sessionId === "") return;
				if (loadState !== "ready") return;
				var body = {
					sessionId: sessionId,
					kind: "case",
					op: "saveVersion",
					version: version,
					cases: nextList
				};
				fetch("/data-panel/integration", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify(body)
				})
					.then(function (response) {
						return response.json().catch(function () { return {}; }).then(function (data) {
							if (!response.ok || data.ok === false) {
								throw new Error((data && data.error) || ("保存失败（HTTP " + response.status + "）"));
							}
							return data;
						});
					})
					.then(function () { setNotice(""); })
					.catch(function (error) {
						setNotice("保存到磁盘失败：" + (error && error.message ? error.message : String(error)) + "。界面上的改动还在，可以再点一次保存。");
					});
			}

			/**
			 * 把功能项清单写回 `case-versions/<V>/features.json`。
			 *
			 * 为什么按名字对回原对象：面板只提供「新建一个功能项」这一种改动，
			 * 不改 id / code / description。已经存在的条目原样保留（连字段顺序都不动），
			 * 只有清单里新增的名字才生成一条 `ft_*` 新条目。
			 *
			 * `source` 固定写 "manual"：它与 Skill 的三种来源（requirement / skill /
			 * code-derived）区分开，报告侧一眼能看出「这条是人在面板上手动加的」。
			 */
			function persistFeatures(nextNames) {
				if (typeof fetch !== "function") return;
				if (sessionId === "") return;
				if (loadState !== "ready") return;

				var existing = (remote && Array.isArray(remote.features)) ? remote.features : [];
				var byName = Object.create(null);
				existing.forEach(function (item) {
					if (item && typeof item.name === "string") byName[item.name.trim()] = item;
				});
				var usedIds = Object.create(null);
				existing.forEach(function (item) {
					if (item && typeof item.id === "string") usedIds[item.id] = true;
				});
				var nextFeatures = nextNames.map(function (name) {
					if (byName[name]) return byName[name];
					var id = "ft_manual_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
					while (usedIds[id]) id += "x";
					usedIds[id] = true;
					return { id: id, name: name, source: "manual" };
				});

				fetch("/data-panel/integration", {
					method: "POST",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({
						sessionId: sessionId,
						kind: "case",
						op: "saveVersion",
						version: version,
						features: nextFeatures
					})
				})
					.then(function (response) {
						return response.json().catch(function () { return {}; }).then(function (data) {
							if (!response.ok || data.ok === false) {
								throw new Error((data && data.error) || ("保存失败（HTTP " + response.status + "）"));
							}
							return data;
						});
					})
					.then(function () {
						// 写盘成功后把内存里的清单也对齐，避免下次保存又按旧数据重算 id。
						setRemote(function (previous) {
							if (!previous) return previous;
							return Object.assign({}, previous, { features: nextFeatures });
						});
						setNotice("");
					})
					.catch(function (error) {
						setNotice("功能项保存到磁盘失败：" + (error && error.message ? error.message : String(error)) + "。界面上的改动还在，可以再点一次保存。");
					});
			}

			/** 新建功能项：先改界面（侧栏立刻出现一条 0 条目的功能项），再写盘。 */
			function createFeature(name) {
				var trimmed = String(name || "").trim();
				if (trimmed === "") return;
				// 重名直接跳过，不产生重复条目。名字是功能项在侧栏里的唯一标识。
				if (featureNames.indexOf(trimmed) !== -1) {
					setFeaturePrompt(null);
					setNotice("功能项「" + trimmed + "」已存在，没有重复新建。");
					return;
				}
				var next = featureNames.concat([trimmed]);
				setFeatureNames(next);
				persistFeatures(next);
				setFeaturePrompt(null);
				// 新建完直接切到这一项，否则列表里多一行却还停在「全部用例」，看不出变化。
				setScenario(trimmed);
				resetPages();
			}

			/**
			 * 左栏拖拽调宽：与单元测试 `startSidebarResize` 同一套做法。
			 *
			 * 拖动时直接改 DOM 宽度（不逐帧 setState，避免整张表格重渲染），松手后再写回状态。
			 * 把手正好盖在两栏间距上，所以取「把手的前一个兄弟节点」就是侧栏。
			 */
			function startSideResize(event) {
				if (!event || (event.pointerType === "mouse" && event.button !== 0)) return;
				var handle = event.currentTarget;
				var aside = handle ? handle.previousElementSibling : null;
				if (!aside) return;
				event.preventDefault();
				var board = handle.parentElement;
				var startX = event.clientX;
				var startWidth = Math.round(aside.getBoundingClientRect().width) || 128;
				var lastWidth = startWidth;
				var clientX = startX;
				var frame = 0;
				setSideResizing(true);
				handle.classList.add("is-dragging");

				function apply() {
					frame = 0;
					var boardWidth = board ? board.getBoundingClientRect().width : 0;
					// 至少给右侧表格留 280px；极窄时仍保证左栏 96px。与单元测试同口径。
					var maxWidth = Math.max(96, Math.min(420, boardWidth - 280));
					var next = Math.round(startWidth + (clientX - startX));
					if (next < 96) next = 96;
					if (next > maxWidth) next = maxWidth;
					lastWidth = next;
					aside.style.width = next + "px";
				}
				function move(moveEvent) {
					clientX = moveEvent.clientX;
					if (frame) return;
					if (typeof requestAnimationFrame === "function") frame = requestAnimationFrame(apply);
					else apply();
				}
				function stop() {
					if (frame && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
					frame = 0;
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", stop);
					window.removeEventListener("pointercancel", stop);
					handle.classList.remove("is-dragging");
					setSideResizing(false);
					setSideWidth(lastWidth);
				}
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", stop);
				window.addEventListener("pointercancel", stop);
			}

			/** 保存用例（新增或编辑）。 */
			function saveCase(next) {
				var exists = records.some(function (record) { return record.id === next.id; });
				if (exists) {
					var updated = records.map(function (record) {
						return record.id === next.id ? Object.assign({}, record, next) : record;
					});
					patchRecords(updated);
					persistCases(updated);
				} else {
					var id = "it-new-" + Date.now();
					var created = records.concat([Object.assign({}, next, {
						id: id,
						caseId: next.caseId || ("IT-" + String(records.length + 1).padStart(3, "0")),
						status: next.status || "none",
						lastRunAt: next.lastRunAt || "",
						// 生成时间在新增时点一次，之后编辑不再变（用例表的「生成时间」列）。
						createdAt: next.createdAt || new Date().toISOString().slice(0, 19),
						records: next.records || [],
						steps: Array.isArray(next.steps) ? next.steps : []
					})]);
					patchRecords(created);
					persistCases(created);
				}
				setDetail(null);
				setNotice("");
			}
			function removeCase(record) {
				var left = records.filter(function (item) { return item.id !== record.id; });
				patchRecords(left);
				persistCases(left);
				confirmSet(null);
			}

			var scenarios = itScenarioRows(records, featureNames);
			var typeCounts = {};
			IT_TYPE_KEYS.forEach(function (key) { typeCounts[key] = 0; });
			records.forEach(function (record) {
				if (typeCounts[record.type] !== undefined) typeCounts[record.type] += 1;
			});
			var current = filtered();
			// 用例页 / 报告页使用的列表：不含「按状态筛选」，该筛选只属于测试步骤页。
			var baseCurrent = filteredBase();

			/*
			 * 「筛选」按钮 + 提示条。定义在这里（IntegrationPanel 作用域）而不是 stepsView 里，
			 * 原因是按钮要放进工具栏（在 stepsView 之前渲染），提示条归 stepsView 用。
			 * 「已显示 / 总数」里的总数取未筛选前的集合，才是用户能感知的「筛掉了多少」。
			 */
			var filterParts = ItResultFilter({
				value: resultFilter,
				open: resultOpen,
				buttonRef: resultBtnRef,
				shown: current.length,
				total: records.length,
				onToggle: function (next) { setResultOpen(next); },
				onChange: function (next) { setResultFilter(next); resetPages(); }
			});

			/** 场景侧栏。 */
			function sidebar() {
				return h("aside", {
					className: "it-side",
					// 宽度跟拖动结果走；高度由 .it-board 的 stretch 自动拉到底。
					style: sideWidth > 0 ? { width: sideWidth + "px" } : null
				},
					h("div", { className: "it-side-head" },
						h("span", { className: "it-side-title" }, "功能项"),
						h("div", { className: "it-side-tools" },
							h(IconButton, {
								name: "plus",
								label: "新建功能项",
								"data-it": "feature-create",
								onClick: function () { setFeaturePrompt({}); }
							})
						)
					),
					h("div", { className: "it-side-scroll" },
						scenarios.length <= 1
							? h("div", { className: "it-side-empty" }, "还没有功能项，点上边的 + 新建一个。")
							: null,
						scenarios.map(function (row) {
							return h("button", {
								key: row.key,
								type: "button",
								className: cn("it-side-item", scenario === row.name ? "is-active" : ""),
								"data-it": "scenario-" + row.name,
								onClick: function () { setScenario(row.name); resetPages(); }
							},
								h("span", { className: "it-side-name" }, row.name),
								h("span", { className: "it-side-count" }, String(row.count))
							);
						})
					)
				);
			}

/*
			 * 三个子页的统一分页。
			 *
			 * 复用单元测试的 .dp-pager 一套（共 N 条 / 每页几条 / 上一页 / 页码 / 下一页），
			 * 换成 15 条的需求就改 sizes 即可。
			 */
			/**
			 * 通用分页条。可选传入 size / setSize / unit，让不同页面（如报告页按功能项分组）
			 * 共用同一套样式，又不互相干扰；不传则沿用面板级 pageSize。
			 */
			function pager(rows, pageValue, setPageValue, testId, sizeArg, setSizeArg, unit) {
				var size = sizeArg > 0 ? sizeArg : pageSize;
				var setSize = typeof setSizeArg === "function" ? setSizeArg : setPageSize;
				var unitText = unit || "条";
				var pageCount = Math.max(1, Math.ceil(rows.length / size));
				// 数据变少（删除、筛选）后当前页可能越界，这里就地夹紧，不改状态。
				var current = Math.min(Math.max(1, pageValue), pageCount);
				return h("div", { className: "dp-pager it-pager", "data-it": testId || "pager" },
					h("span", { className: "dp-pager-total" }, "共 " + rows.length + " " + unitText),
					/*
					 * 这里只写「每页 + 下拉」，不再在末尾补一个「条」——
					 * option 文案本身就是「10 条」，再补一个会显示成「每页 10 条 条」。
					 */
					h("span", { className: "dp-pager-size" }, "每页",
						h("select", {
							value: String(size),
							onChange: function (event) {
								var next = Number(event.target.value);
								setSize(next > 0 ? next : 10);
								setPageValue(1);
							},
							"aria-label": "每页条数"
						}, [5, 10, 15, 20, 50].map(function (option) {
							return h("option", { key: option, value: String(option) }, option + " 条");
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
				var rows = baseCurrent;
				var shown = pageRows(rows, casePage);
				return h(React.Fragment, null,
					h("div", { className: cn("it-board", sideResizing ? "is-resizing" : "") },
						sidebar(),
						h("div", {
							className: "dp-resizer",
							role: "separator",
							"aria-orientation": "vertical",
							"aria-label": "拖动调整功能项宽度",
							title: "拖动调整宽度",
							"data-it": "side-resizer",
							onPointerDown: startSideResize
						}),
						h("div", { className: "it-main" },
							/* 和单元测试一样：表格 + 分页条包在一张卡片里（.dp-card 的观感） */
							h("div", { className: "it-card" },
								h("div", { className: "it-table-wrap", "data-it": "cases-table" },
									rows.length === 0
									? h("div", { className: "it-empty" },
										h("div", { className: "it-empty-title" },
											loadState === "loading"
												? "正在读取集成测试数据…"
												: (loadState === "error"
													? "读取集成测试数据失败"
													: (query.trim() !== "" ? "没有匹配的测试用例" : "当前还没有测试用例"))),
										h("div", { className: "it-empty-hint" },
											loadState === "loading"
												? "从本项目的 .dsh/test-sessions/<会话>/integration/ 读取，稍等一下。"
												: (loadState === "error"
													? (loadError || "宿主未返回原因。确认项目目录存在、会话已就绪后可点「刷新」重试。")
													: (query.trim() !== ""
														? "换个关键词，或清空搜索条件再看看。"
														: "点右上角「新增用例」手动加一条，或在对话框里让 AI 按需求生成测试用例。")))
									)
									: h("table", { className: "it-table" },
										h("thead", null,
											h("tr", null,
												h("th", { style: { width: "210px" } }, "测试用例标识"),
												h("th", { style: { width: "26%" } }, "用例名称"),
												h("th", null, "用例描述"),
												h("th", { style: { width: "90px" } }, "测试类型"),
												h("th", { style: { width: "78px" } }, "操作")
											)
										),
										h("tbody", null, shown.map(function (record, index) {
											return h("tr", {
												key: record.id,
												"data-case-row": record.id,
												className: cn(dragIndex === index ? "is-dragging" : ""),
												onMouseEnter: function () { if (dragFrom !== null) moveRecord(dragFrom, index); },
												onMouseLeave: function () {}
											},
												h("td", { className: "it-left" },
													h("div", { className: "it-no-cell" },
														/*
														 * 拖拽手柄：6 个灰点 3×2、透明背景。
														 * 按下记下起点，移动到别的行时真实换位（列表立刻跟着动），
														 * 松开即结束。手写原生事件，不引第三方拖拽库。
														 */
														h("span", {
															className: cn("it-drag-handle", dragIndex === index ? "is-active" : ""),
															role: "button",
															tabIndex: 0,
															title: "拖动调整顺序",
															"data-it": "drag-" + record.id,
															onMouseDown: function (event) {
																if (event && typeof event.preventDefault === "function") event.preventDefault();
																beginDrag(index);
															}
														}, h(Icon, { name: "grip", size: 14 })),
														h("span", { className: "it-case-id" }, caseLabel(record))
													)
												),
												h("td", { className: "it-left" },
													h("span", { className: "it-name-text" }, record.title || "—")
												),
												h("td", { className: "it-left" },
													h("p", { className: "it-cell-full", title: record.description || "" }, record.description || "—")
												),
												h("td", null, itTypePill(record.type)),
												h("td", null,
													h("div", { className: "it-ops" },
														h(IconButton, { name: "edit", label: "编辑", "data-it": "edit-btn-" + record.id, onClick: function () { setDetail({ mode: "edit", record: record }); } }),
														h(IconButton, { name: "trash", danger: true, label: "删除", "data-it": "delete-" + record.id, onClick: function () { confirmSet({ record: record }); } })
													)
												)
											);
										}))
									)
							),
								rows.length > 0 ? pager(rows, casePage, setCasePage, "cases-pager") : null
							)
						)
					)
				);
			}

			/**
			 * 子表分页（按原型图 5 的形态）：共 N 条，每页 [15条/页 ▾]  ‹ 1 ›
			 *
			 * 和主表那个 .dp-pager 不是一套：子表在展开区里，空间小、字号小，
			 * 所以单独做一套紧凑的，选项固定 15 / 30 / 50 / 100。
			 * 页码用按钮显示当前页；上一页 / 下一页是两端的箭头。
			 */
			function subPager(record, pageValue, setPageValue) {
				var runs = Array.isArray(record.records) ? record.records : [];
				var pageCount = Math.max(1, Math.ceil(runs.length / subSize));
				var current = Math.min(Math.max(1, pageValue), pageCount);
				return h(React.Fragment, null,
					h("span", { className: "it-sp-total" }, "共 " + runs.length + " 条，每页"),
					h("select", {
						className: "it-sp-select",
						value: String(subSize),
						"data-it": "sub-page-size",
						onChange: function (event) {
							var next = Number(event.target.value);
							setSubSize(next > 0 ? next : 15);
							setPageValue(1);
						},
						"aria-label": "每页条数"
					}, [15, 30, 50, 100].map(function (n) {
						return h("option", { key: n, value: String(n) }, n + "条/页");
					})),
					h("button", {
						type: "button",
						className: "it-sp-btn",
						disabled: current <= 1,
						"data-it": "sub-page-prev",
						onClick: function () { if (current > 1) setPageValue(current - 1); }
					}, h(Icon, { name: "chevron", size: 11, style: { transform: "rotate(180deg)" } })),
					h("button", {
						type: "button",
						className: "it-sp-page is-active",
						"data-it": "sub-page-current",
						onClick: function () { if (current < pageCount) setPageValue(current + 1); }
					}, String(current)),
					h("button", {
						type: "button",
						className: "it-sp-btn",
						disabled: current >= pageCount,
						"data-it": "sub-page-next",
						onClick: function () { if (current < pageCount) setPageValue(current + 1); }
					}, h(Icon, { name: "chevron", size: 11 }))
				);
			}

			/**
			 * 「筛选」按钮 + 多选下拉 + 已筛选提示条。
			 *
			 * 只在测试步骤页使用（测试用例 / 测试报告两页暂不加）。
			 * 交互按要求：
			 *   · 按钮文案固定为「筛选」，不显示当前筛的是哪个字段
			 *   · 点列表外部要关闭（全局 mousedown 见 IntegrationPanel 的 useEffect）
			 *   · 勾选后出现提示条：「已按状态筛选：当前显示 X / Y 条用例  清除筛选」
			 */
			function ItResultFilter(props) {
				var picked = Array.isArray(props.value) ? props.value : [];
				var open = props.open === true;
				function emit(next) {
					if (typeof props.onChange === "function") props.onChange(next);
				}
				var keys = IT_RESULT_FILTERS.map(function (item) { return item.key; });

				var button = h("div", { className: "it-result-filter", "data-dropdown": "result" },
					h("button", {
						type: "button",
						ref: props.buttonRef,
						className: cn("it-filter-btn", open ? "is-open" : "", picked.length > 0 ? "is-filtered" : ""),
						"aria-haspopup": "listbox",
						"aria-expanded": open,
						"data-it": "result-menu",
						title: "按状态筛选用例",
						onClick: function () {
							if (typeof props.onToggle === "function") props.onToggle(!open);
						}
					},
						h(Icon, { name: "filter", size: 14 }),
						"筛选"
					),
					h(ItMenu, {
						open: open,
						anchorRef: props.buttonRef,
						align: "right",
						width: 196,
						maxHeight: 210,
						testId: "result-menu-panel"
					},
						/* 顶部一行：说明文字 + 全选 / 清空（清空 = 全不勾，不是关闭筛选） */
						h("div", { className: "it-filter-head" },
							h("span", { className: "it-filter-title" }, "按状态筛选用例"),
							h("button", {
								type: "button",
								className: "it-filter-link",
								"data-it": "result-select-all",
								onClick: function () { emit(keys.slice()); }
							}, "全选"),
							h("button", {
								type: "button",
								className: "it-filter-link",
								"data-it": "result-clear",
								onClick: function () { emit([]); }
							}, "清空")
						),
						/* 两列排布（对齐原型）：通过 / 未通过 在上，异常 在下 */
						h("div", { className: "it-filter-grid" },
							IT_RESULT_FILTERS.map(function (item) {
								var on = picked.indexOf(item.key) !== -1;
								return h("label", {
									key: item.key,
									className: "it-filter-cell",
									"data-it": "result-" + item.key,
									onClick: function (event) {
										if (event && typeof event.preventDefault === "function") event.preventDefault();
										emit(on
											? picked.filter(function (x) { return x !== item.key; })
											: picked.concat([item.key]));
									}
								},
									h("span", { className: cn("it-filter-box", on ? "is-on" : "") }, on ? h(Icon, { name: "check", size: 11 }) : null),
									h("span", null, item.label)
								);
							})
						)
					)
				);

				var bar = picked.length === 0
					? null
					: h("div", { className: "it-filter-bar", "data-it": "result-bar" },
						h("span", null, "已按状态筛选：当前显示 ", h("b", null, String(props.shown)), " / ", String(props.total), " 条用例"),
						h("button", {
							type: "button",
							className: "it-filter-link",
							"data-it": "result-bar-clear",
							onClick: function () { emit([]); }
						}, "清除筛选")
					);

				return { button: button, bar: bar };
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
					h("div", { className: cn("it-board", sideResizing ? "is-resizing" : "") },
						sidebar(),
						h("div", {
							className: "dp-resizer",
							role: "separator",
							"aria-orientation": "vertical",
							"aria-label": "拖动调整功能项宽度",
							title: "拖动调整宽度",
							"data-it": "side-resizer",
							onPointerDown: startSideResize
						}),
						h("div", { className: "it-main" },
							/*
							 * 主表上方：左边「测试步骤」说明 + 「多选」按钮，右边「筛选」按钮。
							 * 多选态下整条换成多选操作条（计数 / 退出 / 导出 / 全选 / 清空），
							 * 与报告页那套一致 —— 两个页面的多选观感必须一样，不各写一套。
							 */
							stepMultiSelect
								? h("div", { className: "it-multi-bar", "data-it": "steps-multi-bar" },
									h("span", { className: "it-multi-stat" },
										"测试步骤 ",
										h("b", null, String(rows.length)),
										" 条用例 / ",
										h("b", null, String(rows.reduce(function (sum, record) { return sum + itStepCount(record); }, 0))),
										" 个步骤"
									),
									h("button", {
										type: "button",
										className: "it-multi-link is-strong",
										"data-it": "steps-multi-exit",
										onClick: function () { setStepMultiSelect(false); setStepPickedRuns([]); }
									}, "退出多选"),
									h("button", {
										type: "button",
										className: "it-multi-export",
										"data-it": "steps-multi-export",
										disabled: stepPickedRuns.length === 0,
										onClick: function () { exportPickedRuns(stepPickedRuns); }
									}, h(Icon, { name: "download", size: 13 }), "导出已选报告"),
									h("button", {
										type: "button",
										className: "it-multi-link",
										"data-it": "steps-multi-all",
										onClick: function () {
											// 全选 = 当前页所有用例下的所有执行记录
											var all = [];
											rows.forEach(function (r) { all = all.concat(runKeysOf(r)); });
											setStepPickedRuns(all);
										}
									}, "全选"),
									h("button", {
										type: "button",
										className: "it-multi-link",
										"data-it": "steps-multi-clear",
										onClick: function () { setStepPickedRuns([]); }
									}, "清空"),
									h("span", { className: "it-multi-picked", "data-it": "steps-multi-picked" },
										"已选 ", h("b", null, String(stepPickedRuns.length)), " 条")
								)
								: h("div", { className: "it-subbar", "data-it": "steps-subbar" },
									h("div", { className: "it-subbar-left" },
										h("span", { className: "it-subbar-label" }, "测试步骤"),
										/*
										 * ⏸ 暂时注释掉「多选」按钮（2026-11-25 用户要求）。
										 * 批量导出这一套先不用，以后要恢复就把下面这段的
										 * 注释符号去掉即可（多选态的渲染逻辑都还在，没删）。
										 */
										// h("button", {
										// 	type: "button",
										// 	className: "it-multi-enter",
										// 	"data-it": "steps-multi-enter",
										// 	title: "进入多选，可批量导出报告",
										// 	onClick: function () { setStepMultiSelect(true); }
										// }, "多选")
									),
									filterParts.button
								),
							filterParts.bar,
							/*
							 * ★ 步骤孤岛提示：steps.json 里有步骤，但没有一条能挂到用例上。
							 *
							 * 这时表格里每行的「输入步骤 / 预期结果」都是破折号，而界面不会报错 ——
							 * 用户只会以为模型没生成步骤，回去重生成一遍，问题原样存在。
							 * 这里把真实原因（caseId 前缀对不上）直接摆出来，并给出正确写法示例。
							 */
							stepOrphan.count > 0
								? h("div", { className: "it-orphan-hint", "data-it": "steps-orphan-hint" },
									h("span", { className: "it-orphan-icon" }, "!"),
									h("span", null,
										"检测到 ",
										h("b", null, String(stepOrphan.count)),
										" 条步骤，但没有任何用例的 caseId 与之匹配，所以下面每行的「输入步骤 / 预期结果」都是空的。",
										h("br"),
										"常见原因：",
										h("b", null, "caseId 前缀与版本号格式不一致"),
										stepOrphan.sample.length > 0
											? h(React.Fragment, null,
												"步骤里写的是 ",
												h("code", null, stepOrphan.sample.join("、")),
												"，应为 ",
												h("code", null, String(stepOrphan.sample[0]).replace(/^[Vv](\d+)_0?(\d+)_0?(\d+)-/, "V$1_$2_$3-")),
												" 这种形式（版本号里的点换成下划线，数字不补零）。"
											)
											: null
									)
								)
								: null,
							/* 表格 + 分页条包在卡片里，与单元测试同构 */
							h("div", { className: "it-card" },
								h("div", { className: "it-table-wrap", "data-it": "steps-table" },
									rows.length === 0
									? h("div", { className: "it-empty" },
										h("div", { className: "it-empty-title" },
											query.trim() !== "" ? "没有匹配的测试步骤" : "当前还没有测试步骤"),
										h("div", { className: "it-empty-hint" },
											query.trim() !== ""
												? "换个关键词，或清空搜索条件再看看。"
												: "先在「测试用例」页准备好用例，再点「生成测试步骤」。")
									)
									: h("table", { className: "it-table it-table-steps" },
										h("thead", null,
											h("tr", null,
												stepMultiSelect
													? h("th", { style: { width: "40px" } },
														h("input", {
															type: "checkbox",
															"aria-label": "全选当前页所有执行记录",
															"data-it": "steps-pick-all",
															checked: (function () {
																var all = [];
																shown.forEach(function (r) { all = all.concat(runKeysOf(r)); });
																return all.length > 0 && all.every(function (k) { return stepPickedRuns.indexOf(k) !== -1; });
															})(),
															onChange: function () {
																var all = [];
																shown.forEach(function (r) { all = all.concat(runKeysOf(r)); });
																var every = all.length > 0 && all.every(function (k) { return stepPickedRuns.indexOf(k) !== -1; });
																setStepPickedRuns(every
																	? stepPickedRuns.filter(function (k) { return all.indexOf(k) === -1; })
																	: stepPickedRuns.concat(all.filter(function (k) { return stepPickedRuns.indexOf(k) === -1; })));
															}
														})
													)
													: null,
												h("th", { style: { width: stepMultiSelect ? "170px" : "210px" } }, "测试用例标识"),
												h("th", { style: { width: "17%" } }, "用例名称"),
												h("th", { style: { width: "90px" } }, "测试类型"),
												h("th", null, "输入步骤"),
												h("th", null, "预期结果"),
												h("th", { style: { width: "80px" } }, "执行结果"),
												h("th", { style: { width: "78px" } }, "操作")
											)
										),
										h("tbody", null, shown.map(function (record, index) {
											var first = (record.steps || [])[0];
											var currentPage = Math.min(Math.max(1, stepPage), Math.max(1, Math.ceil(rows.length / pageSize)));
											var open = stepOpen.indexOf(record.id) !== -1;
											// 主表这一行的勾选态 = 它下面所有执行记录是否都被勾上。
											var picked = recordFullyPicked(record);
											var runCount = runKeysOf(record).length;
											return h(React.Fragment, { key: record.id },
												h("tr", { className: cn(open ? "is-open" : "", picked ? "is-picked" : ""), "data-case-row": record.id },
													stepMultiSelect
														? h("td", null,
															h("input", {
																type: "checkbox",
																"aria-label": "选择 " + caseLabel(record) + (runCount > 0 ? "（含 " + runCount + " 条执行记录）" : ""),
																"data-it": "steps-pick-" + record.id,
																// 没有执行记录的用例勾不上（勾了也没报告可导）
																disabled: runCount === 0,
																checked: picked,
																onChange: function () { setRecordPicked(record, !picked); }
															})
														)
														: null,
													/*
													 * 标识格里放「箭头 + 用例标识」：箭头是这一行唯一的下拉入口，
													 * 点开在下方挂一张执行结果子表（用例标识 / 名称 / 方法 / 结果 / 时间 / 操作）。
													 * 用例名称本身不再可点 —— 名称只是内容，不是入口。
													 * 序号列已去掉，箭头和标识共处一格，省一列宽度给内容。
													 */
													h("td", { className: "it-left" },
														h("div", { className: "it-no-cell" },
															h("button", {
																type: "button",
																// 复用单元测试的 .dp-expand-btn：30×30 按钮、19px 图标、展开整体转 90°
																className: "dp-expand-btn",
																"data-open": open ? "true" : "false",
																"aria-expanded": open,
																title: open ? "收起执行结果" : "展开执行结果",
																"data-it": "expand-" + record.id,
																onClick: function () { toggleStepOpen(record.id); }
															}, h(Icon, { name: "chevron", size: 19 })),
															h("span", { className: "it-case-id" }, caseLabel(record))
														)
													),
													h("td", { className: "it-left" },
														h("span", { className: "it-name-text" }, record.title || "—"),
														/*
														 * 角标 = 这一行下面子表里**有几条执行记录**，不是步骤数。
														 *
														 * 用途是让用户不展开也能看出「这条跑过几次」；0 条就不显示，
														 * 免得每行都挂个 0 反而看不出差别。
														 */
														itRunCount(record) > 0
															? h("span", {
																// 复用单元测试的 .dp-run-count（18px 高、10.5px 字、500 字重）
																className: "dp-run-count",
																"data-it": "run-count-" + record.id,
																title: "已执行 " + itRunCount(record) + " 次"
															}, String(itRunCount(record)))
															: null
													),
													h("td", null, itTypePill(record.type)),
													h("td", { className: "it-left" }, stepLines(record, "operation") || h("span", { className: "it-muted" }, "—")),
													h("td", { className: "it-left" }, stepLines(record, "expected") || h("span", { className: "it-muted" }, "—")),
													/*
													 * 执行结果：取这条用例最新一次执行记录的结果（通过 / 未通过 / 异常）。
													 * 和下方展开的执行结果子表同一份数据，这里只给一眼能扫的结论。
													 */
													h("td", null, (function () {
														var latest = IT_STATUS[itLatestResult(record)] || IT_STATUS.none;
														return h("span", { className: "it-pill", "data-tone": latest.tone, "data-it": "result-cell-" + record.id }, latest.label);
													})()),
													h("td", null,
														h("div", { className: "it-ops" },
															h(IconButton, { name: "play", label: "执行 " + (record.title || ""), "data-it": "run-" + record.id, onClick: function () { runStepPrompt(record); } }),
															h(IconButton, { name: "edit", label: "编辑步骤 " + (record.title || ""), "data-it": "edit-btn-" + record.id, onClick: function () { setDetail({ kind: "steps", record: record }); } })
														)
													)
												),
												open
													? h("tr", { className: "it-expand-row" },
														h("td", { colSpan: stepMultiSelect ? 8 : 7, "data-it": "step-runs-" + record.id },
															h("div", { className: "it-expand-box" },
																h("table", { className: "it-mini it-mini-runs" },
																	h("thead", null,
																		h("tr", null,
																			// 子表表头不放全选框：全选/取消统一在主表那一列做，
																			// 这里只留每行的勾选框，避免两处开关打架。
																			stepMultiSelect
																				? h("th", { style: { width: "36px" } }, "")
																				: null,
																			h("th", { style: { width: "190px" } }, "测试用例标识"),
																			h("th", null, "测试用例名称"),
																			h("th", { style: { width: "86px" } }, "测试类型"),
																			h("th", { style: { width: "72px" } }, "执行结果"),
																			h("th", { style: { width: "96px" } }, "测试时间"),
																			h("th", { style: { width: "86px" } }, "操作")
																		)
																	),
																	h("tbody", null, (function () {
																		var runs = record.records || [];
																		if (runs.length === 0) {
																			return h("tr", null, h("td", { colSpan: stepMultiSelect ? 7 : 6, className: "it-muted" }, "这条用例还没有执行记录"));
																		}
																		// 子表自己分页：页码按用例 id 各记一份
																		var cur = Math.min(Math.max(1, subPage[record.id] || 1), Math.max(1, Math.ceil(runs.length / subSize)));
																		var start = (cur - 1) * subSize;
																		return runs.slice(start, start + subSize).map(function (run, i) {
																			var runIndex = start + i;
																			var runMeta = IT_STATUS[run.result] || IT_STATUS.none;
																			// 子表勾选按「用例id|runId」区分：同一条用例可能有多条执行记录。
																			var isPicked = stepPickedRuns.indexOf(record.id + "|" + run.runId) !== -1;
																			return h("tr", { key: run.runId, className: cn(isPicked ? "is-picked" : "") },
																				stepMultiSelect
																					? h("td", null,
																						h("input", {
																							type: "checkbox",
																							"aria-label": "选择执行记录 " + run.runId,
																							"data-it": "step-runs-pick-" + run.runId,
																							checked: isPicked,
																							onChange: function () {
																								var key = record.id + "|" + run.runId;
																								setStepPickedRuns(isPicked
																									? stepPickedRuns.filter(function (k) { return k !== key; })
																									: stepPickedRuns.concat([key]));
																							}
																						})
																					)
																					: null,
																				h("td", null, h("span", { className: "it-case-id" }, caseLabel(record))),
																				h("td", { className: "it-left" }, record.title || "—"),
																				h("td", null, itTypePill(record.type)),
																				h("td", null, h("span", { className: "it-pill", "data-tone": runMeta.tone }, runMeta.label)),
																				h("td", null, itTime(run.at)),
																				h("td", null,
																					h("div", { className: "it-ops" },
																						h(IconButton, { name: "doc", label: "查看报告", "data-it": "report-sub-" + run.runId, onClick: function () { viewRunReport(run, record.caseId); } }),
																						h(IconButton, { name: "download", label: "导出报告", "data-it": "export-sub-" + run.runId, onClick: function () { exportRunReport(run, record.caseId); } }),
																						h(IconButton, { name: "trash", danger: true, label: "删除记录", "data-it": "del-run-" + run.runId, onClick: function () { removeRunRecord(record, run); } })
																					)
																				)
																			);
																		});
																	})())
																)
															),
															/* 子表底部的分页条（15 / 30 / 50 / 100），只在有多条记录时出现 */
															(record.records || []).length > 0
																? h("div", { className: "it-sub-pager" },
																	subPager(record, subPage[record.id] || 1, function (next) {
																		setSubPage(function (prev) {
																			var map = Object.assign({}, prev);
																			map[record.id] = next;
																			return map;
																		});
																	})
																)
																: null
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
				/*
				 * 报告页只放**一键执行**产生的结果。
				 *
				 * 单步执行的记录留在测试步骤页的子表里（用户明确要求：单条执行不进报告页）。
				 * 所以这里按记录的 source 过滤：
				 *   · source === "all"      → 一键执行，进报告页
				 *   · source === "step"     → 单步执行，**不进报告页**
				 *   · 没有 source（旧数据）  → 按「单步」处理，宁可少显示也不混进来
				 * 每条记录在写入时都会带上 source，见 runStepPrompt / 执行汇报要求。
				 */
				var rows = baseCurrent.filter(function (record) {
					return (record.records || []).some(function (run) {
						return run && run.source === "all";
					});
				});
				/*
				 * 按当前**报告版本**再筛一层。
				 *
				 * 报告版本 ↔ 某一次一键执行，靠 runId 关联（report-versions/index.json
				 * 里每个版本都记了 runId）。选中 V0.0.2 时就只显示那一次执行的结果，
				 * 而不是把历次执行全堆在一起 —— 否则「版本」在报告页没有意义。
				 *
				 * 没有 runId 的旧版本（或还没选版本）不做这层过滤，按「全部」显示。
				 */
				(function () {
					if (reportVersion === "") return;
					var picked = (Array.isArray(reportVersions) ? reportVersions : []).filter(function (item) {
						return item && item.name === reportVersion;
					})[0];
					var pickedRunId = picked && typeof picked.runId === "string" ? picked.runId : "";
					if (pickedRunId === "") return;
					rows = rows
						.map(function (record) {
							var kept = (Array.isArray(record.records) ? record.records : []).filter(function (run) {
								return run && run.source === "all" && run.runId === pickedRunId;
							});
							if (kept.length === 0) return null;
							return Object.assign({}, record, { records: kept });
						})
						.filter(function (record) { return record !== null; });
				})();
				// 按功能项归组，保持侧栏里的顺序（全部 → 各功能项按名称）。
				var groups = [];
				scenarios.forEach(function (item) {
					if (item.name === IT_SCENARIOS_ALL) return;
					var members = rows.filter(function (record) { return itScenarioOf(record) === item.name; });
					if (members.length === 0) return;
					/*
					 * 统计只数「一键执行」的记录，单步执行的不算进来 ——
					 * 否则「共 N 条报告」会把步骤页的单条记录也算进去，数字虚高。
					 */
					var pullRecords = function (r) {
						return (Array.isArray(r.records) ? r.records : []).filter(function (run) {
							return run && run.source === "all";
						});
					};
					var allRuns = members.reduce(function (list, r) { return list.concat(pullRecords(r)); }, []);
					groups.push({
						name: item.name,
						records: members,
						passed: allRuns.filter(function (run) { return run.result === "pass"; }).length,
						failed: allRuns.filter(function (run) { return run.result !== "pass"; }).length,
						reports: allRuns.length
					});
				});

				/*
				 * 外层分页：每页显示多少个功能项分组（每页条数可在底部下拉里调）。
				 * 组内分页仍由 reportPageMap 控制，两层互不影响。
				 */
				var reportGroupPageCount = Math.max(1, Math.ceil(groups.length / reportGroupSize));
				var reportGroupPageIndex = Math.min(Math.max(1, reportGroupPage), reportGroupPageCount);
				var visibleGroups = groups.slice(
					(reportGroupPageIndex - 1) * reportGroupSize,
					reportGroupPageIndex * reportGroupSize
				);
				var allIds = groups.reduce(function (list, group) {
					return list.concat(group.records.map(function (r) { return r.id; }));
				}, []);
				var allChecked = allIds.length > 0 && allIds.every(function (id) { return selected.indexOf(id) !== -1; });

				function toggleOne(id) {
					setSelected(function (previous) {
						return previous.indexOf(id) === -1
							? previous.concat([id])
							: previous.filter(function (x) { return x !== id; });
					});
				}
				function toggleGroup(ids) {
					var every = ids.every(function (id) { return selected.indexOf(id) !== -1; });
					setSelected(function (previous) {
						return every
							? previous.filter(function (id) { return ids.indexOf(id) === -1; })
							: previous.concat(ids.filter(function (id) { return previous.indexOf(id) === -1; }));
					});
				}

				return h(React.Fragment, null,
					/*
					 * 顶部汇总行。多选态下换成「多选操作行」：
					 * 退出多选 / 导出已选报告 / 全选 / 清空 —— 对齐原型图 4。
					 */
					multiSelect
						? h("div", { className: "it-multi-bar", "data-it": "multi-bar" },
							h("span", { className: "it-multi-stat" },
								"共 ", h("b", null, String(rows.length)), " 条报告（通过 ",
								String(rows.filter(function (r) { return r.status === "pass"; }).length),
								" / 失败 ",
								String(rows.filter(function (r) { return r.status === "fail"; }).length), "）"
							),
							h("button", { type: "button", className: "it-multi-link is-strong", "data-it": "multi-exit", onClick: function () { setMultiSelect(false); setSelected([]); } }, "退出多选"),
							h("button", {
								type: "button",
								className: "it-multi-export",
								"data-it": "multi-export",
								disabled: selected.length === 0,
								onClick: function () { exportPickedCases(selected); }
							}, h(Icon, { name: "download", size: 13 }), "导出已选报告"),
							h("button", { type: "button", className: "it-multi-link", "data-it": "multi-select-all", onClick: function () { setSelected(allIds.slice()); } }, "全选"),
							h("button", { type: "button", className: "it-multi-link", "data-it": "multi-clear", onClick: function () { setSelected([]); } }, "清空")
						)
						: h("div", { className: "it-overview-stat" },
							/*
							 * 统计口径与 reportsView 一致：只数一键执行的记录。
							 * 「通过/未通过」不能直接用 record.status（那是含单步执行在内的汇总值），
							 * 否则会出现「报告 1 份、通过 3 条」这种对不上的数字。
							 */
							(function () {
								var allRuns = [];
								rows.forEach(function (record) {
									(Array.isArray(record.records) ? record.records : []).forEach(function (run) {
										if (run && run.source === "all") allRuns.push(run);
									});
								});
								return [
									h("span", { key: "total" }, "报告 ", h("b", null, String(allRuns.length)), " 份"),
									h("span", { key: "pass" }, "通过 ", h("b", null, String(allRuns.filter(function (run) { return run.result === "pass"; }).length)), " 条"),
									h("span", { key: "fail" }, "未通过 ", h("b", null, String(allRuns.filter(function (run) { return run.result !== "pass"; }).length)), " 条")
								];
							})(),
							/*
							 * ⏸ 暂时注释掉「多选」按钮（2026-11-25 用户要求）。
							 * 批量导出这一套先不用，以后要恢复就把下面这段的
							 * 注释符号去掉即可（多选态的渲染逻辑都还在，没删）。
							 */
							// h("button", {
							// 	type: "button",
							// 	className: "it-multi-enter",
							// 	"data-it": "multi-enter",
							// 	onClick: function () { setMultiSelect(true); }
							// }, "多选")
						),
					groups.length === 0
						? h("div", { className: "it-empty" },
							h("div", { className: "it-empty-title" }, "当前还没有测试报告"),
							h("div", { className: "it-empty-hint" }, "在「测试步骤」页点「一键执行」，跑完就会在这里生成报告。"))
						: h("div", { className: "it-card is-report", "data-it": "report-card" },
							h("div", { className: "it-report-groups" }, visibleGroups.map(function (group) {
							/*
							 * 每个分组各自分页：页码按组名存，互不影响。
							 * （图 4 里每组都有自己的独立分页条。）
							 */
							var groupTotal = group.records.length;
							var groupPages = Math.max(1, Math.ceil(groupTotal / pageSize));
							var groupPage = Math.min(Math.max(1, (reportPageMap[group.name] || 1)), groupPages);
							var groupStart = (groupPage - 1) * pageSize;
							var visible = group.records.slice(groupStart, groupStart + pageSize);
							var open = expandedGroups.indexOf(group.name) !== -1;
							var groupIds = group.records.map(function (r) { return r.id; });
							var groupChecked = groupIds.length > 0 && groupIds.every(function (id) { return selected.indexOf(id) !== -1; });

							return h("section", { key: group.name, className: "it-report-group", "data-it": "report-group-" + group.name },
								h("div", { className: "it-report-head" },
									multiSelect
										? h("span", {
											className: cn("it-filter-box", groupChecked ? "is-on" : ""),
											role: "checkbox",
											"aria-checked": groupChecked,
											"data-it": "group-check-" + group.name,
											onClick: function () { toggleGroup(groupIds); }
										}, groupChecked ? h(Icon, { name: "check", size: 11 }) : null)
										: null,
									h("button", {
										type: "button",
										className: cn("it-report-toggle", open ? "" : "is-collapsed"),
										"aria-expanded": open,
										"data-it": "report-toggle-" + group.name,
										onClick: function () {
											setExpandedGroups(function (previous) {
												return previous.indexOf(group.name) === -1
													? previous.concat([group.name])
													: previous.filter(function (item) { return item !== group.name; });
											});
										}
									},
										h("span", { className: "it-report-caret" }, h(Icon, { name: "chevron", size: 13 })),
										h("span", { className: "it-report-name" }, group.name),
										h("span", { className: "it-report-badge" }, String(group.reports) + " 条报告")
									),
									h("span", { className: "it-report-sum" },
										"通过 ", h("b", null, String(group.passed)),
										" / 失败 ", h("b", null, String(group.failed))
									)
								),
								open
									? h(React.Fragment, null,
										h("div", { className: "it-table-wrap" },
											h("table", { className: "it-table", "data-it": "reports-table" },
												h("thead", null,
													h("tr", null,
														multiSelect ? h("th", { style: { width: "40px" } }, "") : null,
														h("th", { style: { width: "210px" } }, "测试用例标识"),
														h("th", null, "用例名称"),
														h("th", { style: { width: "86px" } }, "测试类型"),
														h("th", { style: { width: "72px" } }, "执行结果"),
														h("th", { style: { width: "96px" } }, "测试时间"),
														h("th", { style: { width: "78px" } }, "操作")
													)
												),
												h("tbody", null, visible.map(function (record, index) {
													var meta = IT_STATUS[record.status] || IT_STATUS.none;
													var first = (record.steps || [])[0];
													var checked = selected.indexOf(record.id) !== -1;
													/*
													 * 报告页显示的是**一键执行**那一条记录的结果与时间，
													 * 不能直接用 record.status（那是含单步执行在内的汇总值）。
													 */
													var allRuns = (Array.isArray(record.records) ? record.records : []).filter(function (run) {
														return run && run.source === "all";
													});
													var shownRun = allRuns[0] || null;
													if (shownRun) {
														meta = IT_STATUS[shownRun.result] || IT_STATUS.none;
													}
													return h("tr", { key: record.id, "data-case-row": record.id },
														multiSelect
															? h("td", null,
																h("span", {
																	className: cn("it-filter-box", checked ? "is-on" : ""),
																	role: "checkbox",
																	"aria-checked": checked,
																	"data-it": "row-check-" + record.id,
																	onClick: function () { toggleOne(record.id); }
																}, checked ? h(Icon, { name: "check", size: 11 }) : null)
															)
															: null,
														h("td", null, h("span", { className: "it-case-id" }, caseLabel(record))),
														h("td", { className: "it-left" },
															h("button", {
																type: "button",
																className: "it-name-btn",
																title: record.title,
																"data-it": "view-" + record.id,
																onClick: function () { setDetail({ mode: "view", record: record }); }
															}, record.title || "—")
														),
														h("td", null, itTypePill(record.type)),
														h("td", null, h("span", { className: "it-pill", "data-tone": meta.tone }, meta.label)),
														h("td", null, itDate(shownRun ? shownRun.at : record.lastRunAt)),
														h("td", null,
															h("div", { className: "it-ops" },
																h(IconButton, { name: "eye", label: "查看报告 " + (record.title || ""), "data-it": "report-" + record.id, onClick: function () { viewLatestReportOfCase(record); } }),
																h(IconButton, { name: "download", label: "导出报告 " + (record.title || ""), "data-it": "export-" + record.id, onClick: function () { exportLatestReportOfCase(record); } })
															)
														)
													);
												}))
											)
										),
										/* 组内分页（图 5 的形态）：共 N 条，每页 [15条/页] ‹ 1 › */
										groupTotal > 0
											? h("div", { className: "it-sub-pager" },
												h("span", { className: "it-sp-total" }, "共 " + groupTotal + " 条，每页"),
												h("select", {
													className: "it-sp-select",
													value: String(pageSize),
													"data-it": "report-page-size",
													onChange: function (event) {
														var next = Number(event.target.value);
														setPageSize(next > 0 ? next : 15);
														setReportPageMap({});
													},
													"aria-label": "每页条数"
												}, [15, 30, 50, 100].map(function (n) {
													return h("option", { key: n, value: String(n) }, n + "条/页");
												})),
												h("button", {
													type: "button",
													className: "it-sp-btn",
													disabled: groupPage <= 1,
													"data-it": "report-page-prev",
													onClick: function () {
														if (groupPage > 1) setReportPageMapSet(group.name, groupPage - 1);
													}
												}, h(Icon, { name: "chevron", size: 11, style: { transform: "rotate(180deg)" } })),
												h("button", {
													type: "button",
													className: "it-sp-page is-active",
													onClick: function () {
														if (groupPage < groupPages) setReportPageMapSet(group.name, groupPage + 1);
													}
												}, String(groupPage)),
												h("button", {
													type: "button",
													className: "it-sp-btn",
													disabled: groupPage >= groupPages,
													"data-it": "report-page-next",
													onClick: function () {
														if (groupPage < groupPages) setReportPageMapSet(group.name, groupPage + 1);
													}
												}, h(Icon, { name: "chevron", size: 11 }))
											)
											: null
									)
									: null
							);
							})),
								// 外层分页：只控制功能项分组；组内分页不变。复用同一套分页条。
								pager(groups, reportGroupPage, setReportGroupPage, "report-groups-pager", reportGroupSize, setReportGroupSize, "个功能项")
							)
				);
			}

			var body = tab === "steps" ? stepsView() : (tab === "reports" ? reportsView() : casesView());

			var TAB_LABELS = { cases: "测试用例", steps: "测试步骤", reports: "测试报告" };
			var TAB_COUNTS = {
				cases: records.length,
				steps: records.reduce(function (sum, record) { return sum + itStepCount(record); }, 0),
				/*
				 * 报告数只算**一键执行**产生的记录（source === "all"）。
				 *
				 * 单步执行的记录留在步骤页子表里，不进报告页 —— 所以这里也不能把它们
				 * 算进「测试报告」的数字，否则会看到「60 条用例却 63 份报告」这种虚高。
				 * 与 reportsView() 的过滤条件必须保持一致。
				 */
				reports: records.reduce(function (sum, record) {
					var runs = Array.isArray(record.records) ? record.records : [];
					return sum + runs.filter(function (run) { return run && run.source === "all"; }).length;
				}, 0)
			};

			return h("div", {
				className: cn("it-root dp-root", props.narrow === true ? "is-narrow" : "", props.dock === true ? "dp-docked" : "", tab === "reports" ? "is-report-tab" : ""),
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
							// 集成测试页面没有按执行状态搜索，保持原提示文案。
							placeholder: "搜索用例名称 / 用例标识 / 测试说明",
							onChange: function (event) {
								setQuery(event && event.target ? event.target.value : "");
								resetPages();
							},
							eventStyle: true,
							"data-it": "search",
							label: "搜索集成测试用例",
							placeholder: "搜索标识、名称、说明或场景"
						}),
						h("div", { className: "it-switch", "data-dropdown": "switch" },
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
							/*
							 * 三个子页的版本**不是同一套编号**：
							 *   · 测试用例 / 测试步骤 → 用例版本（case-versions）
							 *   · 测试报告           → 报告版本（report-versions，每次一键执行 +1）
							 * 所以下拉的数据源与按钮文字都要按当前子页取，不能共用一个 `version`。
							 * 这正是用户第 7 点「第二次一键执行后报告页还是 V0.0.1」的根因。
							 */
							(function () {
								var isReportTab = tab === "reports";
								/*
								 * 报告版本数据存在时，报告页用自己那套编号；
								 * 不存在时（旧会话 / 还没一键执行过）退回用例版本选择器 ——
								 * 宁可沿用旧行为，也不要给用户一个空掉的下拉。
								 */
								var hasReportVersions = isReportTab
									&& Array.isArray(reportVersions)
									&& reportVersions.length > 0;
								var list = hasReportVersions ? reportVersions : seed.versions;
								var current = hasReportVersions ? (reportVersion || "") : version;
								var pick = function (name) {
									if (hasReportVersions) {
										setReportVersion(name);
										// 报告页只做展示，切版本后回到第 1 页、收起分组
										setReportPage(1);
										setReportPageMap({});
										setExpandedGroups([]);
										return;
									}
									setVersion(name);
									// 换版本是一整套新数据，页码和分组展开态都重置
									setCasePage(1);
									setStepPage(1);
									setReportPage(1);
									setExpandedGroups([]);
								};
								var sorted = (Array.isArray(list) ? list : [])
									.slice()
									.sort(function (a, b) {
										return itVersionValue(b.name) - itVersionValue(a.name);
									});
								return h("div", { className: "it-version", "data-dropdown": "version" },
									h("button", {
										type: "button",
										ref: versionBtnRef,
										className: "it-version-btn",
										"data-it": "version-menu",
										title: hasReportVersions ? "切换报告版本" : "切换用例版本",
										onClick: function () { setVersionOpen(!versionOpen); }
									},
										h("span", null, current === "" ? (hasReportVersions ? "暂无报告版本" : "V0.0.1") : current),
										h("span", { className: "it-switch-caret" }, h(Icon, { name: "chevron", size: 11 }))
									),
									h(ItMenu, {
										open: versionOpen,
										anchorRef: versionBtnRef,
										align: "right",
										width: 186,
										maxHeight: 158,
										testId: "version-menu-panel"
									},
										sorted.length === 0
											? h("div", { className: "it-version-empty" }, hasReportVersions ? "还没有报告版本" : "还没有用例版本")
											: sorted.map(function (item) {
												var isCurrent = item.name === current;
												return h("button", {
													key: item.name,
													type: "button",
													className: cn("it-version-item", isCurrent ? "is-active" : ""),
													"data-it": "version-" + item.name,
													onClick: function () {
														pick(item.name);
														setVersionOpen(false);
													}
												},
													h("span", { className: "it-version-name" }, item.name),
													isCurrent ? h("span", { className: "it-version-current" }, "当前") : null,
													h("span", { className: "it-version-meta" }, itTime(item.at))
												);
											})
									)
								);
							})(),
							/*
							 * 主操作按子页给不同的东西：
							 *   测试用例 —— 新增用例（primary，唯一的颜色强调）+ 生成测试步骤
							 *   测试步骤 —— 一键执行
							 *   测试报告 —— 总体报告（汇总视图）
							 */
							tab === "reports"
								? h(Button, {
									variant: "ghost",
									"data-it": "overview",
									/*
									 * 「总体报告」直接开 tab 页展示整项目那份 Word 报告。
									 *
									 * 用户的要求是「打开一个 tab 页」，不是在弹窗里看一份 HTML 汇总：
									 * 真正的总体报告是按配置项测试模板整体排版、含所有用例步骤表汇总的
									 * 那份 docx，只有打开它才能看到完整内容。
									 *
									 * 弹窗（IntegrationOverview）保留为「选择纳入范围」的辅助入口，
									 * 但主入口直接开报告。
									 */
									onClick: function () { openOverallReport(records); }
								}, "总体报告")
								: null,
							/*
							 * 总体报告的「导出」：常驻在「总体报告」右边。
							 *
							 * 一开始做成了「点过总体报告才出现」，但那是错的：
							 * 点「总体报告」会把 PDF 开在**主区域的新 tab**，主面板被切走，
							 * 用户根本看不到这个按钮（2026-11-20 用户截图反馈）。
							 * 所以改成常驻 —— 什么时候切回主面板，它都在那儿。
							 *
							 * 导出的是**整项目那一份** docx（kind === "overall"），
							 * 不是某条用例的单条报告。
							 */
							tab === "reports"
								? h(Button, {
									variant: "ghost",
									"data-it": "overview-export",
									onClick: function () { exportOverallReport(records); }
								},
									h(Icon, { name: "download", size: 15 }),
									"导出"
								)
								: null,
							tab === "cases"
								? h(Button, {
									variant: "ghost",
									"data-it": "generate-steps",
									onClick: function () { generateSteps(); }
								}, "生成测试步骤")
								: null,
							tab === "steps"
								? h(Button, {
									variant: "ghost",
									"data-it": "run-steps",
									onClick: function () { runAllIntegrationPrompt(); }
								}, "一键执行")
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
					notice !== ""
						? h("div", { className: "it-notice", "data-it": "notice" },
							h("span", { className: "it-notice-text" }, notice),
							/*
							 * 关闭按钮：提示条只是旁白，看过了就该能收起。
							 * 没有它时，一句「已刷新…」会一直挂在那儿直到下一次操作覆盖，
							 * 用户会以为界面卡住了。
							 */
							h("button", {
								type: "button",
								className: "it-notice-close",
								"data-it": "notice-close",
								title: "关闭提示",
								"aria-label": "关闭提示",
								onClick: function () { setNotice(""); }
							}, h(Icon, { name: "close", size: 13 }))
						)
						: null,
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
							// 功能项下拉的可选项：由现有用例聚合而来（不含「全部用例」这个虚拟项）。
							scenarios: scenarios
								.map(function (row) { return row.name; })
								.filter(function (name) { return name !== IT_SCENARIOS_ALL; }),
							onSave: saveCase,
							onClose: function () { setDetail(null); }
						}))
					: null,
				// 项目总体报告：弹窗。
				overview
					? h(IntegrationOverview, {
						records: records,
						onClose: function () { setOverview(false); },
						onNotice: setNotice,
						/*
						 * 总体报告的「导出」：打开**整项目那份**报告（按配置项测试模板
						 * 整体排版、含所有用例步骤表汇总），不是某条用例的单条报告。
						 */
						onExport: function (shown) { exportOverallReport(shown); }
					})
					: null,
				// 新建功能项：弹窗。
				featurePrompt !== null
					? h(FeaturePrompt, {
						onSubmit: createFeature,
						onClose: function () { setFeaturePrompt(null); }
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
				"本次测试结束后，对异常按 Skill 写 runs/<runId>/analysis.md：记录用例编号、真实异常、证据位置、已确认或推测原因及建议。不要改写 run.log 或 result.json；不要因此中途暂停确认或自动修复，日志窗口会单独标注模型分析。",
				"提醒：本次执行使用磁盘上的测试代码，请注意它与当前用例信息保持一致；此提醒无需确认，不增加执行前检查或暂停。",
				"1. 原样执行上面的命令，不要新建或修改测试文件，也不要改成跑别的用例。",
				"2. 跑完后先按 Skill 的 Step 6，用本次 runId 生成 Word 报告到 reports/<runId>/（单条执行也要，文件名带 caseId）；如果项目还没配置报告模板，就明确告诉我缺什么，不要跳过不说。然后再总结。",
				"3. 总结时用一两句话说明：通过还是失败、失败的是哪条用例、失败原因是什么。",
				"4. 如果命令本身起不来（找不到运行时、测试文件缺失、权限问题），把报错原文告诉我，不要自己另找测试文件重跑。",
				"5. 如果命令告诉你“测试文件在准备后被修改”，停下来告诉我要重新点一次执行，不要自己重跑。",
				"用例与测试代码的一致性核对只在本次全部测试执行结束、按原流程处理报告后进行，结果仅写在最终对话总结中。不要因此中途暂停、要求确认、修改用例或代码，也不要修改 runner 的测试结果或报告数据。",
				"核对本次会话资产目录 " + prep.root + " 下 runs/" + prep.runId + "/request.json 指定的 casesFile 与 snapshotTestFile，按 caseId 和 testFunc 对照输入、预期结果、测试场景与实际断言，不要拿后来修改的文件代替本次快照。",
				"有明确证据不一致时，最终对话逐条列出用例编号、用例要求和测试代码的具体差异，并说明可能导致测试结果不能准确反映当前用例要求。无法读取快照或无法判断时明确说未能确认一致性；没有发现明显差异时如实说明，不把测试通过当作一致性证明，不编造问题清单。"
			];
			if (Array.isArray(prep.missingTestFunc) && prep.missingTestFunc.length > 0) {
				lines.push("6. 注意：以下用例没有关联测试函数/测试名，这次不会被执行：" + prep.missingTestFunc.join("、"));
			}
			if (Array.isArray(prep.scopeWarnings) && prep.scopeWarnings.length > 0) {
				lines.push("测试范围提醒（不暂停本次执行，不要求中途确认）：" + prep.scopeWarnings.slice(0, 20).join("；") + (prep.scopeWarnings.length > 20 ? "；另有 " + (prep.scopeWarnings.length - 20) + " 项，见本次 request.json 的 testScope.warnings" : "") + "。完成后结合 request/result 中的 testScope 明确实际测试范围，不得将本次结果宣称为全工程全部通过。");
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

		/**
		 * 「执行选中」的执行指令。
		 *
		 * 与「全部」的区别只在措辞：这里明确说是本次勾选的那些，避免 AI 误以为要跑全量。
		 * 命令同样由宿主拼好，只包含这些用例的测试函数。
		 */
		function runPickedPrompt(records, sessionId, prep) {
			var list = Array.isArray(records) ? records : [];
			if (list.length === 0) {
				return ["没有选中的用例。"].join("\n");
			}
			var named = list.map(function (record) {
				return "- " + record.caseId + "（" + record.title + "）";
			});
			return [
				"请执行本次选中的 " + list.length + " 条用例（不是全部）：",
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

		/**
		 * 从报告目录里挑一份 docx。
		 *
		 * 一键执行的目录里同时有「总体报告」和「每条用例的单条报告」：
		 *   overall → 文件名含「整项目」，按配置项测试模板整体排版
		 *   case    → 放在 cases/ 子目录，文件名含 caseId，只含 4.1.1 那张表
		 *
		 * 面板的「查看报告」要打开的永远是**这条用例的单条报告**（用户明确要求：
		 * 单条报告只看那一张表）。所以这里优先按 caseId 匹配文件名，
		 * 匹配不到再退到 kind === 'case' 的任意一份，最后才退到 overall。
		 *
		 * @param detail  /data-panel/run/report 的返回
		 * @param caseId  想要哪条用例的报告（空串表示不挑，取第一份）
		 */
		function docxFor(detail, caseId) {
			if (!detail || !Array.isArray(detail.files)) return null;
			var files = detail.files.filter(function (file) {
				return file && typeof file.name === "string" && /\.docx$/i.test(file.name) && file.path;
			});
			if (files.length === 0) return null;
			var wanted = typeof caseId === "string" ? caseId.trim() : "";

			// ① 文件名里带 caseId 的那份（最准）
			if (wanted !== "") {
				var exact = files.filter(function (file) { return file.name.indexOf(wanted) !== -1; });
				if (exact.length > 0) return exact[0];
			}
			// ② 子目录里的单条报告（有多份时取第一份，但**绝不退到 overall**）
			var singles = files.filter(function (file) { return file.kind === "case"; });
			if (singles.length > 0) return singles[0];
			// ③ 总体报告（only overall 的场景）
			var overall = files.filter(function (file) { return file.kind === "overall"; });
			if (overall.length > 0) return overall[0];
			// ④ 兜底：第一份
			return files[0];
		}

		/** 优先把报告开在右侧栏（PDF / docx 都交给 DSH 的文档预览）。 */
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

		/** PDF 转换在宿主侧最多 90 秒，前端给 120 秒；不走 callApi 默认的 8 秒。 */
		var REPORT_PDF_TIMEOUT_MS = 120000;

		/**
		 * 取报告同目录的 PDF（宿主用 Word / LibreOffice 转换，按 docx 时间缓存）。
		 *
		 * 只有右侧栏确实能把文件交给 DSH 文档预览时才值得转；否则直接返回 null，
		 * 让调用方走原来的 docx / 系统默认程序链路，避免白等一次转换。
		 */
		function requestReportPdf(path, sessionId) {
			if (typeof path !== "string" || path === "" || typeof sessionId !== "string" || sessionId === "") {
				return Promise.resolve(null);
			}
			var service = betterSidebarService(true);
			// betterSidebar 不可用就没有右侧栏可开，直接回退 docx（不报错）。
			if (service === null || typeof service.openFile !== "function") return Promise.resolve(null);
			return callApi("/data-panel/report/pdf", {
				method: "POST",
				headers: { "content-type": "application/json", accept: "application/json" },
				body: JSON.stringify({ sessionId: sessionId, cwd: cwdOf(sessionId), path: path }),
			}, REPORT_PDF_TIMEOUT_MS).then(function (data) {
				if (data && data.ok === true && typeof data.path === "string" && data.path !== "") return data.path;
				return null;
			}).catch(function (failure) {
				// 没装 Word / LibreOffice 或转换失败只是“没有 PDF”，不是“报告打不开”。
				try {
					console.info("[dsh-data-panel] PDF 预览不可用，回退 docx：" + (failure && failure.message ? failure.message : String(failure)));
				} catch (ignored) {}
				return null;
			});
		}

		/** 打开报告：先尝试同目录 PDF，失败/不可用时完整回退原来的 docx 链路。 */
		function openReportFile(path, sessionId, onOpened) {
			if (typeof path !== "string" || path === "") {
				store.setError("报告文件路径为空");
				return Promise.resolve();
			}
			return requestReportPdf(path, sessionId).then(function (pdfPath) {
				if (pdfPath !== null && openReportInSidebar(pdfPath, sessionId)) {
					if (typeof onOpened === "function") onOpened();
					return;
				}
				openReportDocx(path, sessionId, onOpened);
			});
		}

		/** 原来的 docx 打开链路：右侧栏优先，失败再交给宿主用系统默认程序打开。 */
		function openReportDocx(path, sessionId, onOpened) {
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
			IntegrationStepsModal: IntegrationStepsModal,
			IntegrationOverview: IntegrationOverview,
			itLatestResult: itLatestResult,
			itVersionValue: itVersionValue,
			DetailView: DetailView,
			DetailEditor: DetailEditor,
			TestTypeChecks: TestTypeChecks,
			displayRunLog: displayRunLog,
			runSummaryKey: runSummaryKey,
			updateCaseStatus: updateCaseStatus,
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
			FeaturePrompt: FeaturePrompt,
			EmptyState: EmptyState,
			// 集成测试演示：壳、页签与各层组件。
			TestPanelHost: TestPanelHost,
			TestModeTabs: TestModeTabs,
			IntegrationPanel: IntegrationPanel,
			IntegrationCaseEditor: IntegrationCaseEditor,
			IntegrationStepsEditor: IntegrationStepsEditor,
			IntegrationOverview: IntegrationOverview,
			itLatestResult: itLatestResult,
			itVersionValue: itVersionValue,
			buildIntegrationSeed: buildIntegrationSeed,
				docxFor: docxFor,
			openReportFile: openReportFile,
			openReportDocx: openReportDocx,
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
