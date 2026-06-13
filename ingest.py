#!/usr/bin/env python3
"""
Exocortex RAG Ingestion Pipeline — Memory Optimized (Chinese Enhanced)
EPUB → Hierarchical Chunks → Summaries → Embeddings → Supabase
"""

from __future__ import annotations

import os
import glob
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Optional, TypedDict
try:
    import ebooklib
    from ebooklib import epub
except ImportError:
    ebooklib = None
    epub = None

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from supabase import create_client
except ImportError:
    create_client = None

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# 强行指挥 Python 优先读取最高机密文件 .env.local
if load_dotenv is not None:
    load_dotenv(".env.local")

# 作为兜底，再读取普通的 .env 文件（如果里面有公共配置的话）
if load_dotenv is not None:
    load_dotenv(".env")


def get_required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def require_dependency(value: object | None, package_name: str) -> None:
    if value is None:
        raise RuntimeError(
            f"Missing Python dependency: {package_name}. Install with `pip install -r requirements.txt`."
        )


EMBEDDING_MODEL = "BAAI/bge-m3"
EMBEDDING_DIM = 1024
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-pro")
REQUEST_RETRIES = int(os.environ.get("INGEST_REQUEST_RETRIES", "3"))
RETRY_BASE_SECONDS = float(os.environ.get("INGEST_RETRY_BASE_SECONDS", "1.2"))

embedding_client: OpenAI | None = None
llm_client: OpenAI | None = None
supabase_client = None


def get_embedding_client() -> OpenAI:
    global embedding_client
    require_dependency(OpenAI, "openai")
    if embedding_client is None:
        embedding_client = OpenAI(
            api_key=get_required_env("SILICONFLOW_API_KEY"),
            base_url="https://api.siliconflow.cn/v1",
        )
    return embedding_client


def get_llm_client() -> OpenAI:
    global llm_client
    require_dependency(OpenAI, "openai")
    if llm_client is None:
        llm_client = OpenAI(
            api_key=get_required_env("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
        )
    return llm_client


def get_supabase_client():
    global supabase_client
    require_dependency(create_client, "supabase")
    if supabase_client is None:
        supabase_client = create_client(
            get_required_env("SUPABASE_URL"),
            get_required_env("SUPABASE_KEY"),
        )
    return supabase_client

# ── 1. EPUB 解析 (增强鲁棒性) ──────────────────────────────────

@dataclass
class Chapter:
    part_title: Optional[str]
    chapter_index: int
    title: str
    content: str


@dataclass
class IngestConfig:
    target_path: str
    marker_output_dir: str
    book_title: str
    book_author: str
    allow_duplicate: bool
    replace_existing: bool
    keep_temp: bool
    report_path: Optional[str]


class MarkdownSection(TypedDict):
    chapter_title: str
    content: str


def parse_args(argv: list[str]) -> IngestConfig:
    parser = argparse.ArgumentParser(
        description="Ingest EPUB/PDF/Markdown material into the Neptune RAG Hub."
    )
    parser.add_argument(
        "--path",
        default=os.environ.get("TARGET_PATH", "rag-pipeline/经济学的思维方式.epub"),
        help="Source file path. Supports .epub, .pdf, and .md.",
    )
    parser.add_argument(
        "--title",
        default=os.environ.get("BOOK_TITLE", "经济学的思维方式"),
        help="Book/material title stored in rag_books.",
    )
    parser.add_argument(
        "--author",
        default=os.environ.get("BOOK_AUTHOR", "托马斯·索维尔"),
        help="Book/material author stored in rag_books.",
    )
    parser.add_argument(
        "--marker-output-dir",
        default=os.environ.get("MARKER_OUTPUT_DIR", "./data/temp_md/"),
        help="Temporary output directory used by marker_single for PDF conversion.",
    )
    parser.add_argument(
        "--allow-duplicate",
        action="store_true",
        help="Allow ingesting another rag_books row with the same title and author.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="After the new ingest succeeds, delete older rows with the same title and author.",
    )
    parser.add_argument(
        "--keep-temp",
        action="store_true",
        help="Keep marker_single temporary Markdown output after successful PDF ingest.",
    )
    parser.add_argument(
        "--report-path",
        default=os.environ.get("INGEST_REPORT_PATH"),
        help="Optional path for a JSON ingest report.",
    )
    args = parser.parse_args(argv)
    if args.allow_duplicate and args.replace:
        parser.error("--allow-duplicate and --replace cannot be used together.")

    return IngestConfig(
        target_path=args.path,
        marker_output_dir=args.marker_output_dir,
        book_title=args.title,
        book_author=args.author,
        allow_duplicate=args.allow_duplicate,
        replace_existing=args.replace,
        keep_temp=args.keep_temp,
        report_path=args.report_path,
    )


def compute_file_sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as file:
        for block in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def parse_epub(epub_path: str) -> list[Chapter]:
    require_dependency(ebooklib, "EbookLib")
    require_dependency(epub, "EbookLib")
    require_dependency(BeautifulSoup, "beautifulsoup4")
    book = epub.read_epub(epub_path)
    chapters = []
    chapter_index = 0

    # 遍历 EPUB 里的每一个 HTML 页面
    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")

        # 尝试找个标题，如果没有，就用无名章节代替
        heading = soup.find(["h1", "h2", "h3", "title"])
        title = heading.get_text(strip=True)[:50] if heading else f"章节片段 {chapter_index + 1}"

        # 暴力提取所有纯文本内容
        text = soup.get_text(separator="\n", strip=True)

        # 针对中文的判断逻辑：纯算字符串长度，如果少于 50 个字符则当成碎屑过滤
        if len(text) < 50:
            continue

        chapter_index += 1
        chapters.append(Chapter(
            part_title=None,
            chapter_index=chapter_index,
            title=title,
            content=text,
        ))

    print(f"[Parse] 成功解析，共找到 {len(chapters)} 个有效章节。")
    return chapters


def convert_pdf_to_md_with_marker(pdf_path: str, output_dir: str) -> str:
    abs_pdf_path = os.path.abspath(pdf_path)
    abs_output_dir = os.path.abspath(output_dir)

    if not os.path.isfile(abs_pdf_path):
        raise FileNotFoundError(f"PDF 文件不存在: {abs_pdf_path}")

    os.makedirs(abs_output_dir, exist_ok=True)
    print(f"[Marker] 开始转换 PDF -> Markdown: {abs_pdf_path}")

    try:
        completed = subprocess.run(
            ["marker_single", abs_pdf_path, "--output_dir", abs_output_dir],
            check=True,
            capture_output=True,
            text=True,
        )
        if completed.stdout.strip():
            print(completed.stdout.strip())
        if completed.stderr.strip():
            print(completed.stderr.strip())
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.strip() if error.stderr else "未知错误"
        raise RuntimeError(f"marker_single 执行失败: {stderr}") from error

    pdf_name = os.path.splitext(os.path.basename(abs_pdf_path))[0]
    expected_dir = os.path.join(abs_output_dir, pdf_name)
    candidates: list[str] = []

    search_patterns = [
        os.path.join(expected_dir, "*.md"),
        os.path.join(expected_dir, "**", "*.md"),
        os.path.join(abs_output_dir, "*.md"),
        os.path.join(abs_output_dir, "**", "*.md"),
    ]

    for pattern in search_patterns:
        candidates.extend(glob.glob(pattern, recursive=True))

    if not candidates:
        raise RuntimeError(f"Marker 转换成功但未找到 Markdown 文件: {abs_output_dir}")

    candidates = sorted({os.path.abspath(path) for path in candidates})
    preferred = [path for path in candidates if os.path.splitext(os.path.basename(path))[0] == pdf_name]
    md_path = preferred[0] if preferred else candidates[0]
    print(f"[Marker] 找到 Markdown 文件: {md_path}")
    return md_path


def cleanup_marker_output(markdown_path: str, output_dir: str, source_pdf_path: str) -> None:
    pdf_name = os.path.splitext(os.path.basename(os.path.abspath(source_pdf_path)))[0]
    expected_dir = os.path.abspath(os.path.join(output_dir, pdf_name))
    abs_markdown_path = os.path.abspath(markdown_path)

    if os.path.isdir(expected_dir) and os.path.commonpath([expected_dir, abs_markdown_path]) == expected_dir:
        shutil.rmtree(expected_dir)
        print(f"[Marker] 已清理临时目录: {expected_dir}")
        return

    print(f"[Marker] 跳过临时目录清理，未识别安全目标: {abs_markdown_path}")


def parse_markdown(md_path: str) -> list[MarkdownSection]:
    abs_md_path = os.path.abspath(md_path)

    if not os.path.isfile(abs_md_path):
        raise FileNotFoundError(f"Markdown 文件不存在: {abs_md_path}")

    with open(abs_md_path, "r", encoding="utf-8") as file:
        content = file.read()

    heading_pattern = re.compile(r"^(#{1,2})\s+(.+?)\s*$", re.MULTILINE)
    matches = list(heading_pattern.finditer(content))
    sections: list[MarkdownSection] = []

    if not matches:
        text = content.strip()
        if text:
            sections.append({
                "chapter_title": os.path.splitext(os.path.basename(abs_md_path))[0],
                "content": text,
            })
        return sections

    for index, match in enumerate(matches):
        title = match.group(2).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        section_content = content[start:end].strip()

        if not section_content:
            continue

        sections.append({
            "chapter_title": title,
            "content": section_content,
        })

    if not sections:
        fallback_text = content.strip()
        if fallback_text:
            sections.append({
                "chapter_title": os.path.splitext(os.path.basename(abs_md_path))[0],
                "content": fallback_text,
            })

    print(f"[Parse] 成功解析 Markdown，共找到 {len(sections)} 个有效章节。")
    return sections


def markdown_sections_to_chapters(sections: list[MarkdownSection]) -> list[Chapter]:
    chapters: list[Chapter] = []

    for index, section in enumerate(sections, start=1):
        chapters.append(
            Chapter(
                part_title=None,
                chapter_index=index,
                title=section["chapter_title"],
                content=section["content"],
            )
        )

    return chapters

# ── 2. 结构化分块 (中文强化版) ──────────────────────────────

def split_long_paragraph(paragraph: str, target_chars: int) -> list[str]:
    if len(paragraph) <= target_chars:
        return [paragraph]

    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[。！？；;.!?])\s*", paragraph)
        if sentence.strip()
    ]
    if not sentences:
        sentences = [paragraph]

    segments: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > target_chars:
            if current:
                segments.append(current)
                current = ""
            for start in range(0, len(sentence), target_chars):
                segments.append(sentence[start:start + target_chars])
            continue

        if current and len(current) + len(sentence) > target_chars:
            segments.append(current)
            current = sentence
        else:
            current = f"{current}{sentence}" if current else sentence

    if current:
        segments.append(current)

    return segments


def chunk_text(text: str, target_chars: int = 800, overlap_paras: int = 1) -> list[str]:
    """针对中文优化的切块器，按字符数(而非空格单词)切分"""
    # 按照换行符拆分段落，过滤掉过短的无意义碎屑
    paragraphs = [
        segment
        for paragraph in text.split("\n")
        if len(paragraph.strip()) > 10
        for segment in split_long_paragraph(paragraph.strip(), target_chars)
    ]
    chunks, current, current_chars = [], [], 0

    for para in paragraphs:
        chars = len(para) 
        # 如果加上这一段超过了 800 字的限制
        if current_chars + chars > target_chars and current:
            chunks.append("\n\n".join(current))
            # 保留上一段作为上下文重叠 (Overlap)，防止语义在边界处被生硬切断
            current = current[-overlap_paras:] if overlap_paras > 0 else []
            current_chars = sum(len(p) for p in current)
            
        current.append(para)
        current_chars += chars

    if current:
        chunks.append("\n\n".join(current))

    return chunks

# ── 3. 泛化大模型摘要注入 ──────────────────────────────────────

def sleep_before_retry(attempt: int) -> None:
    time.sleep(RETRY_BASE_SECONDS * attempt)


def generate_chapter_summary(chapter: Chapter, book_title: str, author: str) -> str:
    # 中文优化：不再按空格 split，直接截取前 1500 个字符作为预览发送给大模型
    preview = chapter.content[:1500] 

    for attempt in range(1, REQUEST_RETRIES + 1):
        try:
            # ✨ 修复点 1：使用专门的 llm_client 调用 DeepSeek 模型
            resp = get_llm_client().chat.completions.create(
                model=DEEPSEEK_MODEL,
                messages=[{
                    "role": "user",
                    "content": f"""你是《{book_title}》（作者：{author}）的专属学术研究助手。
请为以下章节生成一段 150 字以内的学术摘要，必须重点提炼：
1. 作者在此章提出的核心论点或现象解释。
2. 使用的关键人文社科概念（如：稀缺性、制度、互动等）。
3. 本章在全书方法论中的位置。

章节标题：{chapter.title}
章节内容（节选）：
{preview}

摘要："""
                }],
                max_tokens=250,
                temperature=0.2,
            )
            content = resp.choices[0].message.content
            if content is None:
                raise ValueError("DeepSeek returned empty summary content")
            return content.strip()
        except Exception as e:
            print(f"  [Warning] 摘要生成失败，尝试 {attempt}/{REQUEST_RETRIES}: {e}")
            if attempt < REQUEST_RETRIES:
                sleep_before_retry(attempt)

    raise RuntimeError(f"章节摘要生成最终失败，已放弃整本书写入: {chapter.title}")

# ── 4. 向量化请求 (含速率保护) ──────────────────────────────────

def embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = []
    batch_size = 50 
    total_batches = max(1, (len(texts) + batch_size - 1) // batch_size)
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        batch_number = i // batch_size + 1
        batch_vectors: list[list[float]] | None = None
        print(f"  [-] Embedding batch {batch_number}/{total_batches} ({len(batch)} chunks)")

        for attempt in range(1, REQUEST_RETRIES + 1):
            try:
                # ✨ 修复点 2：使用 embedding_client 调用硅基流动的 1024 维模型
                resp = get_embedding_client().embeddings.create(
                    model=EMBEDDING_MODEL,
                    input=batch,
                )
                candidate_vectors = [r.embedding for r in resp.data]

                if len(candidate_vectors) != len(batch):
                    raise RuntimeError(
                        f"向量数量不匹配: expected={len(batch)}, actual={len(candidate_vectors)}"
                    )

                bad_dimensions = [
                    len(vector)
                    for vector in candidate_vectors
                    if len(vector) != EMBEDDING_DIM
                ]
                if bad_dimensions:
                    raise RuntimeError(
                        f"向量维度不匹配: expected={EMBEDDING_DIM}, actual={bad_dimensions[0]}"
                    )

                batch_vectors = candidate_vectors
                break
            except Exception as e:
                print(f"  [Error] 向量化批次失败，尝试 {attempt}/{REQUEST_RETRIES}: {e}")
                if attempt < REQUEST_RETRIES:
                    sleep_before_retry(attempt)

        if batch_vectors is None:
            raise RuntimeError(
                f"向量化批次最终失败，已放弃整本书写入: batch_start={i}, batch_size={len(batch)}"
            )

        vectors.extend(batch_vectors)
        time.sleep(0.3)

    return vectors

# ── 5. 完整性优先式写入 (核心优化区) ──────────────────────────────

def prepare_chunk_rows(chapters: list[Chapter], book_title: str, author: str) -> list[dict[str, object]]:
    prepared_rows: list[dict[str, object]] = []

    if not chapters:
        raise RuntimeError("没有可摄入的有效章节，已放弃写入。")

    total_chapters = len(chapters)
    for position, chapter in enumerate(chapters, start=1):
        print(f"\n[Chapter {position}/{total_chapters}] 开始处理: {chapter.title}")

        summary = generate_chapter_summary(chapter, book_title, author)
        print(f"  [-] 提取摘要：{summary[:50]}...")

        chunks = chunk_text(chapter.content)
        print(f"  [-] 物理切块：共 {len(chunks)} 块")
        if not chunks:
            raise RuntimeError(f"章节没有生成任何 chunk，已放弃整本书写入: {chapter.title}")

        vectors = embed_texts(chunks)
        if len(vectors) != len(chunks):
            raise RuntimeError(
                f"章节 chunk 与向量数量不一致，已放弃整本书写入: {chapter.title}"
            )

        for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
            prepared_rows.append({
                "part_title": chapter.part_title,
                "chapter_index": chapter.chapter_index,
                "chapter_title": chapter.title,
                "chunk_index": i,
                "content": chunk,
                "chapter_summary": summary,
                "word_count": len(chunk), # ✨ 中文优化：精确统计字符长度，而非按空格算 1
                "embedding": vector,
            })

        print(f"  [+] 本章 {len(chunks)} 块切片已通过完整性校验。")

    return prepared_rows


def register_book(book_title: str, author: str) -> str:
    result = get_supabase_client().table("rag_books").insert({
        "title": book_title,
        "author": author,
    }).execute()
    data = result.data
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise RuntimeError("rag_books insert returned no row")
    book_id_value = data[0].get("id")
    if not isinstance(book_id_value, str):
        raise RuntimeError("rag_books insert row missing id")
    return book_id_value


def cleanup_book(book_id: str) -> None:
    try:
        client = get_supabase_client()
        client.table("rag_chunks").delete().eq("book_id", book_id).execute()
        client.table("rag_books").delete().eq("id", book_id).execute()
        print(f"  [Cleanup] 已清理失败摄入残留: {book_id}")
    except Exception as cleanup_error:
        print(f"  [Cleanup Error] 清理失败摄入残留时出错，请手动检查 book_id={book_id}: {cleanup_error}")


def existing_book_ids(book_title: str, author: str) -> list[str]:
    result = (
        get_supabase_client()
        .table("rag_books")
        .select("id")
        .eq("title", book_title)
        .eq("author", author)
        .execute()
    )
    rows = result.data if isinstance(result.data, list) else []

    return [
        row["id"]
        for row in rows
        if isinstance(row, dict) and isinstance(row.get("id"), str)
    ]


def ensure_not_duplicate(
    book_title: str,
    author: str,
    allow_duplicate: bool,
    replace_existing: bool,
) -> list[str]:
    if allow_duplicate:
        return []

    duplicates = existing_book_ids(book_title, author)
    if duplicates and not replace_existing:
        raise RuntimeError(
            f"资料已存在，已阻止重复导入: title={book_title}, author={author}, existing_ids={duplicates}. "
            "如确需重复导入，请加 --allow-duplicate；如要覆盖旧版本，请加 --replace。"
        )

    if duplicates:
        print(f"[Replace] 检测到旧版本，将在新版本成功写入后清理: {duplicates}")

    return duplicates


def delete_books(book_ids: list[str]) -> None:
    client = get_supabase_client()
    for book_id in book_ids:
        client.table("rag_chunks").delete().eq("book_id", book_id).execute()
        client.table("rag_books").delete().eq("id", book_id).execute()
        print(f"[Replace] 已删除旧版本: {book_id}")


def write_ingest_report(report_path: str, report: dict[str, object]) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
        file.write("\n")


def upload_book(chapters: list[Chapter], config: IngestConfig, source_hash: str):
    print("\n[Prepare] 开始完整性预处理。此阶段不会写入 Supabase。")
    prepared_rows = prepare_chunk_rows(chapters, config.book_title, config.book_author)
    total_chunks = len(prepared_rows)
    print(f"\n[Prepare] 全书 {total_chunks} 个 chunk 已全部生成摘要与向量，开始数据库写入。")

    book_id: str | None = None
    inserted_chunks = 0
    replaced_book_ids: list[str] = []

    try:
        replaced_book_ids = ensure_not_duplicate(
            config.book_title,
            config.book_author,
            config.allow_duplicate,
            config.replace_existing,
        )
        book_id = register_book(config.book_title, config.book_author)
        print(f"[Init] 分配档案编号 ID: {book_id}")

        insert_batch_size = 50
        client = get_supabase_client()
        for i in range(0, total_chunks, insert_batch_size):
            batch = [
                {
                    **row,
                    "book_id": book_id,
                }
                for row in prepared_rows[i:i + insert_batch_size]
            ]
            client.table("rag_chunks").insert(batch).execute()
            inserted_chunks += len(batch)

        if inserted_chunks != total_chunks:
            raise RuntimeError(
                f"写入数量不一致: expected={total_chunks}, actual={inserted_chunks}"
            )

        client.table("rag_books").update(
            {"total_chunks": inserted_chunks}
        ).eq("id", book_id).execute()

        if replaced_book_ids:
            delete_books(replaced_book_ids)
    except Exception:
        if book_id is not None:
            cleanup_book(book_id)
        raise

    if config.report_path:
        write_ingest_report(config.report_path, {
            "status": "complete",
            "book_id": book_id,
            "title": config.book_title,
            "author": config.book_author,
            "source_path": os.path.abspath(config.target_path),
            "source_sha256": source_hash,
            "chapters": len(chapters),
            "chunks": inserted_chunks,
            "replaced_book_ids": replaced_book_ids,
            "embedding_model": EMBEDDING_MODEL,
            "embedding_dim": EMBEDDING_DIM,
            "chunking_version": "paragraph-sentence-v2",
        })

    print(f"\n✅ 任务完成。全书共计入库 {inserted_chunks} 个 Chunk。")

# ── 启动舱 ──────────────────────────────────────────────────────

if __name__ == "__main__":
    config = parse_args(sys.argv[1:])

    print(f"🚀 初始化 RAG 摄入管线: {config.book_title}")

    target_path_lower = config.target_path.lower()
    generated_markdown_path: str | None = None
    try:
        source_hash = compute_file_sha256(config.target_path)
        print(f"[Source] SHA256: {source_hash}")

        if target_path_lower.endswith(".pdf"):
            os.makedirs(config.marker_output_dir, exist_ok=True)
            markdown_path = convert_pdf_to_md_with_marker(
                config.target_path,
                config.marker_output_dir,
            )
            generated_markdown_path = markdown_path
            markdown_sections = parse_markdown(markdown_path)
            parsed_chapters = markdown_sections_to_chapters(markdown_sections)
        elif target_path_lower.endswith(".md"):
            markdown_sections = parse_markdown(config.target_path)
            parsed_chapters = markdown_sections_to_chapters(markdown_sections)
        elif target_path_lower.endswith(".epub"):
            parsed_chapters = parse_epub(config.target_path)
        else:
            raise RuntimeError(f"不支持的输入文件类型: {config.target_path}")

        upload_book(parsed_chapters, config, source_hash)
        if generated_markdown_path and not config.keep_temp:
            cleanup_marker_output(
                generated_markdown_path,
                config.marker_output_dir,
                config.target_path,
            )
    except Exception as e:
        print(f"[Fatal Error] 摄入失败，未保留半成品写入: {e}")
        exit(1)
