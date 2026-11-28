"""「备注信息」栏截图留痕的回归测试。

对应需求（用户 2026-11-28）：既然用 CUA 真点界面，就必须工作留痕 ——
报告用例表的「备注信息」栏要按步骤贴「输入步骤文字 + 该步截图」。

覆盖点：
  1. fill_remark_cell：有图时按「文字 → 图 → 文字 → 图」纵向排列
  2. fill_remark_cell：没截图的步骤只写文字，不写「无截图」
  3. fill_remark_cell：整条用例没图时维持「无」
  4. fill_remark_cell：图片路径失效时跳过，不产生破图占位
  5. fill_remark_cell：图片宽度固定 10cm，高度按原图比例自适应
  6. case_payload.resolve_shot：三种路径写法（相对 run / 相对 session_root / 绝对）都要能解析
  7. case_payload：解析不到的截图不写进 evidence

跑法：python -m unittest test_remark_shots -v
"""
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from docx import Document
from docx.shared import Cm

import integration_report as ir
import bridge


def _make_png(path: Path, width: int, height: int) -> None:
    """造一张纯色 PNG。优先用 Pillow，没有就用最小合法 PNG。"""
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image
        Image.new("RGB", (width, height), (235, 243, 255)).save(path)
        return
    except ImportError:
        pass
    # 兜底：1x1 透明 PNG（宽度断言会退化，但不会崩）
    import base64
    raw = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    path.write_bytes(raw)


class RemarkCellTest(unittest.TestCase):
    """直接测 fill_remark_cell 这一个函数。"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="remark-"))
        # 造一个只有 1x1 表格的 docx 当载体
        doc = Document()
        self.doc = doc
        self.table = doc.add_table(rows=1, cols=3)
        self.cell = self.table.rows[0].cells[2]

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _shots(self, count: int, size=(1200, 800)):
        paths = []
        for i in range(count):
            p = self.tmp / ("step-%d.png" % (i + 1))
            _make_png(p, *size)
            paths.append(str(p))
        return paths

    def test_图文按步骤纵向排列(self):
        shots = self._shots(2)
        steps = [
            {"no": 1, "operation": "点击进入「结算页」", "evidence": [shots[0]]},
            {"no": 2, "operation": "点击切换到「待付款」", "evidence": [shots[1]]},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)

        texts = [p.text.strip() for p in self.cell.paragraphs]
        self.assertIn("1. 点击进入「结算页」", texts)
        self.assertIn("2. 点击切换到「待付款」", texts)

        # 图必须紧跟在各自的文字后面
        idx1 = texts.index("1. 点击进入「结算页」")
        idx2 = texts.index("2. 点击切换到「待付款」")
        self.assertLess(idx1, idx2)

        pics = [len(p._p.findall(
            ".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip"))
            for p in self.cell.paragraphs]
        self.assertEqual(sum(pics), 2, "两张截图都要插进去")
        # 第 1 段文字之后、第 2 段文字之前应各有一张图
        self.assertEqual(pics[idx1], 0, "文字段自己不带图")
        self.assertEqual(pics[idx1 + 1], 1, "文字下面紧跟该步截图")
        self.assertEqual(pics[idx2 + 1], 1)

    def test_无截图步骤写文字加无截图三字(self):
        shots = self._shots(1)
        steps = [
            {"no": 1, "operation": "点击进入「结算页」", "evidence": [shots[0]]},
            {"no": 2, "operation": "查询数据库", "evidence": []},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)
        texts = [p.text.strip() for p in self.cell.paragraphs]
        self.assertIn("2. 查询数据库", texts)
        # 该步没有截图时，紧跟文字写「无截图」——留痕要求下「没有」也是信息
        self.assertIn("无截图", texts, "缺图要明说，不能让人以为排版漏了")
        idx = texts.index("2. 查询数据库")
        self.assertEqual(texts[idx + 1], "无截图", "「无截图」要紧跟在该步文字下面")
        # 有图的步骤不该被误标
        idx1 = texts.index("1. 点击进入「结算页」")
        pics1 = len(self.cell.paragraphs[idx1 + 1]._p.findall(
            ".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip"))
        self.assertEqual(pics1, 1, "第 1 步有图，不该写「无截图」")

    def test_多步混排时无截图只出现在缺图那步(self):
        shots = self._shots(2)
        steps = [
            {"no": 1, "operation": "步骤一", "evidence": [shots[0]]},
            {"no": 2, "operation": "步骤二", "evidence": []},
            {"no": 3, "operation": "步骤三", "evidence": [shots[1]]},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)
        texts = [p.text.strip() for p in self.cell.paragraphs]
        self.assertEqual(texts.count("无截图"), 1, "只有第 2 步缺图，只能出现一次")

    def test_整条用例一张图都没有时不留无截图(self):
        """全无图 → 整格维持「无」，不能变成一堆「无截图」。"""
        steps = [
            {"no": 1, "operation": "调用接口 A", "evidence": []},
            {"no": 2, "operation": "调用接口 B", "evidence": []},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)
        self.assertEqual(self.cell.text.strip(), "无")

    def test_整条用例无图时保持无(self):
        steps = [{"no": 1, "operation": "调用接口", "evidence": []}]
        ir.fill_remark_cell(self.cell, {}, steps)
        self.assertEqual(self.cell.text.strip(), "无")

    def test_有用户备注时优先显示在首行(self):
        shots = self._shots(1)
        steps = [{"no": 1, "operation": "点击进入", "evidence": [shots[0]]}]
        ir.fill_remark_cell(self.cell, {"note": "环境为测试环境"}, steps)
        texts = [p.text.strip() for p in self.cell.paragraphs]
        self.assertEqual(texts[0], "环境为测试环境")

    def test_失效图片被跳过不留破图(self):
        good = self._shots(1)[0]
        steps = [
            {"no": 1, "operation": "第一步", "evidence": [good]},
            {"no": 2, "operation": "第二步", "evidence": [str(self.tmp / "not-exist.png")]},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)
        pics = [len(p._p.findall(
            ".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip"))
            for p in self.cell.paragraphs]
        self.assertEqual(sum(pics), 1, "只有存在的图被插入")
        # 第二步文字照样保留，且补上「无截图」
        texts = [p.text.strip() for p in self.cell.paragraphs]
        self.assertIn("2. 第二步", texts)
        idx = texts.index("2. 第二步")
        self.assertEqual(texts[idx + 1], "无截图", "路径失效等同于没截图")

    def test_文件存在但内容不是图片也要写无截图(self):
        """加一道保险：上游没滤干净时，坏图不能静默消失，要标「无截图」。"""
        good = self._shots(1)[0]
        broken = self.tmp / "broken.png"
        broken.write_bytes(b"this is not a png")
        steps = [
            {"no": 1, "operation": "第一步", "evidence": [good]},
            {"no": 2, "operation": "第二步", "evidence": [str(broken)]},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)
        pics = sum(len(p._p.findall(
            ".//{http://schemas.openxmlformats.org/drawingml/2006/main}blip"))
            for p in self.cell.paragraphs)
        self.assertEqual(pics, 1, "坏图不能插进去")
        texts = [p.text.strip() for p in self.cell.paragraphs]
        idx = texts.index("2. 第二步")
        self.assertEqual(texts[idx + 1], "无截图")

    def test_图宽固定10cm高按比例自适应(self):
        # 两个不同长宽比：横向 1200x800(1.5) 与纵向 1200x2000(0.6)
        wide = self.tmp / "wide.png"
        tall = self.tmp / "tall.png"
        _make_png(wide, 1200, 800)
        _make_png(tall, 1200, 2000)
        try:
            from PIL import Image  # noqa: F401
        except ImportError:
            self.skipTest("需要 Pillow 才能校验真实像素比例")

        steps = [
            {"no": 1, "operation": "横向图", "evidence": [str(wide)]},
            {"no": 2, "operation": "纵向图", "evidence": [str(tall)]},
        ]
        ir.fill_remark_cell(self.cell, {}, steps)

        shapes = self.doc.inline_shapes
        self.assertEqual(len(shapes), 2)
        for shape in shapes:
            self.assertAlmostEqual(shape.width.cm, 10.0, places=1, msg="宽度必须固定 10cm")
        # 高度比 = 原图高宽比
        self.assertAlmostEqual(shapes[0].height.cm, 10 * 800 / 1200, places=1)
        self.assertAlmostEqual(shapes[1].height.cm, 10 * 2000 / 1200, places=1)


class ResolveShotTest(unittest.TestCase):
    """case_payload 里把 evidence 路径收敛成绝对路径的逻辑。"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="resolve-"))
        self.session_root = self.tmp / "proj" / ".dsh" / "test-sessions" / "s1" / "integration"
        self.run_dir = self.session_root / "runs" / "run_x"
        self.shots = self.run_dir / "shots"
        self.png = self.shots / "V1-IT-001-step-1.png"
        _make_png(self.png, 800, 600)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _payload_evidence(self, raw):
        """跑一遍 case_payload，取回解析后的 evidence。"""
        payload = bridge.case_payload(
            {"caseId": "V1-IT-001"},
            {"V1-IT-001|1": {"outcome": "passed", "observed": "ok", "evidence": [raw]}},
            [{"no": 1, "action": "a", "operation": "o", "expected": "e"}],
            run_dir=self.run_dir,
        )
        return payload["steps"][0]["evidence"]

    def test_相对run目录(self):
        got = self._payload_evidence("shots/V1-IT-001-step-1.png")
        self.assertEqual(len(got), 1)
        self.assertTrue(os.path.isfile(got[0]))

    def test_相对session_root(self):
        got = self._payload_evidence("runs/run_x/shots/V1-IT-001-step-1.png")
        self.assertEqual(len(got), 1)
        self.assertTrue(os.path.isfile(got[0]))

    def test_绝对路径(self):
        got = self._payload_evidence(str(self.png))
        self.assertEqual(len(got), 1)
        self.assertTrue(os.path.isfile(got[0]))

    def test_解析不到就丢弃(self):
        got = self._payload_evidence("shots/not-exist.png")
        self.assertEqual(got, [], "不存在的图不能进 evidence，否则报告出破图")

    def test_没有evidence字段也不报错(self):
        payload = bridge.case_payload(
            {"caseId": "V1-IT-001"},
            {"V1-IT-001|1": {"outcome": "passed", "observed": "ok"}},
            [{"no": 1, "action": "a", "operation": "o", "expected": "e"}],
            run_dir=self.run_dir,
        )
        self.assertEqual(payload["steps"][0]["evidence"], [])


class EvidenceIndexTest(unittest.TestCase):
    """build_evidence_index 要把 evidence[] 收进来。"""

    def test_从steps和observations收集截图(self):
        result = {"steps": [
            {"caseId": "C1", "stepNo": 1, "outcome": "passed",
             "observed": "ok", "evidence": ["shots/a.png"]},
        ]}
        observations = {"items": [
            {"caseId": "C1", "stepNo": 2, "outcome": "passed",
             "observed": "ok", "evidence": ["shots/b.png"]},
        ]}
        index = bridge.build_evidence_index(result, observations)
        self.assertEqual(index["C1|1"]["evidence"], ["shots/a.png"])
        self.assertEqual(index["C1|2"]["evidence"], ["shots/b.png"])

    def test_evidence写成字符串也能吃(self):
        result = {"steps": [
            {"caseId": "C1", "stepNo": 1, "outcome": "passed",
             "observed": "ok", "evidence": "shots/a.png"},
        ]}
        index = bridge.build_evidence_index(result, {})
        self.assertEqual(index["C1|1"]["evidence"], ["shots/a.png"])

    def test_没有evidence时不留空键(self):
        result = {"steps": [
            {"caseId": "C1", "stepNo": 1, "outcome": "passed", "observed": "ok"},
        ]}
        index = bridge.build_evidence_index(result, {})
        self.assertNotIn("evidence", index["C1|1"], "没图就不要塞空列表，省得下游误判")


if __name__ == "__main__":
    unittest.main(verbosity=2)