"""集成测试数据契约校验器 —— 把「散文规则」变成「可执行断言」。

为什么需要这个脚本
------------------
Skill 里原有 19 条「重要规则」和 3 条「最容易犯的错」，全是散文。实测证明：
散文写三遍、带反例，执行者照样会违反 —— 因为它**没有可执行的自检动作**，
做的时候想不起来，做完也没法验证。这个脚本把这些规则变成一条命令：
跑一次，PASS 才能宣告完成。

实测踩过的坑（每一条都变成了这里的检查项）
------------------------------------------
1. `features.json` 缺 `id`/`code`，自拟 `featureId`/`moduleEn`
2. `cases.json` 的用例缺 `id`（面板按 id 认行，缺了「展开一行全展开」）
3. `runner.json` 根本没写（Skill 只说「与单元测试一致」，于是靠猜）
4. `result.json` 写成 `tests[]`，而 `bridge.py` 要的是 `steps[]`
   —— 执行者被迫「打派生视图补丁才跑通报告管线」
5. 执行记录按**步骤**粒度写（3 步用例写 3 条），契约要求**用例级每 run 一条**
6. `steps.json` 暴露 `func`/`codeFile`（测试函数名、代码文件），违反铁律
7. 报告版本号手工硬编码 V0.0.1，没走面板分配

用法
----
    python check_contract.py --root <会话集成根目录> [--step-version V0_0_1] [--run <runId>]

    --root  形如 <项目>/.dsh/test-sessions/<SID>/integration
    脚本自动发现最新的用例版本 / 步骤版本 / run，也可以用参数指定。

退出码：0 = 全部通过；1 = 有 FAIL（打印清单）；2 = 参数或环境错误。
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ─────────────────────────── 契约定义 ───────────────────────────
# 这些字段是照「真实跑通的数据」抄的，不是想象的：
#   <项目>/.dsh/test-sessions/<SID>/integration/case-versions/V0_0_1/cases.json
# 改动任何一条前，先确认面板代码（lib/client.js 的 normalizeCaseList）读的也是这些名字。

FEATURE_REQUIRED = ["id", "code", "name"]
FEATURE_OPTIONAL = ["description", "source", "stage"]

CASE_REQUIRED = ["caseId", "featureId", "title", "type"]
CASE_OPTIONAL = ["id", "caseCode", "description", "precondition", "expectedResult", "steps"]

STEP_REQUIRED = ["no", "action", "operation", "expected"]
STEP_OPTIONAL = ["target", "channel"]

# runner.json：跑测试代码的那 5 类必须有
RUNNER_REQUIRED_ANY = [["preset"], ["testFile", "command"]]

# result.json：bridge.py 逐条读这些（见 integrationReport/bridge.py 的 load_execution）
# ★ 历史上最大的坑：runner 原生输出 tests[]，而这里要 steps[]。
RESULT_REQUIRED = ["runId", "steps"]
RESULT_STEP_REQUIRED = ["caseId", "stepNo", "channel", "outcome"]

# 执行记录（挂在 steps.json 的 cases[].records）：只能有这 5 个字段
RECORD_ALLOWED = ["runId", "at", "result", "durationMs", "source"]

# 铁律：界面/API/报告只出现步骤，不出现测试函数名与代码文件
FORBIDDEN_IN_STEPS = ["func", "codeFile", "codeRef", "code", "testFunc"]

VALID_TYPES = {"functional", "performance", "boundary", "api", "security", "margin"}
BANNED_TYPES = {"stress"}
# ★ 集成测试的枚举固定是 7 类（`stress` 本轮禁止），**不能混入单元测试的 `logic`**。
#   踩过：这里以前写成 {..., "logic"}，于是把单元测试类型写进集成用例也能 PASS，
#   7 类判定标准形同虚设。集成测试只有这 6 类可用（stress 走 BANNED_TYPES 单独拦）。

# ★ outcome / result 的合法值都来自**代码**，不是想象：
#   · bridge.py 的 OUTCOME_CONCLUSION：passed / failed / error / notRun / unconfirmed
#   · 面板 client.js 只判断 result === "pass"，其余算未通过；steps.json 里实测也出现 fail
# 这两套枚举不一样，校验时各按各的，不要强行统一 —— 它们服务于不同消费者。
VALID_OUTCOMES = {"passed", "failed", "error", "notRun", "unconfirmed", "blocked", "unknown"}
VALID_RESULTS = {"pass", "fail", "failed", "error", "notRun", "aborted", "unconfirmed"}

# ★ 快照文件名是 cases.snapshot.json，不是 cases.json（实测）
SNAPSHOT_FILES = ["steps.json", "cases.snapshot.json"]

CASE_ID_RE = re.compile(r"^V\d+_\d+_\d+-IT-\d{3,}$")


class Report:
    def __init__(self):
        self.fails = []
        self.warns = []
        self.oks = []

    def fail(self, where, message):
        self.fails.append((where, message))

    def warn(self, where, message):
        self.warns.append((where, message))

    def ok(self, message):
        self.oks.append(message)

    def dump(self):
        for message in self.oks:
            print("  PASS  " + message)
        for where, message in self.warns:
            print("  WARN  [%s] %s" % (where, message))
        for where, message in self.fails:
            print("  FAIL  [%s] %s" % (where, message))
        print("")
        if self.fails:
            print("结果：FAIL（%d 条不通过，%d 条警告）" % (len(self.fails), len(self.warns)))
            return 1
        print("结果：PASS（%d 项检查通过，%d 条警告）" % (len(self.oks), len(self.warns)))
        return 0


def load_json(path, report, label):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        report.fail(label, "文件不存在：%s" % path)
    except json.JSONDecodeError as error:
        report.fail(label, "不是合法 JSON：%s（%s）" % (path, error))
    return None


def latest_version(root, kind):
    """取某个 kind 下版本号最大的目录名。"""
    base = Path(root) / kind
    if not base.is_dir():
        return ""
    names = [p.name for p in base.iterdir() if p.is_dir()]
    if not names:
        return ""

    def key(name):
        nums = re.findall(r"\d+", name)
        return tuple(int(n) for n in nums) if nums else (0,)

    return sorted(names, key=key)[-1]


def check_keys(items, required, optional, where, report, label_field):
    """逐项检查字段：缺必填就 FAIL，多出未声明字段就 WARN（提示自拟）。"""
    missing_required = set()
    extra = set()
    for item in items:
        for key in required:
            if key not in item or item[key] in ("", None, []):
                missing_required.add(key)
        for key in item:
            if key not in required and key not in optional:
                extra.add(key)
    if missing_required:
        report.fail(where, "%s 缺少必填字段：%s" % (label_field, ", ".join(sorted(missing_required))))
    else:
        report.ok("%s 必填字段齐全（%s）" % (where, ", ".join(required)))
    if extra:
        report.warn(where, "出现契约外字段（疑似自拟）：%s" % ", ".join(sorted(extra)))


# ─────────────────────────── 各项检查 ───────────────────────────

def check_features(doc, report):
    where = "features.json"
    if not isinstance(doc, list):
        report.fail(where, "顶层必须是数组，实际是 %s" % type(doc).__name__)
        return []
    if not doc:
        report.fail(where, "功能项为空")
        return []
    check_keys(doc, FEATURE_REQUIRED, FEATURE_OPTIONAL, where, report, "功能项")

    # ★ stage 必须是必填：报告完全按 stage 分章。
    #   生成用例时没有 stage，整份报告只能退化成「全是第一阶段」，事后无法补救。
    no_stage = [str(f.get("code") or f.get("id")) for f in doc
                if isinstance(f, dict) and str(f.get("stage") or "").strip() == ""]
    if no_stage:
        report.fail(where, "功能项缺 stage（报告按它分章，事后无法补救）：%s"
                    % ", ".join(no_stage[:6]))
    else:
        stages = {str(f.get("stage")).strip() for f in doc if isinstance(f, dict)}
        report.ok("功能项都带 stage（%d 个阶段：%s）" % (len(stages), " / ".join(sorted(stages))))
        # 阶段太少会让报告退化成一章，太多则失去分层意义。1-4 是合理区间。
        if len(stages) > 4:
            report.warn(where, "阶段数 %d 偏多（建议 3-4 个）" % len(stages))

    ids = [f.get("id") for f in doc if isinstance(f, dict)]
    if len(ids) != len(set(ids)):
        report.fail(where, "功能项 id 有重复")
    codes = [f.get("code") for f in doc if isinstance(f, dict)]
    if len(codes) != len(set(codes)):
        report.fail(where, "功能项 code 有重复")
    return ids


def check_cases(doc, feature_ids, report, feature_stage=None):
    where = "cases.json"
    if not isinstance(doc, list):
        report.fail(where, "顶层必须是数组，实际是 %s" % type(doc).__name__)
        return []
    if not doc:
        report.fail(where, "用例为空")
        return []
    check_keys(doc, CASE_REQUIRED, CASE_OPTIONAL, where, report, "用例")

    feature_stage = feature_stage or {}
    case_ids, bad_prefix, bad_type, orphan, no_id = [], [], [], [], []
    no_stage_case, stage_mismatch = [], []
    for item in doc:
        if not isinstance(item, dict):
            continue
        cid = str(item.get("caseId") or "")
        case_ids.append(cid)
        if not CASE_ID_RE.match(cid):
            bad_prefix.append(cid)
        if not isinstance(item.get("id"), str) or item.get("id") == "":
            no_id.append(cid)
        t = item.get("type")
        if t in BANNED_TYPES:
            bad_type.append("%s(stress 本轮禁止)" % cid)
        elif t not in VALID_TYPES:
            bad_type.append("%s(%s)" % (cid, t))
        fid = item.get("featureId")
        if feature_ids and fid not in feature_ids:
            orphan.append("%s→%s" % (cid, fid))
        # 用例要继承所属功能项的 stage：单条报告也靠它显示阶段
        if str(item.get("stage") or "").strip() == "":
            no_stage_case.append(cid)
        elif feature_stage and fid in feature_stage and str(item.get("stage")).strip() != feature_stage[fid]:
            stage_mismatch.append("%s(%s≠%s)" % (cid, item.get("stage"), feature_stage[fid]))

    if len(case_ids) != len(set(case_ids)):
        report.fail(where, "caseId 有重复")
    if bad_prefix:
        report.fail(where, "caseId 格式不对（应为 V0_0_1-IT-001）：%s" % ", ".join(bad_prefix[:5]))
    if bad_type:
        report.fail(where, "测试类型非法：%s" % ", ".join(bad_type[:5]))
    if orphan:
        report.fail(where, "用例的 featureId 在 features.json 里找不到：%s" % ", ".join(orphan[:5]))
    if no_id:
        report.warn(where, "用例缺 id（面板会用 caseId 兜底，但规范要求写）：%d 条" % len(no_id))
    # ★ 用例必须继承功能项的 stage（单条报告靠它显示阶段）
    if no_stage_case:
        report.fail(where, "用例缺 stage（应继承所属功能项的 stage，单条报告靠它显示）：%d 条，如 %s"
                    % (len(no_stage_case), ", ".join(no_stage_case[:3])))
    else:
        report.ok("用例都继承了 stage")
    if stage_mismatch:
        report.warn(where, "用例 stage 与所属功能项不一致：%s" % ", ".join(stage_mismatch[:3]))
    return case_ids


def check_steps(doc, case_ids, report):
    where = "steps.json"
    if not isinstance(doc, dict):
        report.fail(where, "顶层必须是对象（{stepVersion, sourceCaseVersion, cases}）")
        return
    # ★ 必须是「分组式」：cases[] 里每条用例挂自己的 steps。
    #   扁平式（顶层 steps[] 或纯数组）面板读不到 → 测试步骤页整片空白。
    #   面板已加兼容兜底，但契约仍要求分组式，否则报告与统计都可能出错。
    if not isinstance(doc.get("cases"), list):
        hint = ""
        if isinstance(doc.get("steps"), list):
            hint = "（发现顶层 steps[] 扁平写法 —— 必须改成 cases:[{caseId, steps:[...]}]）"
        report.fail(where, "缺少 cases[] 分组结构%s" % hint)
        return
    for key in ("stepVersion", "sourceCaseVersion"):
        if key not in doc:
            report.fail(where, "缺少顶层字段 %s" % key)
    cases = doc.get("cases")
    if not cases:
        report.fail(where, "cases 必须是非空数组")
        return
    if case_ids:
        missing = [c.get("caseId") for c in cases if c.get("caseId") not in case_ids]
        if missing:
            report.fail(where, "步骤里的 caseId 在用例版本里找不到：%s" % ", ".join(map(str, missing[:5])))
        uncovered = set(case_ids) - {c.get("caseId") for c in cases}
        if uncovered:
            report.warn(where, "有 %d 条用例没有生成步骤" % len(uncovered))

    # 铁律：不许暴露测试函数名 / 代码
    leaked = set()
    record_violations = []
    step_missing = []
    for case in cases:
        if not isinstance(case, dict):
            continue
        for key in case:
            if key in FORBIDDEN_IN_STEPS:
                leaked.add("cases[]." + key)
        for step in case.get("steps") or []:
            if not isinstance(step, dict):
                continue
            for key in step:
                if key in FORBIDDEN_IN_STEPS:
                    leaked.add("steps[]." + key)
            for key in STEP_REQUIRED:
                if step.get(key) in ("", None):
                    step_missing.append("%s#%s 缺 %s" % (case.get("caseId"), step.get("no"), key))
        # 执行记录：字段白名单 + 粒度（每个 runId 只能一条）
        records = case.get("records") or []
        run_ids = []
        for rec in records:
            if not isinstance(rec, dict):
                continue
            extra = set(rec) - set(RECORD_ALLOWED)
            if extra:
                record_violations.append("%s 的记录多出字段 %s" % (case.get("caseId"), ", ".join(sorted(extra))))
            run_ids.append(rec.get("runId"))
            if rec.get("result") not in VALID_RESULTS:
                record_violations.append("%s 的 result 非法：%s" % (case.get("caseId"), rec.get("result")))
        dup = {r for r in run_ids if run_ids.count(r) > 1}
        if dup:
            record_violations.append("%s 同一 runId 有多条记录（应每 run 一条）：%s"
                                     % (case.get("caseId"), ", ".join(map(str, dup))))

    if leaked:
        report.fail(where, "★ 铁律违反：暴露了测试函数名/代码字段：%s" % ", ".join(sorted(leaked)))
    else:
        report.ok("steps.json 未暴露测试函数名/代码字段")
    if step_missing:
        report.fail(where, "步骤缺必填字段：%s" % "; ".join(step_missing[:5]))
    if record_violations:
        report.fail(where, "执行记录不合契约：%s" % "; ".join(record_violations[:5]))
    else:
        report.ok("执行记录字段与粒度合规（每用例每 run 一条，仅 %s）" % "/".join(RECORD_ALLOWED))


def check_runner(doc, report):
    where = "runner.json"
    if doc is None:
        return
    if not isinstance(doc, dict):
        report.fail(where, "顶层必须是对象")
        return
    if not any(all(k in doc for k in group) for group in RUNNER_REQUIRED_ANY):
        report.fail(where, "必须提供 preset，或 testFile，或 command")
    else:
        report.ok("runner.json 形态合法")
    if "testFile" not in doc and "command" not in doc:
        report.warn(where, "既没有 testFile 也没有 command，跑测试代码的 5 类将无法执行")


def check_result(doc, case_ids, step_case_index, report):
    where = "result.json"
    if doc is None:
        return
    if not isinstance(doc, dict):
        report.fail(where, "顶层必须是对象")
        return
    # ★ 最重要的一条：必须是 steps[]，不能是 tests[]
    if "steps" not in doc:
        hint = ""
        if "tests" in doc:
            hint = "（发现 tests[] —— bridge.py 要的是 steps[]，不能用 tests 代替）"
        report.fail(where, "缺少 steps[]{0}".format(hint))
        return
    for key in ("runId", "stepVersion"):
        if key not in doc:
            report.warn(where, "缺少顶层字段 %s" % key)

    # ★ project：报告「软件规模/编程语言/开发环境/运行环境」的唯一可靠来源。
    #   缺了 bridge.py 只能从会话目录往上猜，项目布局一旦不是
    #   `<项目>/.dsh/test-sessions/…` 就会猜错 → 报告四格全「未采集」。
    project = str(doc.get("project") or "").strip()
    if project == "":
        report.fail(where, "缺少 `project`（被测项目根目录）—— 报告里软件规模/编程语言/"
                           "开发环境/运行环境会全是「未采集」。请填源码根目录的绝对路径")
    else:
        try:
            if not Path(project).is_dir():
                report.warn(where, "`project` 指向的目录不存在：%s（软件信息探测会失败）" % project)
            else:
                report.ok("project 字段已写且目录存在：%s" % project)
        except Exception:
            report.warn(where, "`project` 路径无法解析：%s" % project)
    steps = doc.get("steps")
    if not isinstance(steps, list):
        report.fail(where, "steps 必须是数组")
        return
    bad = []
    for item in steps:
        if not isinstance(item, dict):
            continue
        for key in RESULT_STEP_REQUIRED:
            if item.get(key) in ("", None):
                bad.append("%s#%s 缺 %s" % (item.get("caseId"), item.get("stepNo"), key))
        if item.get("outcome") not in VALID_OUTCOMES:
            bad.append("%s#%s outcome 非法：%s" % (item.get("caseId"), item.get("stepNo"), item.get("outcome")))
        cid = item.get("caseId")
        if case_ids and cid not in case_ids:
            bad.append("%s 不在用例版本里" % cid)
        if step_case_index is not None and cid in step_case_index:
            nos = step_case_index[cid]
            if item.get("stepNo") not in nos:
                bad.append("%s 的 stepNo=%s 在 steps.json 里不存在" % (cid, item.get("stepNo")))
    if bad:
        report.fail(where, "逐步骤结果不合契约：%s" % "; ".join(bad[:5]))
    else:
        report.ok("result.json 的 steps[] 逐项字段合规（%d 条）" % len(steps))


def check_snapshot(root, run_id, report):
    where = "runs/%s/snapshot" % (run_id or "<runId>")
    if not run_id:
        report.warn(where, "没有指定 run，跳过快照检查")
        return
    snap = Path(root) / "runs" / run_id / "snapshot"
    if not snap.is_dir():
        report.fail(where, "快照目录不存在 —— 执行必须冻结快照，报告只认快照")
        return
    for name in SNAPSHOT_FILES:
        if not (snap / name).is_file():
            report.fail(where, "缺少快照文件 %s" % name)
    report.ok("执行快照存在（runs/%s/snapshot/）" % run_id)


def check_report_version(root, report, run_id):
    where = "report-versions"
    index_path = Path(root) / "report-versions" / "index.json"
    if not index_path.is_file():
        report.warn(where, "还没有报告版本（本次可能没生成报告）")
        return
    index = load_json(index_path, report, where)
    if not isinstance(index, dict):
        return
    versions = index.get("versions") or []
    if not versions:
        report.warn(where, "报告版本清单为空")
        return
    if run_id:
        hit = [v for v in versions if run_id in json.dumps(v, ensure_ascii=False)]
        if not hit:
            report.fail(where, "当前 runId(%s) 没有对应的报告版本 —— 报告版本必须由面板分配，不能手写 V0.0.1" % run_id)
        else:
            report.ok("报告版本由面板分配且对应本轮 runId")
    names = [v.get("name") for v in versions if isinstance(v, dict)]
    if len(names) != len(set(names)):
        report.fail(where, "报告版本号有重复")


def check_panel_index(root, kind, report):
    """检查某个页面的 index.json 字段名是否符合面板契约。

    ★ 2026-11-25 实测事故：报告 docx 生成成功，但测试步骤页、测试报告页全空，
    面板顶部显示「测试步骤 0 / 测试报告 0」。根因是手写的 index.json 用了
    自己想的字段名（`active` / `versions[].version`），而面板只认
    `versions[].name` + `activeVersion` —— 解析不到活动版本，数据返回 null。

    面板侧 `integration-store.js` 的 `readIndex()` 的行为：
      · `versions` 不是数组 → 整个 index 被丢弃，返回空结构
      · `activeVersion` 缺失   → 回退取 `versions[0].name`
      · `versions[].name` 缺失 → 拼不出目录名，该版本读不到数据

    这些错误**面板不报任何错，只是页面空白**，所以必须在这里拦住。
    """
    where = "%s/index.json" % kind
    index_path = Path(root) / kind / "index.json"
    if not index_path.is_file():
        report.warn(where, "还没有 index.json（面板没建过版本？）")
        return

    index = load_json(index_path, report, where)
    if not isinstance(index, dict):
        report.fail(where, "index.json 顶层必须是对象")
        return

    versions = index.get("versions")
    if not isinstance(versions, list):
        report.fail(where, "`versions` 必须是数组 —— 面板读不到版本，整页会空白")
        return
    if not versions:
        report.warn(where, "versions 为空")
        return

    # ① versions[].name —— 最容易写错成 version
    bad_name = []
    for item in versions:
        if not isinstance(item, dict):
            bad_name.append("(非对象)")
            continue
        if not isinstance(item.get("name"), str) or not item.get("name"):
            # 给出诊断：是不是写成了 version？
            if "version" in item:
                bad_name.append("%s(写成了 `version`，应为 `name`)" % item.get("version"))
            else:
                bad_name.append("(缺 name)")
    if bad_name:
        report.fail(where, "`versions[].name` 缺失或写错：%s —— 面板拼不出目录名，该版本读不到数据"
                    % ", ".join(bad_name[:5]))

    # ② activeVersion —— 写错成 active 时能否兜底
    active = index.get("activeVersion")
    if not isinstance(active, str) or not active:
        if "active" in index:
            report.fail(where, "`activeVersion` 写成了 `active` —— 字段名不符，面板会当成没有活动版本")
        else:
            report.warn(where, "缺 `activeVersion`（面板会回退取 versions[0].name，但建议显式写上）")
    else:
        names = [item.get("name") for item in versions if isinstance(item, dict)]
        if active not in names:
            report.fail(where, "`activeVersion=%s` 不在 versions[].name 里（可选值：%s）"
                        % (active, ", ".join(str(n) for n in names[:5])))

    report.ok("%s 字段名符合面板契约（versions[].name + activeVersion）" % where)


def check_exec_records(root, step_version, case_ids, run_id, report):
    """检查 exec-records.json —— **报告页能出一行的必要条件**。

    报告页的行数据不是读 `report.json`，而是读
    `step-versions/<V>/exec-records.json`（结构 `{ 步骤版本: { caseId: [记录] } }`，
    按 runId 关联 run 目录）。

    ★ 2026-11-25 实测事故：只生成了 docx 和 report.json，没生成 exec-records.json，
    报告页就是空的（顶部「报告 0 份」），尽管磁盘上 docx 已经存在。
    """
    where = "step-versions/%s/exec-records.json" % step_version if step_version else "step-versions/exec-records.json"
    if not step_version:
        return
    path = Path(root) / "step-versions" / step_version.replace(".", "_") / "exec-records.json"
    if not path.is_file():
        report.fail(where, "文件不存在 —— 报告页的行数据来自它，缺了报告页会空白（即使 docx 已生成）")
        return

    data = load_json(path, report, where)
    if not isinstance(data, dict) or isinstance(data, list):
        report.fail(where, "顶层必须是对象 { 步骤版本: { caseId: [记录] } }")
        return

    # 优先取当前步骤版本那一组。
    # ★ 键的写法有两种：`V0.0.1`（点，面板用 activeVersion 取值）
    #   与 `V0_0_1`（下划线，目录名）。step_version 可能是任一种形态，
    #   所以**两种写法都要试**，不能只按一种去匹配。
    candidates = [step_version, step_version.replace(".", "_"), step_version.replace("_", ".")]
    group = None
    for key in candidates:
        value = data.get(key)
        if isinstance(value, dict):
            group = value
            break
    if not isinstance(group, dict):
        # 摊平所有组
        merged = {}
        for value in data.values():
            if isinstance(value, dict):
                for cid, arr in value.items():
                    if isinstance(arr, list):
                        merged.setdefault(cid, []).extend(arr)
        group = merged
        if group:
            report.warn(where, "没有 `%s` 这一组，已摊平其他组（面板同样会摊平，但建议按版本分组）" % step_version)
    if not group:
        report.fail(where, "没有任何执行记录 —— 报告页会空白")
        return

    # 每条记录必须有 runId/at/result；同 runId 在一条用例下只能一条
    missing_field = []
    dup_run = []
    bad_source = []
    for cid, arr in group.items():
        if not isinstance(arr, list):
            continue
        run_ids = []
        for item in arr:
            if not isinstance(item, dict):
                continue
            for key in ("runId", "at", "result"):
                if not item.get(key):
                    missing_field.append("%s 缺 %s" % (cid, key))
            # ★ source 必须是 all / step —— 报告页只认 "all"，写成别的值
            #   （实测有人写成 "run"）记录会被静默筛掉，报告页空白也无报错。
            src = item.get("source")
            if src is None:
                bad_source.append("%s(缺 source)" % cid)
            elif src not in ("all", "step"):
                bad_source.append("%s(source=%r)" % (cid, src))
            if item.get("runId"):
                run_ids.append(item["runId"])
        repeated = [r for r in set(run_ids) if run_ids.count(r) > 1]
        if repeated:
            dup_run.append("%s(%s)" % (cid, ",".join(repeated[:2])))

    if missing_field:
        report.fail(where, "记录缺少必填字段：%s（面板靠 runId 关联 runs/，靠 at 排序）"
                    % ", ".join(missing_field[:5]))
    if dup_run:
        report.fail(where, "同一次 runId 在一条用例下出现多条记录：%s（应去重，一用例一条）"
                    % ", ".join(dup_run[:5]))
    if bad_source:
        report.fail(where, "`source` 不合规：%s —— 报告页**只认 `\"all\"`**（一键执行），"
                           "`\"step\"` 只留在步骤页。写成别的值（如 `\"run\"`）"
                           "记录会被静默筛掉，报告页空白且不报错"
                    % ", ".join(bad_source[:5]))

    # 本轮 runId 是否落进了记录
    if run_id:
        hit = any(
            isinstance(item, dict) and item.get("runId") == run_id
            for arr in group.values() if isinstance(arr, list)
            for item in arr
        )
        if not hit:
            report.fail(where, "本轮 runId(%s) 没有进 exec-records —— 报告页看不到这次执行" % run_id)

    covered = {cid for cid, arr in group.items() if isinstance(arr, list) and arr}
    missing_cases = [cid for cid in (case_ids or []) if cid not in covered]
    if missing_cases:
        report.warn(where, "%d 条用例没有执行记录（如 %s）—— 面板子表会是空的"
                    % (len(missing_cases), ", ".join(missing_cases[:3])))
    else:
        report.ok("exec-records 覆盖全部 %d 条用例，字段合规" % len(covered))


def check_measurable_points(root, case_version, case_ids, report):
    """检查可测点清单 —— **决定用例数量的唯一依据**。

    ★ 2026-11-25 实测事故：同一类项目反复只出 38-42 条用例，
    而按源码逐项枚举其实有 1000+ 个可测点。根因是从没要求过枚举 ——
    模型凭「读完代码的印象」写用例，只写得出主流程那十几条。

    所以现在强制：Step 1 必须产出 `measurable-points.json`，
    六个维度（端点/字段约束/错误分支/业务校验/状态机/鉴权）都要有实际扫描数字。
    """
    where = "measurable-points.json"
    if not case_version:
        return
    path = Path(root) / "case-versions" / case_version.replace(".", "_") / "measurable-points.json"
    if not path.is_file():
        report.fail(where, "不存在 —— Step 1 必须穷尽枚举可测点。"
                           "没有它就无法判断用例数是不是「分析出来多少」，"
                           "也就无法证明没有漏测。见 SKILL.md「★ 1-1.2 先穷尽枚举可测点」")
        return

    doc = load_json(path, report, where)
    if not isinstance(doc, dict):
        report.fail(where, "顶层必须是对象")
        return

    basis = doc.get("scanBasis")
    if not isinstance(basis, dict):
        report.fail(where, "缺 `scanBasis` —— 要记录六个维度各扫出多少条，"
                           "否则无法核对是否真的扫过")
        basis = {}

    DIMENSIONS = [
        ("endpoints", "端点"),
        ("constrainedFields", "受限字段"),
        ("errorBranches", "错误分支"),
        ("businessChecks", "业务校验"),
        ("stateValues", "状态值"),
        ("authPoints", "鉴权点"),
    ]
    missing_dims = []
    zero_dims = []
    for key, label in DIMENSIONS:
        value = basis.get(key)
        if value is None:
            missing_dims.append(label)
        elif not isinstance(value, int) or value == 0:
            zero_dims.append(label)
    if missing_dims:
        report.fail(where, "scanBasis 缺少维度：%s（六个维度都要扫）"
                    % ", ".join(missing_dims))
    if zero_dims:
        # 某一维为 0 是可能的（如无鉴权点的 CLI 工具），但必须显式声明
        report.warn(where, "这些维度扫出来是 0：%s —— 确认系统里确实没有，"
                           "并在 coverage.json 说明" % ", ".join(zero_dims))

    points = doc.get("points")
    if not isinstance(points, list) or not points:
        report.fail(where, "`points[]` 为空 —— 至少应该枚举出端点级的可测点")
        return

    # 每个点必须归属功能项、且要么被覆盖、要么标记不测
    no_feature = []
    no_case = []
    covered_ids = set()
    for item in points:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("id") or "?")
        if not str(item.get("featureId") or "").strip():
            no_feature.append(pid)
        ids = item.get("caseIds")
        if isinstance(ids, list) and ids:
            covered_ids.update(str(x) for x in ids if x)
        else:
            no_case.append(pid)

    if no_feature:
        report.fail(where, "%d 个可测点没有 featureId（无法归组）：%s"
                    % (len(no_feature), ", ".join(no_feature[:5])))

    total = len([p for p in points if isinstance(p, dict)])
    if no_case:
        report.warn(where, "%d/%d 个可测点还没被用例覆盖（如 %s）—— "
                           "每个都要么补用例，要么在 coverage.json 给不测理由"
                    % (len(no_case), total, ", ".join(no_case[:5])))
    else:
        report.ok("可测点 %d 个，全部有用例覆盖" % total)

    # 反向核对：用例数 vs 可测点数 —— 少于可测点数说明有合并或漏测
    n_cases = len([c for c in (case_ids or [])])
    if n_cases and total:
        if n_cases < total * 0.5:
            report.warn(where, "用例数(%d) 不到可测点数(%d) 的一半 —— "
                               "确认是「合并成参数化用例」而不是漏测；"
                               "合并的要在 description 里写明覆盖了哪几个可测点"
                        % (n_cases, total))
        else:
            report.ok("用例 %d 条 / 可测点 %d 个，比例合理" % (n_cases, total))

    # 用例能否追溯到可测点
    if case_ids:
        orphan = [cid for cid in case_ids if cid not in covered_ids]
        if orphan:
            report.warn(where, "%d 条用例在可测点清单里找不到出处（如 %s）—— "
                               "追溯不到的用例可能是凑数" % (len(orphan), ", ".join(orphan[:3])))


def main(argv=None):
    parser = argparse.ArgumentParser(description="集成测试数据契约校验")
    parser.add_argument("--root", required=True, help="会话集成根目录（.../integration）")
    parser.add_argument("--step-version", default="", help="步骤版本，默认取最新")
    parser.add_argument("--case-version", default="", help="用例版本，默认取最新")
    parser.add_argument("--run", default="", help="要校验的 runId，默认取最新")
    args = parser.parse_args(argv)

    root = Path(args.root)
    if not root.is_dir():
        print("FAIL 集成根目录不存在：%s" % root, file=sys.stderr)
        return 2

    report = Report()
    print("校验集成测试数据契约")
    print("  根目录：%s" % root)

    case_ver = args.case_version or latest_version(root, "case-versions")
    step_ver = args.step_version or latest_version(root, "step-versions")
    run_id = args.run
    if run_id == "":
        runs_dir = root / "runs"
        if runs_dir.is_dir():
            names = sorted([p.name for p in runs_dir.iterdir() if p.is_dir()])
            run_id = names[-1] if names else ""
    print("  用例版本：%s   步骤版本：%s   run：%s\n" % (case_ver or "(无)", step_ver or "(无)", run_id or "(无)"))

    feature_ids = []
    case_ids = []
    step_case_index = None

    if case_ver:
        features = load_json(root / "case-versions" / case_ver / "features.json", report, "features.json")
        if features is not None:
            feature_ids = check_features(features, report)
            # 功能项 id → stage，供用例继承检查用
            feature_stage = {
                f.get("id"): str(f.get("stage")).strip()
                for f in features
                if isinstance(f, dict) and f.get("id") and str(f.get("stage") or "").strip()
            }
        cases = load_json(root / "case-versions" / case_ver / "cases.json", report, "cases.json")
        if cases is not None:
            case_ids = check_cases(cases, feature_ids, report, feature_stage)
    else:
        report.fail("case-versions", "找不到任何用例版本")

    if step_ver:
        steps_doc = load_json(root / "step-versions" / step_ver / "steps.json", report, "steps.json")
        if steps_doc is not None:
            check_steps(steps_doc, case_ids, report)
            step_case_index = {}
            for case in steps_doc.get("cases") or []:
                if isinstance(case, dict):
                    step_case_index[case.get("caseId")] = {
                        s.get("no") for s in (case.get("steps") or []) if isinstance(s, dict)
                    }
    else:
        report.warn("step-versions", "还没有步骤版本（Step 3 尚未执行）")

    check_runner(load_json(root / "runner.json", report, "runner.json"), report)

    # ★ 面板契约：三个 index.json 的字段名（写错页面会空白）
    for kind in ("case-versions", "step-versions", "report-versions"):
        if (root / kind / "index.json").is_file():
            check_panel_index(root, kind, report)

    # ★★ 可测点清单：用例数量的唯一依据（防「只出几十条就交差」）
    check_measurable_points(root, case_ver, case_ids, report)

    # ★ 报告页能出一行的必要条件：exec-records.json
    #   ⚠️ 只在**已经有执行记录（run）**时才要求它 ——
    #   Step 1/Step 3 阶段还没跑过测试，此时没有 exec-records 是正常的，
    #   不能判 FAIL（会误伤用例/步骤阶段的自检）。
    if step_ver and run_id:
        check_exec_records(root, step_ver, case_ids, run_id, report)

    if run_id:
        check_snapshot(root, run_id, report)
        result = load_json(root / "runs" / run_id / "result.json", report, "result.json")
        if result is not None:
            check_result(result, case_ids, step_case_index, report)
        check_report_version(root, report, run_id)
    else:
        report.warn("runs", "还没有任何执行记录（Step 5 尚未执行）")

    print("")
    return report.dump()


if __name__ == "__main__":
    sys.exit(main())