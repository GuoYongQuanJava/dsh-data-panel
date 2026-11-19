"""圈复杂度链路的测试：lizard 来源优先级 + 降级行为。

覆盖的事实：
1. 本机装了 lizard 就用本机的（system）；
2. 本机没装时自动降级到 testReport/vendor 里带的副本（vendored）；
3. 两者都没有时返回空列表，不抛异常（调用方据此写"未开展"）；
4. 源码目录识别（项目根 → src / 直接传源码目录）；
5. bridge 把结果写进 report-data.json 的 staticItems，并同步 reviews.staticAnalysisDone。

运行：python test_complexity.py
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

sys.stdout.reconfigure(encoding='utf-8')

import complexity  # noqa: E402

failures = []
tmp = Path(tempfile.mkdtemp(prefix="rpt-cc-"))


def check(condition, message):
    print(("  PASS  " if condition else "  FAIL  ") + message)
    if not condition:
        failures.append(message)


def make_cpp_project(base: Path) -> Path:
    """造一个含 if/for 的小 C++ 项目，圈复杂度可预期。"""
    project = base / "demo"
    (project / "src").mkdir(parents=True)
    (project / "src" / "calc.cpp").write_text(
        "int simple(int a) {\n"
        "    return a + 1;\n"
        "}\n"
        "\n"
        "int branchy(int a) {\n"
        "    if (a > 0) { return 1; }\n"
        "    if (a < 0) { return -1; }\n"
        "    return 0;\n"
        "}\n"
        "\n"
        "int loopy(int n) {\n"
        "    int s = 0;\n"
        "    for (int i = 0; i < n; i++) {\n"
        "        if (i % 2 == 0) { s += i; }\n"
        "    }\n"
        "    return s;\n"
        "}\n",
        encoding="utf-8",
    )
    return project


project = make_cpp_project(tmp)

print("== lizard 来源 ==")
lizard_module, source = complexity.load_lizard()
check(lizard_module is not None, f"能加载 lizard（来源={source or '无'}）")
check(source in ("system", "vendored"), f"来源标记合法：{source!r}")
check(complexity.VENDOR_DIR.is_dir(), f"vendor 目录存在：{complexity.VENDOR_DIR}")

print("\n== 源码目录识别 ==")
check(complexity.resolve_source_dir(project) == project / "src", "项目根 → src")
check(complexity.resolve_source_dir(project / "src") == project / "src", "直接传 src 原样返回")
check(complexity.resolve_source_dir(tmp / "no-such") is None, "不存在的目录 → None")

print("\n== 分析结果 ==")
items = complexity.analyze(project)
check(len(items) == 3, f"3 个函数（实际 {len(items)}）")
by_name = {item["function"]: item for item in items}
check(by_name.get("simple", {}).get("complexity") == 1, f"simple CC={by_name.get('simple', {}).get('complexity')}")
check(by_name.get("branchy", {}).get("complexity") == 3, f"branchy CC={by_name.get('branchy', {}).get('complexity')}")
check(by_name.get("loopy", {}).get("complexity") == 3, f"loopy CC={by_name.get('loopy', {}).get('complexity')}")
check(items == sorted(items, key=lambda i: (-i["complexity"], i["function"])), "结果按复杂度降序")
check(all(set(i) == {"function", "file", "complexity", "nloc"} for i in items), "字段完整")

print("\n== 降级：vendor 缺失 ==")
original_vendor = complexity.VENDOR_DIR
saved_module, saved_source = complexity._lizard_module, complexity._lizard_source
complexity._lizard_module = None
complexity._lizard_source = ""
complexity.VENDOR_DIR = tmp / "no-vendor"
# 只有在系统没装 lizard 时才能验证「都没有」的分支
if source == "system":
    print("  (跳过) 本机已装 lizard，无法模拟全缺")
else:
    module, kind = complexity.load_lizard()
    check(module is None and kind == "", "vendor 缺失且未安装 → 未找到")
    check(complexity.analyze(project) == [], "未找到时返回空列表，不抛异常")

complexity.VENDOR_DIR = original_vendor
complexity._lizard_module = saved_module
complexity._lizard_source = saved_source

print("\n== vendor 副本在没有 site-packages 时可用 ==")
if complexity.VENDOR_DIR.is_dir():
    code = f'''
import sys
sys.stdout.reconfigure(encoding="utf-8")
sys.path = [p for p in sys.path if "site-packages" not in p]
sys.path.insert(0, r"{Path(__file__).resolve().parent}")
import complexity
module, kind = complexity.load_lizard()
items = complexity.analyze(r"{project}")
print(kind)
print(len(items))
'''
    proc = subprocess.run([sys.executable, "-X", "utf8", "-c", code],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = proc.stdout.strip().splitlines()
    if proc.returncode != 0:
        check(False, f"屏蔽 site-packages 后运行失败：{proc.stderr.strip()[-300:]}")
    else:
        kind = lines[0] if lines else ""
        count = int(lines[1]) if len(lines) > 1 else -1
        check(kind == "vendored", f"自动降级到 vendor：{kind!r}")
        check(count == 3, f"vendor 版本同样分析出 3 个函数（实际 {count}）")
else:
    print("  (跳过) 没有 vendor 目录")

print("\n== CLI ==")
proc = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "complexity.py"),
                       str(project), "--json"],
                      capture_output=True, text=True, encoding="utf-8", errors="replace")
check(proc.returncode == 0, f"--json 退出码 0（实际 {proc.returncode}）")
try:
    payload = json.loads(proc.stdout)
    check(payload.get("source") in ("system", "vendored"), f"JSON 带来源：{payload.get('source')}")
    check(len(payload.get("items") or []) == 3, "JSON 带 3 条结果")
except json.JSONDecodeError:
    check(False, f"--json 输出不是合法 JSON：{proc.stdout[:120]}")

proc = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "complexity.py")],
                      capture_output=True, text=True, encoding="utf-8", errors="replace")
check(proc.returncode == 2, f"缺参数退出码 2（实际 {proc.returncode}）")

print("\n== bridge 集成 ==")
run_dir = tmp / "proj" / ".dsh" / "test-sessions" / "s1" / "runs" / "r1"
(run_dir / "snapshot").mkdir(parents=True)
(run_dir / "snapshot" / "cases.json").write_text(json.dumps([{
    "caseId": "TC-1", "title": "用例一", "testType": "functional",
    "description": "", "input": "", "expected": "", "codeRef": "",
    "testFunc": "test_one", "status": "pending",
    "subjectFunction": "src/calc.cpp::branchy",
}]), encoding="utf-8")
(run_dir / "result.json").write_text(json.dumps({
    "runId": "r1",
    "startedAt": "2026-01-01T00:00:00+08:00",
    "status": "passed",
    "project": str(project),
    "cases": ["TC-1"],
    "tests": [{"caseId": "TC-1", "func": "test_one", "outcome": "passed"}],
    "runner": {"id": "gtest-batch", "label": "GoogleTest", "language": "cpp"},
}), encoding="utf-8")

out = tmp / "report-data.json"
proc = subprocess.run([sys.executable, str(Path(__file__).resolve().parent / "bridge.py"),
                       "--run", str(run_dir / "result.json"), "--out", str(out)],
                      capture_output=True, text=True, encoding="utf-8", errors="replace")
check(proc.returncode == 0, f"bridge 退出码 0（实际 {proc.returncode}）{proc.stderr.strip()[:200]}")
if out.is_file():
    data = json.loads(out.read_text(encoding="utf-8"))
    static_items = data.get("staticItems") or []
    check(len(static_items) == 3, f"report-data.staticItems 3 条（实际 {len(static_items)}）")
    check(data["reviews"]["staticAnalysisDone"] is True, "staticAnalysisDone=True")
    check(all("complexity" in i and "function" in i for i in static_items), "staticItems 字段齐全")
else:
    check(False, "bridge 没有产出 report-data.json")

print()
if failures:
    print(f"FAILED {len(failures)}: {failures}")
    sys.exit(1)
print("ALL COMPLEXITY TESTS PASSED")