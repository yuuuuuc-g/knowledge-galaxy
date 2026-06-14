import os
import sys
import tempfile
import types
import unittest

ebooklib_stub = types.ModuleType("ebooklib")
ebooklib_stub.ITEM_DOCUMENT = 9
epub_stub = types.ModuleType("ebooklib.epub")
epub_stub.read_epub = lambda _path: None
ebooklib_stub.epub = epub_stub
sys.modules.setdefault("ebooklib", ebooklib_stub)
sys.modules.setdefault("ebooklib.epub", epub_stub)

bs4_stub = types.ModuleType("bs4")
bs4_stub.BeautifulSoup = object
sys.modules.setdefault("bs4", bs4_stub)

openai_stub = types.ModuleType("openai")
openai_stub.OpenAI = object
sys.modules.setdefault("openai", openai_stub)

supabase_stub = types.ModuleType("supabase")
supabase_stub.create_client = lambda *_args, **_kwargs: None
sys.modules.setdefault("supabase", supabase_stub)

dotenv_stub = types.ModuleType("dotenv")
dotenv_stub.load_dotenv = lambda *_args, **_kwargs: None
sys.modules.setdefault("dotenv", dotenv_stub)

from ingest import (
    cleanup_marker_output,
    compute_file_sha256,
    chunk_text,
    parse_args,
    split_long_paragraph,
)


class IngestUtilityTests(unittest.TestCase):
    def test_parse_args_accepts_cli_metadata(self):
        config = parse_args([
            "--path",
            "materials/source.md",
            "--title",
            "国家能力",
            "--author",
            "研究者",
            "--report-path",
            "data/report.json",
            "--allow-duplicate",
            "--keep-temp",
        ])

        self.assertEqual(config.target_path, "materials/source.md")
        self.assertEqual(config.book_title, "国家能力")
        self.assertEqual(config.book_author, "研究者")
        self.assertEqual(config.report_path, "data/report.json")
        self.assertTrue(config.allow_duplicate)
        self.assertTrue(config.keep_temp)

    def test_parse_args_accepts_replace_mode(self):
        config = parse_args([
            "--path",
            "materials/source.md",
            "--title",
            "国家能力",
            "--author",
            "研究者",
            "--replace",
        ])

        self.assertTrue(config.replace_existing)
        self.assertFalse(config.allow_duplicate)

    def test_compute_file_sha256_streams_file_content(self):
        with tempfile.NamedTemporaryFile(delete=False) as file:
            file.write(b"neptune-rag")
            path = file.name

        try:
            self.assertEqual(
                compute_file_sha256(path),
                "1e82a6bd9c24e0ac1d2c2ce8d5f6efdbccb14b27e5eed3d5f5655bf97236cf83",
            )
        finally:
            os.unlink(path)

    def test_split_long_paragraph_respects_sentence_boundaries_when_possible(self):
        paragraph = "第一句很重要。" * 20
        segments = split_long_paragraph(paragraph, 40)

        self.assertGreater(len(segments), 1)
        self.assertTrue(all(len(segment) <= 40 for segment in segments))
        self.assertTrue(all(segment.endswith("。") for segment in segments))

    def test_chunk_text_splits_single_oversized_paragraph(self):
        paragraph = "这一段没有换行但有很多句子。" * 80
        chunks = chunk_text(paragraph, target_chars=120, overlap_paras=0)

        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(chunk) <= 120 for chunk in chunks))

    def test_cleanup_marker_output_removes_only_pdf_named_output_dir(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, "source.pdf")
            output_dir = os.path.join(temp_dir, "marker")
            generated_dir = os.path.join(output_dir, "source")
            generated_md = os.path.join(generated_dir, "source.md")
            sibling_dir = os.path.join(output_dir, "other")
            os.makedirs(generated_dir)
            os.makedirs(sibling_dir)
            with open(pdf_path, "w", encoding="utf-8") as file:
                file.write("pdf")
            with open(generated_md, "w", encoding="utf-8") as file:
                file.write("# source")

            cleanup_marker_output(generated_md, output_dir, pdf_path)

            self.assertFalse(os.path.exists(generated_dir))
            self.assertTrue(os.path.exists(sibling_dir))


if __name__ == "__main__":
    unittest.main()
