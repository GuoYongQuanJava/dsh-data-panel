"""Validate the report JSON schema before it reaches the builder.

Any structural violation raises ValueError with a human-readable message.
The builder must call :func:`validate` before touching the template.
"""

import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

TYPE_OPTIONS = {"功能测试", "接口测试", "边界测试", "逻辑测试", "性能测试"}

# Execution states expressible by the template's two tick-box rows.
#   passed  → 执行情况[√]执行   执行结果[√]通过  □ 未通过
#   failed  → 执行情况[√]执行   执行结果 □ 通过  [√]未通过
#   notRun  → 执行情况 □ 执行   [√]未执行   执行结果 □ 通过  □ 未通过
STATUS_OPTIONS = {"passed", "failed", "notRun", "unconfirmed"}

COVERAGE_TYPES = ("line", "block", "statement", "branch", "mcdc")


class SchemaError(ValueError):
    """Raised when report data does not conform to the contract."""
    pass


def _check(condition: bool, message: str, path: str = "") -> None:
    if not condition:
        raise SchemaError(f"{path}: {message}" if path else message)


def _str(value: Any, max_len: int = 0, path: str = "") -> str:
    where = f"{path}: " if path else ""
    _check(isinstance(value, str) and len(value) > 0,
           where + f"期望非空字符串，收到 {type(value).__name__}")
    if max_len and len(value) > max_len:
        raise SchemaError(where + f"字符串长度 {len(value)} 超过上限 {max_len}")
    return value


def _opt_str(value: Any, default: str = "", max_len: int = 0, path: str = "") -> str:
    if value is None or value == "":
        return default
    return _str(value, max_len, path)


def _iso_date(value: str, path: str = "") -> str:
    where = f"{path}: " if path else ""
    if not isinstance(value, str) or not value:
        raise SchemaError(where + f"期望非空字符串，收到 {type(value).__name__}")
    try:
        datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        try:
            datetime.datetime.strptime(value, "%Y/%m/%d")
        except (ValueError, TypeError):
            raise SchemaError(where + f"日期格式无效：{value!r}（期望 ISO-8601 或 yyyy/mm/dd）")
    return value


_Input = Tuple[str, str]
_Output = Tuple[str, str, str]


def _inputs(value: Any, path: str = "inputs") -> List[_Input]:
    _check(isinstance(value, list), "必须是数组", path)
    out: List[_Input] = []
    for index, item in enumerate(value):
        ipath = f"{path}[{index}]"
        _check(isinstance(item, list) and len(item) == 2,
               "必须是长度为 2 的数组 [变量名, 取值]", ipath)
        out.append((_str(item[0], 120, f"{ipath}[0]"),
                     _opt_str(item[1], "", 2000, f"{ipath}[1]")))
    return out


def _outputs(value: Any, path: str = "outputs") -> List[_Output]:
    _check(isinstance(value, list), "必须是数组", path)
    out: List[_Output] = []
    for index, item in enumerate(value):
        ipath = f"{path}[{index}]"
        _check(isinstance(item, list) and len(item) == 3,
               "必须是长度为 3 的数组 [变量名, 预期输出, 实际输出]", ipath)
        out.append((_str(item[0], 120, f"{ipath}[0]"),
                     _opt_str(item[1], "", 2000, f"{ipath}[1]"),
                     _opt_str(item[2], "", 2000, f"{ipath}[2]")))
    return out


def _validate_summary_block(s: dict, path: str) -> dict:
    """Validate a {total, passed, failed, notRun, unconfirmed} block."""
    keys = ("total", "passed", "failed", "notRun", "unconfirmed")
    vals: Dict[str, int] = {}
    for k in keys:
        v = s.get(k, 0) if k in ("notRun", "unconfirmed") else s.get(k)
        _check(isinstance(v, int) and v >= 0, f"{path}.{k} 必须是非负整数")
        vals[k] = v
    _check(vals["passed"] + vals["failed"] + vals["notRun"] + vals["unconfirmed"] == vals["total"],
           f"{path}: passed+failed+notRun+unconfirmed ≠ total ({vals['total']})")
    return vals


def _validate_coverage(coverage: dict, path: str = "coverage") -> dict:
    """Validate a coverage block: line, block, statement, branch, mcdc."""
    available = coverage.get("available")
    _check(isinstance(available, bool), f"{path}.available 必须是布尔值")
    normalized: Dict[str, Any] = {"available": available}
    reason = coverage.get("reason")
    if reason is not None:
        normalized["reason"] = _str(reason, 500, f"{path}.reason")
    has_percent = False
    for ct in COVERAGE_TYPES:
        ct_data = coverage.get(ct)
        if isinstance(ct_data, dict) and ct_data:  # 空对象视为未提供
            _check(isinstance(ct_data, dict), f"{path}.{ct} 必须是 JSON 对象")
            for field in ("total", "covered"):
                v = ct_data.get(field)
                _check(isinstance(v, (int, float)) and v >= 0,
                       f"{path}.{ct}.{field} 必须是非负数")
            pct = ct_data.get("percent")
            _check(isinstance(pct, (int, float)) and 0 <= pct <= 100,
                   f"{path}.{ct}.percent 必须在 0-100 之间")
            normalized[ct] = {"total": ct_data["total"],
                              "covered": ct_data["covered"],
                              "percent": pct}
            if pct > 0:
                has_percent = True
    if not available and has_percent:
        raise SchemaError(f"{path}: available=false 但存在百分比 > 0 的覆盖率数据")
    sf = coverage.get("sourceFile")
    if sf is not None:
        normalized["sourceFile"] = _opt_str(sf, "", 500, f"{path}.sourceFile")
    return normalized


def validate(raw: Any, skill_meta: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Return a normalised report object or raise SchemaError.

    *skill_meta* is the test procedure's skill file (see :mod:`skill_meta`).
    In v2 data the people fields come from the execution data itself;
    *skill_meta* is kept for compatibility but no longer drives defaults.
    """
    _check(isinstance(raw, dict), "根元素必须是 JSON 对象")
    data = raw

    # ── schemaVersion ──
    version = data.get("schemaVersion")
    _check(version == "2.0", f'schemaVersion 必须是 "2.0"，收到 {version!r}')

    # ── meta ──
    meta = data.get("meta")
    _check(isinstance(meta, dict), "meta 必须是 JSON 对象")

    def _meta_str(k, max_len=200):
        return _str(meta.get(k), max_len, f"meta.{k}")
    def _meta_opt(k, default="", max_len=200):
        return _opt_str(meta.get(k), default, max_len, f"meta.{k}")

    norm_meta = {
        "project": _meta_str("project"),
        "projectPackage": _meta_opt("projectPackage", "", 80),
        "softwareVersion": _meta_opt("softwareVersion", "", 40),
        "devUnit": _meta_opt("devUnit", "", 120),
        "importance": _meta_opt("importance", "", 20),
        "language": _meta_opt("language", "", 40),
        "executedAt": _iso_date(meta.get("executedAt", ""), "meta.executedAt"),
        "executor": _meta_opt("executor", "未记录执行器"),
        "runId": _meta_opt("runId"),
        "status": _meta_opt("status", "", 40),
        "statusText": _meta_opt("statusText"),
        "durationMs": meta.get("durationMs"),
        "exitCode": meta.get("exitCode"),
        "logPath": _meta_opt("logPath", "", 500),
        "resultPath": _meta_opt("resultPath", "", 500),
        "note": _meta_opt("note", "", 2000),
    }
    # references / people（可选，由项目配置文件提供）
    refs = meta.get("references")
    if isinstance(refs, list):
        norm_meta["references"] = [
            {"type": str(r.get("type") or ""),
             "name": str(r.get("name") or ""),
             "version": str(r.get("version") or "")}
            for r in refs if isinstance(r, dict)
        ]
    people = meta.get("people")
    if isinstance(people, dict):
        norm_meta["people"] = {
            k: str(people.get(k) or "") for k in ("designer", "reviewer", "tester")
        }
    for field, label in (("durationMs", "durationMs 必须是整数或 null"),
                          ("exitCode", "exitCode 必须是整数或 null")):
        v = norm_meta[field]
        _check(isinstance(v, int) or v is None, f"meta.{label}")

    # ── provenance / scope (optional dicts) ──
    for section in ("provenance", "scope"):
        s = data.get(section)
        _check(isinstance(s, (dict, type(None))), f"{section} 必须是 JSON 对象")

    # ── summary ──
    summary = data.get("summary")
    _check(isinstance(summary, dict), "summary 必须是 JSON 对象")
    sv = _validate_summary_block(summary, "summary")
    total, passed, failed, not_run, unconfirmed = (sv["total"], sv["passed"],
        sv["failed"], sv["notRun"], sv["unconfirmed"])
    executed_count = passed + failed + unconfirmed
    total_dur = summary.get("totalDurationMs", 0)
    _check(isinstance(total_dur, int) and total_dur >= 0,
           "summary.totalDurationMs 必须是非负整数")

    norm_summary = {
        "total": total, "passed": passed, "failed": failed,
        "notRun": not_run, "unconfirmed": unconfirmed,
        "executed": executed_count,
        "executionRate": round(executed_count / total * 100, 1) if total else 0.0,
        "passRate": round(passed / executed_count * 100, 1) if executed_count else 0.0,
        "skipRate": round(not_run / total * 100, 1) if total else 0.0,
        "totalDurationMs": total_dur,
    }

    # ── phases ──
    phases_raw = data.get("phases")
    _check(isinstance(phases_raw, list) and len(phases_raw) > 0,
           "phases 必须是非空数组")

    phases: List[Dict[str, Any]] = []
    phase_ids: set = set()
    all_func_ids: set = set()
    all_case_ids: set = set()
    gcount: Dict[str, int] = {"passed": 0, "failed": 0, "notRun": 0, "unconfirmed": 0}

    for pi, phase in enumerate(phases_raw):
        pp = f"phases[{pi}]"
        _check(isinstance(phase, dict), f"{pp} 必须是 JSON 对象")
        phase_id = _str(phase.get("phaseId"), 200, f"{pp}.phaseId")
        _check(phase_id not in phase_ids, f"phaseId {phase_id!r} 重复出现")
        phase_ids.add(phase_id)
        phase_name = _str(phase.get("name"), 200, f"{pp}.name")
        phase_order = phase.get("order")
        _check(isinstance(phase_order, int) and phase_order >= 1,
               f"{pp}.order 必须是正整数")

        functions_raw = phase.get("functions")
        _check(isinstance(functions_raw, list) and len(functions_raw) > 0,
               f"{pp}.functions 必须是非空数组")

        functions: List[Dict[str, Any]] = []
        for fi, func in enumerate(functions_raw):
            fp = f"{pp}.functions[{fi}]"
            _check(isinstance(func, dict), f"{fp} 必须是 JSON 对象")
            func_id = _str(func.get("functionId"), 200, f"{fp}.functionId")
            _check(func_id not in all_func_ids,
                   f"functionId {func_id!r} 跨 phase 重复出现")
            all_func_ids.add(func_id)

            func_name = _str(func.get("name"), 200, f"{fp}.name")
            source_file = _opt_str(func.get("sourceFile"), "未记录源文件", 500, f"{fp}.sourceFile")

            # function.summary
            fs = func.get("summary")
            _check(isinstance(fs, dict), f"{fp}.summary 必须是 JSON 对象")
            fsv = _validate_summary_block(fs, f"{fp}.summary")
            ftotal, fpassed, ffailed, fnot, funconf = (fsv["total"], fsv["passed"],
                fsv["failed"], fsv["notRun"], fsv["unconfirmed"])

            unit_id = _opt_str(func.get("unitId"), "未记录单元标识", 200, f"{fp}.unitId")
            trace = _opt_str(func.get("trace"), "未提供设计追溯", 300, f"{fp}.trace")
            driver = _opt_str(func.get("driver"), "未记录驱动模块", 200, f"{fp}.driver")
            coverage = _opt_str(func.get("coverage"), "未采集", 200, f"{fp}.coverage")

            # ── cases ──
            cases_raw = func.get("cases")
            _check(isinstance(cases_raw, list) and len(cases_raw) > 0,
                   f"{fp}.cases 必须是非空数组")

            cases: List[Dict[str, Any]] = []
            for ci, case in enumerate(cases_raw):
                cp = f"{fp}.cases[{ci}]"
                _check(isinstance(case, dict), f"{cp} 必须是 JSON 对象")

                case_id = _str(case.get("id"), 200, f"{cp}.id")
                _check(case_id not in all_case_ids, f"用例标识 {case_id!r} 重复出现")
                all_case_ids.add(case_id)

                case_name = _str(case.get("name"), 200, f"{cp}.name")
                case_type = _str(case.get("type"), 40, f"{cp}.type")
                _check(case_type in TYPE_OPTIONS,
                       f"测试类型 {case_type!r} 不在 {sorted(TYPE_OPTIONS)} 内")

                desc = _str(case.get("description"), 12000, f"{cp}.description")
                func_desc = _opt_str(case.get("funcDesc"), case_name, 200, f"{cp}.funcDesc")
                test_func = _opt_str(case.get("testFunc"), "", 200, f"{cp}.testFunc")
                subject_function = _opt_str(case.get("subjectFunction"), "", 200,
                                            f"{cp}.subjectFunction")
                stub = _opt_str(case.get("stub"), "未记录", 200, f"{cp}.stub")
                inserted = _opt_str(case.get("inserted"), "未记录", 200, f"{cp}.inserted")
                inp = _inputs(case.get("inputs"), f"{cp}.inputs")
                out = _outputs(case.get("outputs"), f"{cp}.outputs")

                passed_val = case.get("passed")
                _check(isinstance(passed_val, bool), f"{cp}.passed 必须是布尔值")

                status_raw = case.get("status")
                if status_raw is None:
                    status_val = "passed" if passed_val else "failed"
                else:
                    _check(isinstance(status_raw, str), f"{cp}.status 必须是字符串")
                    status_val = status_raw.strip()
                    _check(status_val in STATUS_OPTIONS,
                           f"执行状态 {status_val!r} 不在 {sorted(STATUS_OPTIONS)} 内")
                    if status_val == "notRun":
                        _check(passed_val is False,
                               f"{cp}.status=notRun 但 passed={passed_val}；"
                               "未执行的用例不可能「通过」，请把 passed 设为 false")
                    else:
                        _check(passed_val == (status_val == "passed"),
                               f"{cp}.passed={passed_val} 与 status={status_val!r} 矛盾")

                not_run_reason = _opt_str(case.get("notRunReason"), "", 500, f"{cp}.notRunReason")
                issue = _opt_str(case.get("issue"), "未记录异常", 4000, f"{cp}.issue")
                bug_id = _opt_str(case.get("bugId"), "未记录", 80, f"{cp}.bugId")
                designer = _opt_str(case.get("designer"), "", 80, f"{cp}.designer")
                reviewer = _opt_str(case.get("reviewer"), "", 80, f"{cp}.reviewer")
                tester = _opt_str(case.get("tester"), "", 80, f"{cp}.tester")
                case_exec_at = _opt_str(case.get("executedAt"), "", 40, f"{cp}.executedAt")

                gcount[status_val] += 1

                cases.append({
                    "id": case_id, "name": case_name, "type": case_type,
                    "description": desc, "funcDesc": func_desc,
                    "testFunc": test_func, "subjectFunction": subject_function,
                    "stub": stub, "inserted": inserted,
                    "inputs": inp, "outputs": out,
                    "passed": passed_val, "status": status_val,
                    "notRunReason": not_run_reason,
                    "issue": issue, "bugId": bug_id,
                    "designer": designer, "reviewer": reviewer,
                    "tester": tester, "executedAt": case_exec_at,
                })

            _check(len(cases) == ftotal,
                   f"{fp}: cases 数量 ({len(cases)}) ≠ summary.total ({ftotal})")

            functions.append({
                "functionId": func_id, "name": func_name,
                "sourceFile": source_file,
                "summary": {"total": ftotal, "passed": fpassed,
                            "failed": ffailed, "notRun": fnot,
                            "unconfirmed": funconf},
                "unitId": unit_id, "trace": trace, "driver": driver,
                "coverage": coverage, "cases": cases,
            })

        phases.append({
            "phaseId": phase_id, "name": phase_name, "order": phase_order,
            "functions": functions,
            "phaseIssues": _opt_str(phase.get("phaseIssues"), "", 4000, f"{pp}.phaseIssues"),
            "phaseInconsistent": _opt_str(phase.get("phaseInconsistent"), "", 4000,
                                          f"{pp}.phaseInconsistent"),
        })

    # ── cross-level balance ──
    actual_total = sum(len(f["cases"]) for p in phases for f in p["functions"])
    _check(actual_total == total,
           f"phases 用例总数 ({actual_total}) ≠ summary.total ({total})")

    for st in ("passed", "failed", "notRun", "unconfirmed"):
        _check(gcount[st] == sv[st],
               f"用例中 status={st} 的有 {gcount[st]} 条，但 summary.{st}={sv[st]}")

    # ── coverage ──
    coverage_raw = data.get("coverage")
    norm_coverage = None
    if coverage_raw is not None:
        _check(isinstance(coverage_raw, dict), "coverage 必须是 JSON 对象")
        norm_coverage = _validate_coverage(coverage_raw)

    # ── reviews / issues / consistency / regressions (lenient) ──
    for sec in ("reviews", "issues", "consistency", "regressions"):
        s = data.get(sec)
        _check(isinstance(s, (dict, type(None))), f"{sec} 必须是 JSON 对象")

    result: Dict[str, Any] = {
        "schemaVersion": "2.0", "meta": norm_meta,
        "provenance": data.get("provenance"),
        "scope": data.get("scope"),
        "summary": norm_summary, "phases": phases,
    }
    if norm_coverage is not None:
        result["coverage"] = norm_coverage
    for sec in ("reviews", "issues", "consistency", "regressions"):
        v = data.get(sec)
        if v is not None:
            result[sec] = v
    # ── 模型分析字段（report-notes.json 合并而来），原样透传给 builder ──
    for key in ("overallAssessment", "environmentImpact", "improvements", "staticItems"):
        value = data.get(key)
        if value is not None:
            result[key] = value

    return result