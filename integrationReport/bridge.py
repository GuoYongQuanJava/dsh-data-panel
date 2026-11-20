# -*- coding: utf-8 -*-
"""bridge.py（集成测试）：把「某一次真实执行」转换成报告生成器需要的 data 结构。

与单元测试的 `testReport/report-tool/bridge.py` 是**同一种分工**，但数据模型完全不同
（集成测试是 steps[]，单元测试是 tests[]，详见 SKILL.md「两套报告绝不能混用」）。

职责边界（照单元测试的原则）
============================
1. **只做数据转换**：读 steps / 快照 / 执行证据 → 组装 data → 写中间产物。
   填表、合并单元格、勾选框、排版**全部交给 integration_report.py**，本脚本不碰。
2. **不重跑测试**：只消费 `--run` 指定的那一次执行结果，保证报告与日志是同一件事。
3. **不信「整体通过」**：逐步骤结论只来自该步骤自己的证据；找不到证据就标 notRun /
   未确认，绝不用整体状态推断它通过。
4. **不编造数据**：没有的信息留空或写「未采集」，不猜。

产出两份中间产物（与单元测试对齐）
==================================
```
<会话>/integration/reports/<runId>/
    report-plan.json   ← 报告编排计划：阶段划分 + 每个阶段的功能项
    report-data.json   ← 喂给生成器的完整数据（meta / people / stages）
    整项目-<版本>.docx  ← 由 integration_report.build_full() 生成
    cases/*.docx        ← 由 integration_report.build_single_step() 生成
```

`report-plan.json` 为什么要存在（照单元测试的做法）：报告结构一旦出问题
（阶段分错、章节少了一章），只有最终 docx 很难倒查。有了计划文件可以逐项核对，
而且**阶段划分要稳定**——同一次执行重复生成报告，阶段不能每次都不一样。

用法
====
```
python bridge.py --session-root <会话>/integration \\
                 --run-id run_20261120_1020_all \\
                 --project-code JYSG \\
                 [--source DM|SRS] \\
                 [--software-name ...] [--software-version ...] \\
                 [--template <模板路径>] \\
                 [--no-docx]          # 只产出两份 json，不生成 docx
```

只给 `--session-root` 和 `--run-id` 就能跑，其余从磁盘上已有的数据推断。
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import random
import sys
from datetime import datetime, timezone
from pathlib import Path

# 集成测试的测试类型 → 报告里的中文名（与 SKILL.md 的 7 类枚举一致）
TYPE_LABELS = {
    "functional": "功能测试",
    "performance": "性能测试",
    "boundary": "边界测试",
    "api": "接口测试",
    "stress": "强度测试",
    "security": "安全性测试",
    "margin": "余量测试",
}

# 结论映射：执行结果 → 报告里「结论」列的文字
OUTCOME_CONCLUSION = {
    "passed": "通过",
    "failed": "未通过",
    "error": "未通过",
    "notRun": "未执行",
    "unconfirmed": "未确认",
}

# 执行通道说明（报告备注里会用到）
CHANNEL_TEXT = {
    "runner": "测试代码执行",
    "cua": "CUA 桌面交互",
}

DEFAULT_PEOPLE = "admin"


# ─────────────────────────────────────────────────────────────
#  读盘
# ─────────────────────────────────────────────────────────────


def read_json(path: Path, fallback=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback if fallback is not None else {}


def find_step_version_dir(session_root: Path, step_version: str = "") -> Path:
    """定位步骤版本目录。

    不指定版本时取 `step-versions/index.json` 里的 activeVersion；
    再不行就取字典序最大的那个（最新）。
    """
    step_root = session_root / "step-versions"
    if step_version:
        candidate = step_root / step_version.replace(".", "_")
        if candidate.is_dir():
            return candidate
        raise SystemExit("找不到步骤版本目录：%s" % candidate)

    index = read_json(step_root / "index.json", {})
    active = str(index.get("activeVersion") or "")
    if active:
        candidate = step_root / active.replace(".", "_")
        if candidate.is_dir():
            return candidate

    dirs = [p for p in step_root.glob("V*") if p.is_dir()] if step_root.is_dir() else []
    if not dirs:
        raise SystemExit("找不到任何步骤版本：%s" % step_root)
    return sorted(dirs, key=lambda p: p.name)[-1]


def load_steps(session_root: Path, step_version: str = "") -> tuple:
    """读步骤版本的全部输入，返回 (steps_doc, snapshot, step_version_name)。"""
    vdir = find_step_version_dir(session_root, step_version)
    version_name = vdir.name.replace("_", ".")

    steps_doc = read_json(vdir / "steps.json", {})
    snapshot = read_json(vdir / "cases.snapshot.json", {})

    if not steps_doc:
        raise SystemExit("步骤文件缺失或为空：%s" % (vdir / "steps.json"))
    if not snapshot:
        raise SystemExit("用例快照缺失或为空：%s" % (vdir / "cases.snapshot.json"))

    return steps_doc, snapshot, version_name


def load_run(run_dir: Path) -> tuple:
    """读一次执行的结果与观察记录。"""
    result = read_json(run_dir / "result.json", {})
    observations = read_json(run_dir / "observations.json", {})
    if not result:
        raise SystemExit("执行结果缺失或为空：%s" % (run_dir / "result.json"))
    return result, observations


# ─────────────────────────────────────────────────────────────
#  证据归集：把一次执行的原始输出整理成「按步骤可查」
# ─────────────────────────────────────────────────────────────


def build_evidence_index(result: dict, observations: dict) -> dict:
    """建立 步骤定位键 → 该步骤的执行证据。

    一键执行的证据分散在两处，必须合并：
      · result.json 的 `steps[]`：runner 通道逐步骤结果
      · observations.json 的 `items[]`：CUA 通道逐步骤观察

    定位键用 `caseId|stepNo`，与面板子表的键一致，避免只靠序号错位。

    ★ 字段名是 `stepNo`（不是 `no`）。踩过：写成 `no` 会让所有步骤都取到
      `None` 而挤到同一个键上，表现为「173 个步骤只有 74 条证据、结论全 notRun」。
      这里同时兼容 `stepNo` / `no` / `step` 三种写法，免得旧数据对不上。
    """
    index = {}

    def step_no_of(item: dict):
        for key in ("stepNo", "no", "step"):
            value = item.get(key)
            if value is not None:
                return value
        return None

    def key_of(case_id: str, step_no) -> str:
        return "%s|%s" % (case_id, step_no)

    for item in result.get("steps") or []:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        index[key_of(case_id, step_no_of(item))] = {
            "outcome": str(item.get("outcome") or "notRun"),
            "observed": str(item.get("observed") or ""),
            "reason": str(item.get("reason") or ""),
            "channel": str(item.get("channel") or "runner"),
            "durationMs": item.get("durationMs") or 0,
        }

    for item in observations.get("items") or []:
        if not isinstance(item, dict):
            continue
        case_id = str(item.get("caseId") or "")
        if case_id == "":
            continue
        k = key_of(case_id, step_no_of(item))
        merged = index.get(k, {})
        merged.update({
            "outcome": str(item.get("outcome") or merged.get("outcome") or "notRun"),
            "observed": str(item.get("observed") or merged.get("observed") or ""),
            "reason": str(item.get("reason") or merged.get("reason") or ""),
            "channel": str(item.get("channel") or merged.get("channel") or "cua"),
            "durationMs": item.get("durationMs") or merged.get("durationMs") or 0,
        })
        index[k] = merged

    return index


# ─────────────────────────────────────────────────────────────
#  报告编排计划（report-plan.json）
# ─────────────────────────────────────────────────────────────


def collect_stage_of_feature(snapshot: dict) -> dict:
    """功能项 → 阶段名。

    优先用功能项自己带的 `stage`；没有就从它名下的用例里找；
    都没有则归到「未分阶段」——**不随机编一个阶段名**（那是造假）。
    """
    stage_of = {}
    for feature in snapshot.get("features") or []:
        fid = str(feature.get("id") or "")
        if fid == "":
            continue
        stage = str(feature.get("stage") or "").strip()
        if stage:
            stage_of[fid] = stage
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        if fid == "":
            continue
        if stage_of.get(fid):
            continue
        stage = str(case.get("stage") or "").strip()
        if stage:
            stage_of[fid] = stage
    return stage_of


def generate_plan(snapshot: dict, run_id: str, seed: int | None = None) -> dict:
    """生成报告编排计划：哪些功能项归哪个阶段、每个阶段多少条用例。

    ★ 与单元测试的关键差别：单元测试的 `bridge.py` 是**随机**把被测函数分到
      3-4 个阶段（`generate_phase_plan` 用贪心+随机平局）。集成测试**不这样做** ——
      集成测试的阶段在生成用例时就已经按业务模块定了，写进功能项的 `stage` 字段。

      所以这里只做「按已有 stage 归组」，绝不重新划分。重新划分会导致：
        · 报告里的阶段和用户在用例页看到的对不上；
        · 同一次执行重复生成报告时阶段变成另一套。
      只有**全都没标 stage** 时，才退化成单阶段并在计划里标出原因。
    """
    stage_of = collect_stage_of_feature(snapshot)

    # 按 stage 归组，保持功能项原有顺序（报告章节顺序要稳定）
    order = []
    buckets = {}
    for feature in snapshot.get("features") or []:
        fid = str(feature.get("id") or "")
        if fid == "":
            continue
        stage = stage_of.get(fid) or stage_of.get("") or "未分阶段"
        if stage not in buckets:
            buckets[stage] = []
            order.append(stage)
        buckets[stage].append(fid)

    case_count_of_feature = {}
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        case_count_of_feature[fid] = case_count_of_feature.get(fid, 0) + 1

    phases = []
    for i, stage in enumerate(order, start=1):
        feature_ids = buckets[stage]
        phases.append({
            "phaseId": "phase-%d" % i,
            "name": stage,
            "order": i,
            "featureIds": feature_ids,
            "caseCount": sum(case_count_of_feature.get(fid, 0) for fid in feature_ids),
        })

    notes = []
    if len(phases) == 1 and phases[0]["name"] == "未分阶段":
        notes.append(
            "功能项没有 stage 字段，报告只能出单章。"
            "按规范，测试阶段应在生成用例时就按业务模块划分（3-4 个）并写进 features[].stage。"
        )

    return {
        "schemaVersion": "1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "runId": run_id,
        "stageSource": "feature.stage" if stage_of else "none",
        "phaseCount": len(phases),
        "phases": phases,
        "notes": notes,
    }


def load_or_create_plan(snapshot: dict, run_id: str, report_dir: Path) -> tuple:
    """读已有计划，没有就生成。

    「有就复用」是为了**阶段划分稳定**：同一次执行重复生成报告，
    章节结构必须一模一样，不能因为重新跑了一次 bridge 就换了。
    但如果快照里的阶段集合变了（用户改了 stage），就重新生成。
    """
    plan_path = report_dir / "report-plan.json"
    fresh = generate_plan(snapshot, run_id)

    if plan_path.is_file():
        try:
            old = json.loads(plan_path.read_text(encoding="utf-8"))
            old_names = [p.get("name") for p in (old.get("phases") or [])]
            new_names = [p.get("name") for p in fresh.get("phases") or []]
            if old_names == new_names:
                return old, plan_path
            # 阶段集合变了 → 用新的（并在计划里记一笔，便于倒查）
            fresh["notes"] = list(fresh.get("notes") or []) + [
                "阶段划分相比上一次计划有变化：%s → %s" % (old_names, new_names)
            ]
        except Exception:
            pass  # 计划损坏就重建

    report_dir.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(json.dumps(fresh, ensure_ascii=False, indent=2), encoding="utf-8")
    return fresh, plan_path


# ─────────────────────────────────────────────────────────────
#  组装 data（喂给 integration_report.py）
# ─────────────────────────────────────────────────────────────


def case_payload(case: dict, evidence: dict, step_rows: list) -> dict:
    """把快照里的一条用例 + 执行证据，转成生成器要的 case 结构。"""
    case_id = str(case.get("caseId") or "")
    steps = []
    outcomes = []

    for i, step in enumerate(step_rows, start=1):
        # `steps.json` 里的步骤序号键名兼容（no / stepNo / step）
        no = None
        for key in ("no", "stepNo", "step"):
            if step.get(key) is not None:
                no = step.get(key)
                break
        if no is None:
            no = i
        ev = evidence.get("%s|%s" % (case_id, no), {})
        outcome = ev.get("outcome") or "notRun"
        observed = ev.get("observed") or ""
        if outcome == "notRun" and observed == "":
            observed = "未执行"
        if outcome in ("failed", "error") and observed == "":
            observed = ev.get("reason") or "实际结果与预期不符"

        steps.append({
            "no": no,
            "action": step.get("action") or "",
            "operation": step.get("operation") or step.get("action") or "",
            "expected": step.get("expected") or "",
            "observed": observed,
            "outcome": outcome,
        })
        outcomes.append(outcome)

    # 用例级结论：任何一步没通过就是未通过；有步骤根本没执行则未执行/未确认。
    #
    # 这里**不复用 result.json 的整体状态** —— 单元测试的 bridge.py 有同一条原则：
    # 逐条结论只来自该条自己的证据，不用整体状态推断。
    if "failed" in outcomes or "error" in outcomes:
        case_outcome = "failed"
    elif not outcomes:
        case_outcome = "notRun"
    elif all(o == "passed" for o in outcomes):
        case_outcome = "passed"
    elif all(o == "notRun" for o in outcomes):
        case_outcome = "notRun"
    else:
        case_outcome = "unconfirmed"

    return {
        "caseId": case_id,
        "caseCode": case.get("caseCode") or "",
        "chapter": case.get("chapter") or "",
        "seq": case.get("seq"),
        "title": case.get("title") or "",
        "type": case.get("type") or "functional",
        "typeLabel": TYPE_LABELS.get(case.get("type") or "functional", "功能测试"),
        "polarity": case.get("polarity") or "normal",
        "requirement": case.get("requirement") or "",
        "description": case.get("description") or "",
        "precondition": case.get("precondition") or "",
        "executedAt": case.get("executedAt") or "",
        "outcome": case_outcome,
        "steps": steps,
    }


def build_data(snapshot: dict, steps_doc: dict, evidence: dict, plan: dict,
               run_id: str, meta_overrides: dict) -> dict:
    """按 plan 把功能项和用例组织成生成器要的 stages 结构。"""
    feature_by_id = {str(f.get("id") or ""): f for f in snapshot.get("features") or []}
    case_by_id = {str(c.get("caseId") or ""): c for c in snapshot.get("cases") or []}

    # 步骤定义：caseId → 步骤行（`steps.json` 里每条用例挂自己的步骤）
    steps_of_case = {}
    for case in steps_doc.get("cases") or []:
        cid = str(case.get("caseId") or "")
        if cid:
            steps_of_case[cid] = case.get("steps") or []

    # 功能项 → 它名下的用例（保持快照顺序）
    cases_of_feature = {}
    for case in snapshot.get("cases") or []:
        fid = str(case.get("featureId") or "")
        if fid == "":
            continue
        cases_of_feature.setdefault(fid, []).append(case)

    stages = []
    for phase in plan.get("phases") or []:
        features_out = []
        stage_issues = []

        for fid in phase.get("featureIds") or []:
            feature = feature_by_id.get(fid)
            if feature is None:
                continue
            feature_cases = []
            for case in cases_of_feature.get(fid) or []:
                cid = str(case.get("caseId") or "")
                payload = case_payload(case, evidence, steps_of_case.get(cid) or [])
                feature_cases.append(payload)
                # 未通过的用例 → 一条问题（附录 A/B 的来源）
                if payload["outcome"] == "failed":
                    failed_steps = [s for s in payload["steps"]
                                    if s["outcome"] in ("failed", "error")]
                    desc = "；".join(
                        "第 %s 步：%s" % (s["no"], s["observed"] or s["expected"] or "实际与预期不符")
                        for s in failed_steps
                    ) or payload["title"]
                    stage_issues.append({
                        "title": "%s：%s" % (payload["caseCode"] or cid, payload["title"]),
                        "desc": desc[:800],
                        "level": "一般",
                        "caseCode": payload["caseCode"] or "",
                        "foundAt": payload["executedAt"] or "",
                    })

            if not feature_cases:
                continue
            features_out.append({
                "code": feature.get("code") or "",
                "name": feature.get("name") or "",
                # 功能项也带上 stage，分布统计表和记录单的「测试阶段」列要用
                "stage": phase.get("name") or "",
                "cases": feature_cases,
            })

        stages.append({
            "name": phase.get("name") or "集成测试",
            "features": features_out,
            "issues": stage_issues,
            "inconsistent": "无",
            "regression": {},
        })

    meta = {
        "softwareName": meta_overrides.get("software_name") or "被测软件",
        "softwareVersion": meta_overrides.get("software_version") or "",
        "softwareScale": meta_overrides.get("software_scale") or "未采集",
        "language": meta_overrides.get("language") or "未采集",
        "devEnv": meta_overrides.get("dev_env") or "未采集",
        "runEnv": meta_overrides.get("run_env") or "未采集",
        "importance": meta_overrides.get("importance") or "重要",
        "vendor": meta_overrides.get("vendor") or "未采集",
        "projectCode": meta_overrides.get("project_code") or "",
        "source": meta_overrides.get("source") or "DM",
        "testStartDate": meta_overrides.get("test_start_date") or "",
        "testEndDate": meta_overrides.get("test_end_date") or "",
        "codeCommentRate": meta_overrides.get("code_comment_rate"),
    }

    people = {
        "designer": meta_overrides.get("designer") or DEFAULT_PEOPLE,
        "reviewer": meta_overrides.get("reviewer") or DEFAULT_PEOPLE,
        "tester": meta_overrides.get("tester") or DEFAULT_PEOPLE,
    }

    # 汇总：给面板与人工核对用
    summary = {"caseTotal": 0, "stepTotal": 0, "caseOutcome": {}, "stepOutcome": {}}
    for stage in stages:
        for feature in stage["features"]:
            for case in feature["cases"]:
                summary["caseTotal"] += 1
                summary["caseOutcome"][case["outcome"]] = \
                    summary["caseOutcome"].get(case["outcome"], 0) + 1
                for step in case["steps"]:
                    summary["stepTotal"] += 1
                    summary["stepOutcome"][step["outcome"]] = \
                        summary["stepOutcome"].get(step["outcome"], 0) + 1

    return {
        "runId": run_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "meta": meta,
        "people": people,
        "stages": stages,
        "summary": summary,
    }


# ─────────────────────────────────────────────────────────────
#  调生成器（不自己填表）
# ─────────────────────────────────────────────────────────────


def load_generator(script: str = ""):
    """加载集成报告生成器。

    查找顺序与宿主侧的 `integrationReportScriptPath()` 保持一致：
      1. 命令行/环境变量显式指定
      2. 本脚本同目录的 integration_report.py（两者都在 integrationReport/ 下）
      3. 仓库根的 integrationReport/integration_report.py
    """
    candidates = []
    if script:
        candidates.append(Path(script))
    env = os.environ.get("INTEGRATION_REPORT_SCRIPT", "").strip()
    if env:
        candidates.append(Path(env))
    here = Path(__file__).resolve().parent
    candidates.append(here / "integration_report.py")
    candidates.append(here.parent / "integrationReport" / "integration_report.py")

    for path in candidates:
        if path.is_file():
            spec = importlib.util.spec_from_file_location("integration_report", path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            return module, path

    raise SystemExit(
        "报告生成器缺失：找不到 integration_report.py\n"
        "  已尝试：%s\n"
        "请确认它随仓库一起存在（integrationReport/integration_report.py），\n"
        "或用环境变量 INTEGRATION_REPORT_SCRIPT 指定。\n"
        "不要在缺生成器的情况下自己实现报告生成。"
        % "\n          ".join(str(c) for c in candidates)
    )


def find_template(script_dir: Path, explicit: str = "") -> Path:
    candidates = []
    if explicit:
        candidates.append(Path(explicit))
    env = os.environ.get("INTEGRATION_REPORT_TEMPLATE", "").strip()
    if env:
        candidates.append(Path(env))
    candidates.append(script_dir / "配置项测试报告模板.docx")

    for path in candidates:
        if path.is_file():
            return path

    raise SystemExit(
        "找不到模板：已尝试 %s\n"
        "模板应随仓库进库（integrationReport/配置项测试报告模板.docx）。"
        % "、".join(str(c) for c in candidates)
    )


def resolve_report_version(session_root: Path, run_id: str, explicit: str = "") -> str:
    """确定本次报告该用哪个版本号。

    ★ 关键：版本号**必须向面板要**，不能在脚本里写死。
      面板侧的 `createVersion` 负责分配（V0.0.1 → V0.0.2 → …），
      写死会导致第二次一键执行把上一次的报告覆盖掉。

    这里按优先级：
      1. 命令行 `--report-version` 显式指定
      2. `report-versions/index.json` 里已记录本次 runId 的版本（面板已建过）
      3. 都没有 → 返回空串，让调用方提示「先调 createVersion」

    第 2 条能成立，是因为面板建版本时会把 `runId` 写进 `versions[]`。
    """
    if explicit:
        return explicit

    index = read_json(session_root / "report-versions" / "index.json", {})
    for item in index.get("versions") or []:
        if str(item.get("runId") or "") == run_id:
            name = str(item.get("name") or "")
            if name:
                return name
    return ""


def write_report_data(report_dir: Path, data: dict, made: dict, overall: Path,
                      run_id: str, step_version: str, case_version: str) -> Path:
    """写 report-data.json。

    ★ 这份文件有**两个消费者**，结构必须同时满足：

      1. **面板**（`/data-panel/run/report` 读它，报告页按它列文件、按 docx 路径打开）
         需要的顶层字段：`runId`、`stepVersion`、`caseVersion`、`overallDocx`、
         `features[].cases[]`（每条带 `docx` / `relPath` / `caseOutcome`）
      2. **人/脚本**核对本次编排：`meta`、`people`、`stages`、`summary`

    踩过的坑：只写第 2 种（生成器要的那种 stages 结构）会**把面板依赖的字段冲掉**，
    表现为报告页「文件列表还在、但点开提示没有报告」。
    所以这里两套都写：`features`（面板用，扁平按功能项）+ `stages`（生成用）。
    """
    base = report_dir.parent.parent  # <会话>/integration
    overall_str = str(overall) if overall is not None else ""
    overall_rel = ""
    if overall_str:
        try:
            overall_rel = str(Path(overall_str).relative_to(base)).replace("\\", "/")
        except Exception:
            overall_rel = overall_str

    # ── 面板用的扁平 features（按功能项 → 每条用例一份 docx 路径）──
    features_out = []
    seen = set()
    for stage in data.get("stages") or []:
        for feature in stage.get("features") or []:
            entry_cases = []
            for case in feature.get("cases") or []:
                cid = case.get("caseId") or ""
                docx_path = made.get(cid, "")
                rel = ""
                if docx_path:
                    try:
                        rel = str(Path(docx_path).relative_to(base)).replace("\\", "/")
                    except Exception:
                        rel = docx_path
                entry_cases.append({
                    "caseId": cid,
                    "caseCode": case.get("caseCode") or "",
                    "caseOutcome": case.get("outcome") or "",
                    "docx": docx_path,
                    "relPath": rel,
                })
            key = feature.get("code") or feature.get("name") or ""
            if key in seen:
                continue
            seen.add(key)
            features_out.append({
                "featureId": feature.get("code") or "",
                "code": feature.get("code") or "",
                "name": feature.get("name") or "",
                "stage": feature.get("stage") or "",
                "cases": entry_cases,
            })

    payload = {
        # ① 面板依赖的字段（缺了报告页就打不开报告）
        "runId": run_id,
        "stepVersion": step_version,
        "caseVersion": case_version,
        "generatedAt": data.get("generatedAt") or "",
        "summary": data.get("summary") or {},
        "overallDocx": overall_str,
        "overallRelPath": overall_rel,
        "features": features_out,
        # ② 生成器/人工核对用的结构（保留，便于复现与倒查）
        "meta": data.get("meta") or {},
        "people": data.get("people") or {},
        "stages": data.get("stages") or [],
    }

    path = report_dir / "report-data.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def render_docx(module, template: Path, data: dict, report_dir: Path,
                run_id: str, software_name: str, report_version: str = "") -> tuple:
    """生成整项目报告 + 每条用例一份单条报告。

    文件名带**报告版本号**（不是 runId）：与 SKILL.md 的约定一致，
    这样同一 run 重新生成不同版本时不会互相覆盖，也和单元测试的命名习惯对齐。
    """
    case_dir = report_dir / "cases"
    case_dir.mkdir(parents=True, exist_ok=True)

    suffix = report_version or run_id
    overall_name = "集成测试报告-%s-整项目-%s.docx" % (software_name or "项目", suffix)
    overall = module.build_full(template, data, report_dir / overall_name)

    made = {}
    for stage in data.get("stages") or []:
        for feature in stage.get("features") or []:
            for case in feature.get("cases") or []:
                cid = case.get("caseId") or ""
                if cid == "":
                    continue
                out = case_dir / ("集成测试报告-%s-全步骤-%s.docx"
                                  % (cid.replace(".", "_"), suffix))
                module.build_single_step(
                    template,
                    {"people": data.get("people") or {}, "meta": data.get("meta") or {},
                     "feature": {"code": feature.get("code") or "",
                                 "name": feature.get("name") or ""},
                     "case": case},
                    out,
                )
                made[cid] = str(out)

    return overall, made


# ─────────────────────────────────────────────────────────────
#  CLI
# ─────────────────────────────────────────────────────────────


def main(argv) -> int:
    parser = argparse.ArgumentParser(
        description="集成测试报告数据转换（把一次执行转成生成器要的 data）")
    parser.add_argument("--session-root", required=True,
                        help="集成测试根目录，形如 <会话>/integration")
    parser.add_argument("--run-id", required=True, help="本次执行的 runId")
    parser.add_argument("--step-version", default="",
                        help="步骤版本（缺省取 index.json 的 activeVersion）")
    parser.add_argument("--project-code", default="", help="项目缩写，用于用例标识，如 JYSG")
    parser.add_argument("--source", default="DM", choices=["DM", "SRS"],
                        help="需求来源：DM=按代码归纳，SRS=有需求文档")
    parser.add_argument("--software-name", default="")
    parser.add_argument("--software-version", default="")
    parser.add_argument("--software-scale", default="")
    parser.add_argument("--language", default="")
    parser.add_argument("--dev-env", default="")
    parser.add_argument("--run-env", default="")
    parser.add_argument("--importance", default="")
    parser.add_argument("--vendor", default="")
    parser.add_argument("--test-start-date", default="")
    parser.add_argument("--test-end-date", default="")
    parser.add_argument("--designer", default="")
    parser.add_argument("--reviewer", default="")
    parser.add_argument("--tester", default="")
    parser.add_argument("--template", default="", help="模板路径（缺省用仓库内那份）")
    parser.add_argument("--report-version", default="",
                        help="报告版本号，如 V0.0.1。缺省从 report-versions/index.json "
                             "按本次 runId 查；查不到时退回用 runId（并提示先调面板 createVersion）")
    parser.add_argument("--no-docx", action="store_true",
                        help="只产出 report-plan.json / report-data.json，不生成 docx")
    args = parser.parse_args(argv)

    session_root = Path(args.session_root).resolve()
    if not session_root.is_dir():
        raise SystemExit("集成测试根目录不存在：%s" % session_root)

    run_dir = session_root / "runs" / args.run_id
    if not run_dir.is_dir():
        raise SystemExit("找不到这次执行：%s" % run_dir)

    print("[1/5] 读取步骤与快照…")
    steps_doc, snapshot, step_version = load_steps(session_root, args.step_version)
    print("      步骤版本 %s，用例 %d 条"
          % (step_version, len(snapshot.get("cases") or [])))

    print("[2/5] 读取执行结果与观察记录…")
    result, observations = load_run(run_dir)
    evidence = build_evidence_index(result, observations)
    print("      证据条目 %d 个" % len(evidence))

    report_dir = session_root / "reports" / args.run_id
    report_dir.mkdir(parents=True, exist_ok=True)
    case_version = read_json(session_root / "case-versions" / "index.json", {}).get(
        "activeVersion") or ""

    print("[3/5] 生成/复用报告编排计划…")
    plan, plan_path = load_or_create_plan(snapshot, args.run_id, report_dir)
    print("      阶段 %d 个：%s"
          % (plan.get("phaseCount") or 0,
             "、".join(p.get("name") or "" for p in plan.get("phases") or [])))
    for note in plan.get("notes") or []:
        print("      注意：" + note)

    print("[4/5] 组装 report-data.json…")
    data = build_data(snapshot, steps_doc, evidence, plan, args.run_id, {
        "project_code": args.project_code,
        "source": args.source,
        "software_name": args.software_name,
        "software_version": args.software_version or step_version,
        "software_scale": args.software_scale,
        "language": args.language,
        "dev_env": args.dev_env,
        "run_env": args.run_env,
        "importance": args.importance,
        "vendor": args.vendor,
        "test_start_date": args.test_start_date,
        "test_end_date": args.test_end_date,
        "designer": args.designer,
        "reviewer": args.reviewer,
        "tester": args.tester,
    })
    data_path = report_dir / "report-data.json"
    summary = data.get("summary") or {}
    print("      用例 %d 条，步骤 %d 个，结论分布 %s"
          % (summary.get("caseTotal", 0), summary.get("stepTotal", 0),
             summary.get("caseOutcome", {})))

    print("OK report-plan.json -> %s" % plan_path)

    if args.no_docx:
        # 只出 json 时也要写完整结构（面板字段 + stages），否则会把面板要的字段冲掉
        data_path = write_report_data(report_dir, data, {}, None, args.run_id,
                                      step_version, case_version)
        print("OK report-data.json -> %s" % data_path)
        print("[5/5] 已跳过 docx 生成（--no-docx）")
        return 0

    print("[5/5] 调生成器出 docx…")
    module, script_path = load_generator()
    template = find_template(script_path.parent, args.template)

    # 报告版本号：优先用显式参数，其次从面板写的 index.json 按 runId 找
    report_version = resolve_report_version(session_root, args.run_id, args.report_version)
    if report_version == "":
        print("      ⚠️ 没找到本次 runId 对应的报告版本号。")
        print("         正确做法：先调面板 POST /data-panel/integration")
        print("         { kind:'report', op:'createVersion', runId:'%s' } 拿版本号，" % args.run_id)
        print("         或用 --report-version 显式指定。本次临时用 runId 作文件名后缀。")
    else:
        print("     报告版本：%s" % report_version)

    overall, made = render_docx(module, template, data, report_dir, args.run_id,
                                args.software_name, report_version)
    data_path = write_report_data(report_dir, data, made, overall, args.run_id,
                                  step_version, case_version)
    print("     生成器：%s" % script_path)
    print("     模板：%s" % template)
    print("OK 总体报告 -> %s" % overall)
    print("OK 单条报告 %d 份 -> %s" % (len(made), report_dir / "cases"))
    print("OK report-data.json -> %s" % data_path)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))