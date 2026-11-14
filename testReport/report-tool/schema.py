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
STATUS_OPTIONS = {"passed", "failed", "notRun"}


class SchemaError(ValueError):
    """Raised when report data does not conform to the contract."""

    pass


def _check(condition: bool, message: str, path: str = "") -> None:
    if not condition:
        raise SchemaError(f"{path}: {message}" if path else message)


def _str(value: Any, max_len: int = 0, path: str = "") -> str:
    where = f"{path}: " if path else ""
    _check(
        isinstance(value, str) and len(value) > 0,
        where + f"期望非空字符串，收到 {type(value).__name__}",
    )
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
        # also accept "2026/11/13" as a Chinese date notation
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
        item_path = f"{path}[{index}]"
        _check(
            isinstance(item, list) and len(item) == 2,
            "必须是长度为 2 的数组 [变量名, 取值]",
            item_path,
        )
        out.append(
            (
                _str(item[0], 120, f"{item_path}[0]"),
                # an input *value* may legitimately be the empty string — e.g.
                # a boundary test that submits an empty signature or password
                _opt_str(item[1], "", 2000, f"{item_path}[1]"),
            )
        )
    return out


def _outputs(value: Any, path: str = "outputs") -> List[_Output]:
    _check(isinstance(value, list), "必须是数组", path)
    out: List[_Output] = []
    for index, item in enumerate(value):
        item_path = f"{path}[{index}]"
        _check(
            isinstance(item, list) and len(item) == 3,
            "必须是长度为 3 的数组 [变量名, 预期输出, 实际输出]",
            item_path,
        )
        out.append(
            (
                _str(item[0], 120, f"{item_path}[0]"),
                _str(item[1], 2000, f"{item_path}[1]"),
                # the actual value is legitimately empty for a case that never
                # ran — "not measured" is not the same as "measured as blank"
                _opt_str(item[2], "", 2000, f"{item_path}[2]"),
            )
        )
    return out


def validate(raw: Any, skill_meta: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Return a normalised report object or raise SchemaError.

    *skill_meta* is the test procedure's skill file (see :mod:`skill_meta`).
    It supplies the **three people fields** — designer, reviewer, tester —
    because who designs, reviews and runs a procedure is decided once when the
    procedure is set up, not per run.

    Every other report field — unit id, design trace, driver, coverage,
    issues — is *technical output of the run* and must come from the execution
    data itself, never from the skill file.  Precedence for the people fields:

        run data (case)  >  run data (module)  >  skill file  >  empty
    """
    skill = skill_meta or {}
    skill_designer = skill.get("designer", "")
    skill_reviewer = skill.get("reviewer", "")
    skill_tester = skill.get("tester", "")
    _check(isinstance(raw, dict), "根元素必须是 JSON 对象")
    data = raw

    # ── meta ──
    meta = data.get("meta")
    _check(isinstance(meta, dict), "meta 必须是 JSON 对象")
    project = _str(meta.get("project"), 200, "meta.project")
    executed_at = _iso_date(meta.get("executedAt", ""), "meta.executedAt")
    executor = _opt_str(meta.get("executor"), "dsh-test-harness", 200, "meta.executor")

    # ── summary ──
    # ``notRun`` is optional so existing payloads (total = passed + failed)
    # keep working; when present it must balance too.
    summary = data.get("summary")
    _check(isinstance(summary, dict), "summary 必须是 JSON 对象")
    total = summary.get("total")
    passed = summary.get("passed")
    failed = summary.get("failed")
    not_run_total = summary.get("notRun", 0)
    _check(isinstance(total, int) and total >= 0, "summary.total 必须是非负整数")
    _check(isinstance(passed, int) and passed >= 0, "summary.passed 必须是非负整数")
    _check(isinstance(failed, int) and failed >= 0, "summary.failed 必须是非负整数")
    _check(
        isinstance(not_run_total, int) and not_run_total >= 0,
        "summary.notRun 必须是非负整数",
    )
    _check(
        passed + failed + not_run_total == total,
        f"summary.passed ({passed}) + summary.failed ({failed})"
        f" + summary.notRun ({not_run_total}) ≠ summary.total ({total})",
    )
    if not_run_total:
        executed = passed + failed
        coverage_rate = round(executed / total * 100, 1) if total else 0.0
    else:
        coverage_rate = 100.0 if total else 0.0

    # ── modules ──
    modules_raw = data.get("modules")
    _check(isinstance(modules_raw, list) and len(modules_raw) > 0, "modules 必须是非空数组")

    modules: List[Dict[str, Any]] = []
    case_ids: set = set()
    for mi, mod in enumerate(modules_raw):
        prefix = f"modules[{mi}]"
        _check(isinstance(mod, dict), f"{prefix} 必须是 JSON 对象")
        mod_name = _str(mod.get("name"), 200, f"{prefix}.name")
        # Every header field below is technical output of the run and must be
        # supplied by the producing system — none of it comes from the skill.
        # ``unitId`` defaults to the module name, ``trace``/``coverage`` to "-"
        # and ``driver`` to "无" so a minimal payload still renders.
        unit_id = _opt_str(mod.get("unitId"), mod_name, 200, f"{prefix}.unitId")
        trace = _opt_str(mod.get("trace"), "-", 300, f"{prefix}.trace")
        driver = _opt_str(mod.get("driver"), "无", 200, f"{prefix}.driver")
        coverage = _opt_str(mod.get("coverage"), "-", 200, f"{prefix}.coverage")
        # designer / reviewer / tester default to the skill file, which records who
        # owns this procedure; a module or case may override any of them.
        mod_designer = _opt_str(
            mod.get("designer"), skill_designer, 80, f"{prefix}.designer"
        )
        mod_reviewer = _opt_str(
            mod.get("reviewer"), skill_reviewer, 80, f"{prefix}.reviewer"
        )
        mod_tester = _opt_str(mod.get("tester"), skill_tester, 80, f"{prefix}.tester")

        cases_raw = mod.get("cases")
        _check(
            isinstance(cases_raw, list) and len(cases_raw) > 0,
            f"{prefix}.cases 必须是非空数组",
        )

        cases: List[Dict[str, Any]] = []
        for ci, case in enumerate(cases_raw):
            cprefix = f"{prefix}.cases[{ci}]"
            _check(isinstance(case, dict), f"{cprefix} 必须是 JSON 对象")

            case_id = _str(case.get("id"), 200, f"{cprefix}.id")
            _check(
                case_id not in case_ids,
                f"用例标识 {case_id!r} 重复出现",
            )
            case_ids.add(case_id)

            case_name = _str(case.get("name"), 200, f"{cprefix}.name")
            case_type = _str(case.get("type"), 40, f"{cprefix}.type")
            _check(
                case_type in TYPE_OPTIONS,
                f"测试类型 {case_type!r} 不在 {sorted(TYPE_OPTIONS)} 内",
            )

            desc = _str(case.get("description"), 4000, f"{cprefix}.description")
            func_desc = _opt_str(case.get("funcDesc"), case_name, 200, f"{cprefix}.funcDesc")
            stub = _opt_str(case.get("stub"), "无", 200, f"{cprefix}.stub")
            inserted = _opt_str(case.get("inserted"), "无", 200, f"{cprefix}.inserted")
            inp = _inputs(case.get("inputs"), f"{cprefix}.inputs")
            out = _outputs(case.get("outputs"), f"{cprefix}.outputs")

            passed_val = case.get("passed")
            _check(
                isinstance(passed_val, bool),
                f"{cprefix}.passed 必须是布尔值",
            )

            # Execution status: the three states the template's tick boxes can
            # express.  ``passed`` alone cannot say "never executed", which is
            # exactly what happens when the generator misses a case.
            status_raw = case.get("status")
            if status_raw is None:
                status = "passed" if passed_val else "failed"
            else:
                _check(
                    isinstance(status_raw, str),
                    f"{cprefix}.status 必须是字符串",
                )
                status = status_raw.strip()
                _check(
                    status in STATUS_OPTIONS,
                    f"执行状态 {status!r} 不在 {sorted(STATUS_OPTIONS)} 内",
                )
                # keep ``passed`` and ``status`` consistent
                if status == "notRun":
                    _check(
                        passed_val is False,
                        f"{cprefix}.status=notRun 但 passed={passed_val}；"
                        "未执行的用例不可能「通过」，请把 passed 设为 false",
                    )
                else:
                    expect_passed = status == "passed"
                    _check(
                        passed_val == expect_passed,
                        f"{cprefix}.passed={passed_val} 与 status={status!r} 矛盾",
                    )

            not_run_reason = _opt_str(case.get("notRunReason"), "", 500, f"{cprefix}.notRunReason")

            issue = _opt_str(case.get("issue"), "无", 4000, f"{cprefix}.issue")
            bug_id = _opt_str(case.get("bugId"), "无", 80, f"{cprefix}.bugId")
            designer = _opt_str(case.get("designer"), mod_designer, 80, f"{cprefix}.designer")
            reviewer = _opt_str(case.get("reviewer"), mod_reviewer, 80, f"{cprefix}.reviewer")
            tester = _opt_str(case.get("tester"), mod_tester, 80, f"{cprefix}.tester")
            case_exec_at = _opt_str(case.get("executedAt"), "", 40, f"{cprefix}.executedAt")

            cases.append(
                {
                    "id": case_id,
                    "name": case_name,
                    "type": case_type,
                    "description": desc,
                    "funcDesc": func_desc,
                    "stub": stub,
                    "inserted": inserted,
                    "inputs": inp,
                    "outputs": out,
                    "passed": passed_val,
                    "status": status,
                    "notRunReason": not_run_reason,
                    "issue": issue,
                    "bugId": bug_id,
                    "designer": designer,
                    "reviewer": reviewer,
                    "tester": tester,
                    "executedAt": case_exec_at,
                }
            )

        modules.append(
            {
                "name": mod_name,
                "unitId": unit_id,
                "trace": trace,
                "driver": driver,
                "coverage": coverage,
                "caseCount": len(cases),
                "issues": _opt_str(mod.get("issues"), "无。", 4000, f"{prefix}.issues"),
                "inconsistent": _opt_str(
                    mod.get("inconsistent"), "无。", 4000, f"{prefix}.inconsistent"
                ),
                "cases": cases,
            }
        )

    actual = sum(len(m["cases"]) for m in modules)
    _check(actual == total, f"modules 用例总数 ({actual}) ≠ summary.total ({total})")

    # The per-case statuses are the source of truth; summary must agree.
    counted = {"passed": 0, "failed": 0, "notRun": 0}
    for module in modules:
        for case in module["cases"]:
            counted[case["status"]] += 1
    _check(
        counted["passed"] == passed,
        f"用例中 status=passed 的有 {counted['passed']} 条，"
        f"但 summary.passed={passed}",
    )
    _check(
        counted["failed"] == failed,
        f"用例中 status=failed 的有 {counted['failed']} 条，"
        f"但 summary.failed={failed}",
    )
    _check(
        counted["notRun"] == not_run_total,
        f"用例中 status=notRun 的有 {counted['notRun']} 条，"
        f"但 summary.notRun={not_run_total}",
    )

    return {
        "meta": {"project": project, "executedAt": executed_at, "executor": executor},
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "notRun": not_run_total,
            "executedRate": coverage_rate,
        },
        "modules": modules,
    }