"""Adversarial checks for the checker, never production-output acceptance."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import ezdxf
from ezdxf.math import Matrix44, Vec3

import oracle


class OracleTests(unittest.TestCase):
    def compare(self, mutate):
        with tempfile.TemporaryDirectory() as directory:
            doc = ezdxf.readfile(oracle.FIXTURE / "target.dxf")
            mutate(doc)
            actual, report = Path(directory) / "actual.dxf", Path(directory) / "report.json"
            doc.saveas(actual)
            with contextlib.redirect_stdout(io.StringIO()):
                oracle.check(actual, oracle.MANIFEST, report)
            return json.loads(report.read_text())

    def test_translation_and_entity_order_do_not_change_result(self):
        def mutate(doc):
            entities = list(doc.modelspace())
            for entity in entities:
                entity.transform(Matrix44.translate(125, -81, 0))
                doc.modelspace().unlink_entity(entity)
            for entity in reversed(entities):
                doc.modelspace().add_entity(entity)
        result = self.compare(mutate)
        self.assertEqual(result["strictReferenceChecksStatus"], "passed")
        self.assertEqual(result["status"], "reference-discrepancy")
        self.assertTrue(result["referenceDiscrepancies"])

    def test_changed_tolerance_fails_despite_same_entity_counts(self):
        result = self.compare(lambda d: setattr(d.entitydb["3F5"].dxf, "text", "<>"))
        item = next(i for i in result["items"] if i["id"] == "dimension.axial.left-stack")
        self.assertEqual(item["status"], "failed")
        self.assertEqual(next(c for c in item["checks"] if c["category"] == "content")["status"], "failed")

    def test_changed_native_target_fails_with_unchanged_picture(self):
        def mutate(doc):
            dimension = doc.entitydb["3CB"]
            dimension.dxf.defpoint2 += Vec3(2, 0, 0)
        result = self.compare(mutate)
        item = next(i for i in result["items"] if i["id"] == "dimension.axial.gear-width")
        self.assertEqual(next(c for c in item["checks"] if c["category"] == "targets")["status"], "failed")

    def test_changed_gdt_row_value_is_not_hidden_by_insert_count(self):
        def mutate(doc):
            symbol = doc.entitydb["434"]
            text = next(e for e in doc.blocks[symbol.dxf.name].query("MTEXT") if "0.003" in e.text)
            text.text = text.text.replace("0.003", "0.03")
        result = self.compare(mutate)
        item = next(i for i in result["items"] if i["id"] == "gdt.right-bearing")
        self.assertEqual(next(c for c in item["checks"] if c["category"] == "content")["status"], "failed")

    def test_text_position_and_font_metadata_are_checked(self):
        def mutate(doc):
            doc.entitydb["3C1"].dxf.text_midpoint += Vec3(0, 5, 0)
            doc.styles.get("PC_TEXTSTYLE").dxf.font = "arial.ttf"
        result = self.compare(mutate)
        item = next(i for i in result["items"] if i["id"] == "dimension.axial.overall")
        self.assertEqual(next(c for c in item["checks"] if c["category"] == "placement")["status"], "failed")
        self.assertEqual(next(c for c in item["checks"] if c["category"] == "typography")["status"], "failed")


if __name__ == "__main__":
    unittest.main()
