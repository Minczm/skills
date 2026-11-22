#!/usr/bin/env python3
"""Validate job-seeker company due diligence dossier structure and references."""

import argparse
import base64
import binascii
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET

ENTITY_TYPES = {"company", "person", "product", "brand", "investor", "institution"}
ENTITY_STATUSES = {"current", "historical", "candidate"}
RELATION_STATUSES = {"current", "historical", "candidate", "disputed"}
SOURCE_KINDS = {
    "official", "registry", "first_party", "store", "court", "media", "forum",
    "user", "archive", "analysis",
    "job_posting", "salary_data", "employee_review", "labor_legal", "tech_footprint",
}
SCORECARD_RATINGS = {"positive", "caution", "warning", "unknown"}
CHECKLIST_TARGETS = {"interviewer", "hr", "contract", "general"}
CHECKLIST_PRIORITIES = {"P0", "P1", "P2"}
COLLECTIONS = (
    "entities", "relationships", "sources", "assets", "findings", "sections",
    "questions", "archives", "timeline", "claims", "evidence_manifest",
    "decision_scorecard", "interview_checklist",
)
TRACKED_COLLECTIONS = (
    "entities", "relationships", "sources", "assets", "sections", "questions", "archives",
    "claims", "evidence_manifest", "decision_scorecard", "interview_checklist",
)
CLAIM_KINDS = {"fact", "company_statement", "user_report", "analysis"}
EVIDENCE_REPRESENTATIONS = {"original_file", "web_snapshot", "screenshot", "extracted_text", "excerpt"}
MIMES = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
         "image/avif", "image/bmp", "image/x-icon", "image/vnd.microsoft.icon"}
MANUAL_REVIEW = [
    "核对劳动合同签约主体、发薪主体与核心运营主体的对应关系，排除外包或空壳风险。",
    "核对社区口碑、薪资开奖与裁员传闻的部门、年份与匿名属性，并与财报人数/费用交叉印证。",
    "核对面试反问清单是否均由真实背调事实触发，避免泛泛套话。",
]


def finite_number(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and (not isinstance(value, float) or math.isfinite(value))


def load_json(path):
    def reject_constant(value):
        raise ValueError("JSON 不允许非有限数字：" + value)

    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("JSON 对象含重复字段：" + key)
            result[key] = value
        return result

    with Path(path).open("r", encoding="utf-8-sig") as stream:
        return json.load(stream, parse_constant=reject_constant, object_pairs_hook=unique_object)


def image_type(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"BM"):
        return "image/bmp"
    if data.startswith(b"\x00\x00\x01\x00"):
        return "image/x-icon"
    if len(data) >= 16 and data[4:8] == b"ftyp" and any(
        data[i:i + 4] in (b"avif", b"avis") for i in range(8, min(len(data), 64), 4)
    ):
        return "image/avif"
    if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
        raise ValueError("SVG 不得含 DOCTYPE 或实体声明")
    try:
        root = ET.fromstring(data)
    except (ET.ParseError, ValueError):
        return None
    if root.tag.split("}")[-1] != "svg":
        return None
    for node in root.iter():
        if node.tag.split("}")[-1].lower() in {"script", "foreignobject"}:
            raise ValueError("SVG 不得含脚本或 foreignObject")
        for key, value in node.attrib.items():
            name = key.split("}")[-1].lower()
            if name.startswith("on"):
                raise ValueError("SVG 不得含事件处理器")
            if name in {"href", "src"} and value.strip() and not value.strip().startswith("#"):
                raise ValueError("SVG 必须自包含，不能引用外部资源")
            if "javascript:" in value.lower():
                raise ValueError("SVG 不得含 javascript URL")
        for value in [*node.attrib.values(), node.text or ""]:
            if re.search(r"@import\b", value, re.I):
                raise ValueError("SVG 不得导入外部样式")
            for target in re.findall(r"url\(\s*['\"]?([^)'\"]+)", value, re.I):
                if not target.strip().startswith("#"):
                    raise ValueError("SVG 必须自包含，不能加载外部资源")
    return "image/svg+xml"


def read_asset(asset, base_dir):
    """Return a verified local image's MIME and bytes; never fetch a URL."""
    declared = asset.get("mime")
    if declared is not None and (not isinstance(declared, str) or declared not in MIMES):
        raise ValueError("mime 必须为支持的 image MIME")
    if asset.get("data_uri") is not None:
        uri = asset["data_uri"]
        if not isinstance(uri, str) or not uri.startswith("data:") or "," not in uri:
            raise ValueError("data_uri 必须是有效的图片 data URI")
        header, payload = uri[5:].split(",", 1)
        parts = header.split(";")
        uri_mime = parts[0].lower()
        if uri_mime not in MIMES:
            raise ValueError("data_uri 的 MIME 不是支持的图片类型")
        if declared and {declared, uri_mime} != {"image/x-icon", "image/vnd.microsoft.icon"} and declared != uri_mime:
            raise ValueError("mime 与 data_uri 的 MIME 不一致")
        declared = uri_mime
        if any(p.lower() != "base64" and not p.lower().startswith("charset=") for p in parts[1:]):
            raise ValueError("data_uri 含不支持的编码参数")
        try:
            if "base64" in [p.lower() for p in parts[1:]]:
                data = base64.b64decode("".join(payload.split()), validate=True)
            else:
                data = urllib.parse.unquote_to_bytes(payload)
        except (ValueError, binascii.Error) as exc:
            raise ValueError("data_uri 的图片编码无效") from exc
    else:
        path = asset.get("path")
        if not isinstance(path, str) or not path.strip():
            raise ValueError("图片须提供本地 path 或 data_uri")
        image_path = Path(path).expanduser()
        if path.startswith(("//", "\\\\")) or (
            re.match(r"^[a-z][a-z0-9+.-]*:", path, re.I) and not image_path.is_absolute()
        ):
            raise ValueError("path 必须为本地路径，构建器不下载网络图片")
        if not image_path.is_absolute():
            image_path = Path(base_dir) / image_path
        if not image_path.is_file():
            raise ValueError("图片文件不存在或不是普通文件：" + str(image_path))
        data = image_path.read_bytes()
    if not data:
        raise ValueError("图片文件或 data_uri 为空")
    actual = image_type(data)
    if not actual:
        raise ValueError("无法识别图片格式；不能仅凭文件扩展名嵌入")
    if declared and declared != actual and {declared, actual} != {"image/x-icon", "image/vnd.microsoft.icon"}:
        raise ValueError("声明的 MIME 与图片内容不一致（识别为 " + actual + "）")
    return actual, data


def validate_dossier(data, base_dir=".", previous=None):
    errors, warnings = [], []

    def issue(bucket, code, path, message):
        bucket.append({"code": code, "path": path, "message": message})

    def error(code, path, message):
        issue(errors, code, path, message)

    def warn(code, path, message):
        issue(warnings, code, path, message)

    def result(counts=None, reachability=None):
        return {"ok": not errors, "errors": errors, "warnings": warnings,
                "counts": counts or {}, "reachability": reachability or {},
                "manual_review": MANUAL_REVIEW}

    if not isinstance(data, dict):
        error("document_type", "$", "顶层必须是 JSON 对象")
        return result()
    if data.get("schema_version") != 1 or isinstance(data.get("schema_version"), bool):
        error("schema_version", "$.schema_version", "schema_version 必须为 1")

    tables, ids = {}, {}
    for kind in COLLECTIONS:
        rows = data.get(kind, [])
        if kind in {"entities", "relationships", "sources"} and kind not in data:
            error("missing_collection", "$." + kind, "缺少必需数组")
        if not isinstance(rows, list):
            error("collection_type", "$." + kind, "必须是数组")
            rows = []
        tables[kind], ids[kind] = [], set()
        for index, row in enumerate(rows):
            path = f"$.{kind}[{index}]"
            if not isinstance(row, dict):
                error("record_type", path, "记录必须是对象")
                continue
            tables[kind].append((row, path))
            if kind == "timeline":
                continue
            ident = row.get("id")
            if not isinstance(ident, str) or not ident.strip():
                error("missing_id", path + ".id", "id 必须为非空字符串")
            elif ident in ids[kind]:
                error("duplicate_id", path + ".id", f"{kind} 中重复 ID：{ident}")
            else:
                ids[kind].add(ident)

    def require(row, path, names):
        for name in names:
            if name not in row:
                error("missing_field", path + "." + name, "缺少必需字段")

    def text_field(row, path, name, allow_null=False):
        value = row.get(name)
        if allow_null and value is None:
            return
        if not isinstance(value, str) or not value.strip():
            error("text_type", path + "." + name, "必须为非空字符串")

    def evidence(row, path, content=True, alternative="sources"):
        refs = row.get(alternative)
        if content and (not isinstance(refs, list) or not refs):
            warn("unsourced_fact", path, "该事实或判断未附具体来源；请补出处或明确写为资料缺口/待核线索")

    meta = data.get("meta")
    if not isinstance(meta, dict):
        error("meta_type", "$.meta", "meta 必须为对象")
        meta = {}
    require(meta, "$.meta", ("title", "root_id", "as_of"))
    text_field(meta, "$.meta", "title")
    root_id = meta.get("root_id")
    if not isinstance(root_id, str) or root_id not in ids["entities"]:
        error("missing_root", "$.meta.root_id", "根主体必须指向已存在的 entities ID")

    reserved_sections = {"overview", "network", "role-assessment", "checklist", "questions", "archives", "timeline", "sources"}
    for row, path in tables["sections"]:
        if isinstance(row.get("id"), str) and row["id"] in reserved_sections:
            error("reserved_section_id", path + ".id", "栏目 ID 与模板保留锚点冲突：" + row["id"])
    if "navigation" in meta:
        navigation = meta["navigation"]
        if not isinstance(navigation, list):
            error("navigation_type", "$.meta.navigation", "navigation 必须为 {label,target} 数组")
        else:
            targets = reserved_sections | ids["sections"]
            for index, item in enumerate(navigation):
                path = f"$.meta.navigation[{index}]"
                if not isinstance(item, dict):
                    error("navigation_item", path, "导航项必须为 {label,target} 对象")
                    continue
                text_field(item, path, "label")
                target = item.get("target")
                if not isinstance(target, str) or target not in targets:
                    error("navigation_target", path + ".target", "target 须为模板锚点或已存在的 sections.id")

    # Job-seeker extensions validation
    if "job_context" in data and data["job_context"] is not None:
        jc = data["job_context"]
        if not isinstance(jc, dict):
            error("job_context_type", "$.job_context", "job_context 须为对象")
        else:
            for k in ("target_role", "business_unit", "location", "stage", "employer_entity", "compensation_note", "jd_summary"):
                if k in jc and jc[k] is not None and (not isinstance(jc[k], str) or not jc[k].strip()):
                    error("text_type", "$.job_context." + k, "必须为非空字符串或 null")

    for row, path in tables["decision_scorecard"]:
        require(row, path, ("dimension", "rating", "verdict", "summary", "sources"))
        text_field(row, path, "dimension")
        text_field(row, path, "verdict")
        text_field(row, path, "summary")
        if row.get("rating") not in SCORECARD_RATINGS:
            error("scorecard_rating", path + ".rating", "rating 须为 positive、caution、warning 或 unknown")
        evidence(row, path)

    green_count = red_count = 0
    if "flags" in data and data["flags"] is not None:
        flags = data["flags"]
        if not isinstance(flags, dict):
            error("flags_type", "$.flags", "flags 须为 {green:[], red:[]} 对象")
        else:
            seen_flag_ids = set()
            for bucket in ("green", "red"):
                items = flags.get(bucket, [])
                if not isinstance(items, list):
                    error("flags_bucket_type", "$.flags." + bucket, "须为数组")
                    continue
                if bucket == "green":
                    green_count = len(items)
                else:
                    red_count = len(items)
                for index, item in enumerate(items):
                    fp = f"$.flags.{bucket}[{index}]"
                    if not isinstance(item, dict):
                        error("flag_item_type", fp, "必须为对象")
                        continue
                    require(item, fp, ("id", "title", "text", "sources"))
                    text_field(item, fp, "id")
                    text_field(item, fp, "title")
                    text_field(item, fp, "text")
                    fid = item.get("id")
                    if isinstance(fid, str):
                        if fid in seen_flag_ids:
                            error("duplicate_flag_id", fp + ".id", "重复的旗帜 ID：" + fid)
                        seen_flag_ids.add(fid)
                    evidence(item, fp)

    role_dim_count = 0
    if "role_assessment" in data and data["role_assessment"] is not None:
        ra = data["role_assessment"]
        if not isinstance(ra, dict):
            error("role_assessment_type", "$.role_assessment", "role_assessment 须为对象")
        else:
            require(ra, "$.role_assessment", ("target_role", "dimensions"))
            text_field(ra, "$.role_assessment", "target_role")
            dims = ra.get("dimensions")
            if not isinstance(dims, list):
                error("role_dimensions_type", "$.role_assessment.dimensions", "dimensions 须为数组")
            else:
                role_dim_count = len(dims)
                seen_dims = set()
                for index, dim in enumerate(dims):
                    dp = f"$.role_assessment.dimensions[{index}]"
                    if not isinstance(dim, dict):
                        error("role_dim_type", dp, "维度须为对象")
                        continue
                    require(dim, dp, ("id", "title", "answer", "sources"))
                    text_field(dim, dp, "id")
                    text_field(dim, dp, "title")
                    text_field(dim, dp, "answer")
                    did = dim.get("id")
                    if isinstance(did, str):
                        if did in seen_dims:
                            error("duplicate_dim_id", dp + ".id", "重复的维度 ID：" + did)
                        seen_dims.add(did)
                    evidence(dim, dp)

    for row, path in tables["interview_checklist"]:
        require(row, path, ("target", "question", "trigger_fact", "sources"))
        text_field(row, path, "question")
        text_field(row, path, "trigger_fact")
        if row.get("target") not in CHECKLIST_TARGETS:
            error("checklist_target", path + ".target", "target 须为 interviewer、hr、contract 或 general")
        if "priority" in row and row["priority"] is not None and row["priority"] not in CHECKLIST_PRIORITIES:
            error("checklist_priority", path + ".priority", "priority 须为 P0、P1 或 P2")
        evidence(row, path)

    for row, path in tables["entities"]:
        require(row, path, ("name", "type", "summary", "sources"))
        text_field(row, path, "name")
        text_field(row, path, "summary")
        if not isinstance(row.get("type"), str) or row.get("type") not in ENTITY_TYPES:
            error("entity_type", path + ".type", "主体类型须为 " + ", ".join(sorted(ENTITY_TYPES)))
        if "status" in row and (not isinstance(row["status"], str) or row["status"] not in ENTITY_STATUSES):
            error("entity_status", path + ".status", "主体状态须为 current、historical 或 candidate")
        evidence(row, path)
        for field in ("fields", "facts", "career", "sections"):
            entries = row.get(field, [])
            if not isinstance(entries, list):
                error("nested_array", path + "." + field, "必须为数组")
                continue
            for index, entry in enumerate(entries):
                item_path = f"{path}.{field}[{index}]"
                if not isinstance(entry, dict):
                    error("record_type", item_path, "必须为对象")
                    continue
                required = {"fields": ("label", "value", "sources"),
                            "facts": ("text", "sources"),
                            "career": ("date", "title", "text", "sources"),
                            "sections": ("title", "text", "sources")}[field]
                require(entry, item_path, required)
                evidence(entry, item_path, field != "fields" or entry.get("value") is not None)

    for row, path in tables["relationships"]:
        require(row, path, ("from", "to", "type", "label", "sources"))
        text_field(row, path, "type")
        text_field(row, path, "label")
        for endpoint in ("from", "to"):
            if not isinstance(row.get(endpoint), str) or row[endpoint] not in ids["entities"]:
                error("dangling_endpoint", path + "." + endpoint, "关系端点不存在：" + str(row.get(endpoint)))
        if not isinstance(row.get("sources"), list) or not row["sources"]:
            error("relationship_without_source", path + ".sources", "关系事实至少需要一条具体来源")
        if "status" in row and (not isinstance(row["status"], str) or row["status"] not in RELATION_STATUSES):
            error("relation_status", path + ".status", "关系状态须为 current、historical、candidate 或 disputed")
        if "nature" in row and (not isinstance(row["nature"], str) or row["nature"] not in {"capital", "business"}):
            error("relation_nature", path + ".nature", "nature 须为 capital 或 business")
        if "disputed" in row and not isinstance(row["disputed"], bool):
            error("disputed_type", path + ".disputed", "disputed 必须为布尔值")
        if row.get("from") == row.get("to") and row.get("from"):
            warn("self_relation", path, "关系两端为同一主体，请核对原始事实")

    for row, path in tables["sources"]:
        require(row, path, ("title", "url", "kind", "observed_at"))
        text_field(row, path, "title")
        url = row.get("url")
        if not isinstance(url, str):
            error("source_url", path + ".url", "来源 URL 必须为 HTTPS 地址或内部 #source- 锚点")
        elif not (url.startswith("#source-") and len(url) > 8):
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme != "https" or not parsed.netloc:
                error("source_url", path + ".url", "来源 URL 必须为原始 HTTPS 地址或内部 #source- 锚点")
        if not isinstance(row.get("kind"), str) or row.get("kind") not in SOURCE_KINDS:
            error("source_kind", path + ".kind", "未知的来源种类")
        if "origin_id" in row and row["origin_id"] is not None:
            if not isinstance(row["origin_id"], str) or row["origin_id"] not in ids["sources"]:
                error("dangling_origin", path + ".origin_id", "原始来源 ID 不存在")
            elif row["origin_id"] == row.get("id"):
                error("source_origin_cycle", path + ".origin_id", "来源不可把自身列为原始来源")

    for kind in ("findings", "sections", "questions", "archives", "timeline"):
        for row, path in tables[kind]:
            required = {"findings": ("title", "text", "sources", "entity_ids"),
                        "sections": ("title", "blocks"),
                        "questions": ("question", "answer", "sources"),
                        "archives": ("title", "entity_ids", "source_ids", "blocks"),
                        "timeline": ("date", "title", "text", "sources", "entity_ids")}[kind]
            require(row, path, required)
            text_field(row, path, "question" if kind == "questions" else "title")
            if kind in {"findings", "timeline"}:
                evidence(row, path)
            if kind == "questions":
                evidence(row, path, row.get("answer") is not None)
            for field in ("blocks", "evidence"):
                entries = row.get(field, [])
                if not isinstance(entries, list):
                    error("nested_array", path + "." + field, "必须为数组")
                    continue
                for index, entry in enumerate(entries):
                    item_path = f"{path}.{field}[{index}]"
                    if not isinstance(entry, dict):
                        error("record_type", item_path, "必须为对象")
                        continue
                    evidence(entry, item_path, bool(entry.get("text")))
                    steps = entry.get("steps", [])
                    if not isinstance(steps, list):
                        error("nested_array", item_path + ".steps", "必须为数组")
                        continue
                    for n, step in enumerate(steps):
                        step_path = f"{item_path}.steps[{n}]"
                        if not isinstance(step, dict):
                            error("record_type", step_path, "步骤必须为对象")
                        else:
                            require(step, step_path, ("title", "text", "sources"))
                            evidence(step, step_path)

    for row, path in tables["assets"]:
        require(row, path, ("alt", "sources"))
        text_field(row, path, "alt")
        evidence(row, path)
        try:
            read_asset(row, base_dir)
        except (OSError, ValueError, TypeError) as exc:
            error("asset_invalid", path, str(exc))

    metrics = data.get("metrics", [])
    if not isinstance(metrics, list):
        error("metrics_type", "$.metrics", "metrics 须为数组")
    else:
        for index, metric in enumerate(metrics):
            path = f"$.metrics[{index}]"
            if not isinstance(metric, dict):
                error("metric_type", path, "指标须为对象")
                continue
            require(metric, path, ("label", "value", "sources"))
            text_field(metric, path, "label")
            text_field(metric, path, "value")

    snapshot_sources = {row["id"]: row.get("source_id") for row, _ in tables["evidence_manifest"]
                        if isinstance(row.get("id"), str)}
    for row, path in tables["claims"]:
        require(row, path, ("text", "kind", "entity_ids", "source_ids", "locator", "published_at", "effective_at", "as_of", "accessed_at"))
        text_field(row, path, "text")
        text_field(row, path, "locator")
        if row.get("kind") not in CLAIM_KINDS:
            error("claim_kind", path + ".kind", "主张类型须为 fact/company_statement/user_report/analysis")
        if not isinstance(row.get("source_ids"), list) or not row["source_ids"]:
            error("claim_sources", path + ".source_ids", "重要主张须附具体来源")
        for index, item in enumerate(row.get("evidence", []) if isinstance(row.get("evidence", []), list) else []):
            ep = f"{path}.evidence[{index}]"
            if not isinstance(item, dict):
                error("claim_evidence", ep, "证据须为对象")
                continue
            require(item, ep, ("source_id", "locator", "published_at", "accessed_at"))
            if item.get("source_id") not in ids["sources"]:
                error("claim_evidence_source", ep + ".source_id", "证据来源不存在")
            elif item.get("source_id") not in row.get("source_ids", []):
                error("claim_evidence_source", ep + ".source_id", "证据须包含在主张 source_ids 中")
            text_field(item, ep, "locator")
            if item.get("snapshot_id") is not None and item["snapshot_id"] not in ids["evidence_manifest"]:
                error("claim_snapshot", ep + ".snapshot_id", "留存材料不存在")
            elif item.get("snapshot_id") is not None and snapshot_sources.get(item["snapshot_id"]) != item.get("source_id"):
                error("claim_snapshot_source", ep + ".snapshot_id", "留存材料与该项证据的来源不一致")
        if "evidence" in row and not isinstance(row["evidence"], list):
            error("claim_evidence", path + ".evidence", "evidence 须为数组")

    for row, path in tables["evidence_manifest"]:
        require(row, path, ("source_id", "representation", "status", "captured_at"))
        if row.get("source_id") not in ids["sources"]:
            error("snapshot_source", path + ".source_id", "留存材料来源不存在")
        if row.get("representation") not in EVIDENCE_REPRESENTATIONS:
            error("snapshot_representation", path + ".representation", "未知的材料形态")
        if row.get("status") not in {"stored", "unavailable", "metadata_only"}:
            error("snapshot_status", path + ".status", "未知的留存状态")
        if row.get("parent_snapshot_id") is not None:
            if row["parent_snapshot_id"] not in ids["evidence_manifest"] or row["parent_snapshot_id"] == row.get("id"):
                error("snapshot_parent", path + ".parent_snapshot_id", "原始材料引用无效")
        if row.get("status") == "stored":
            require(row, path, ("path", "sha256", "bytes"))
            raw_path, checksum, size = row.get("path"), row.get("sha256"), row.get("bytes")
            if not isinstance(raw_path, str) or not raw_path.strip():
                error("snapshot_path", path + ".path", "已留存材料须有本地文件路径")
                continue
            if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", checksum):
                error("snapshot_hash", path + ".sha256", "须记录实际文件的 SHA-256")
            if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
                error("snapshot_bytes", path + ".bytes", "留存文件字节数须为正整数")
            local = Path(raw_path)
            local = local if local.is_absolute() else Path(base_dir) / local
            try:
                content = local.read_bytes()
                if len(content) != size:
                    error("snapshot_size_mismatch", path, "文件字节数与留存记录不同")
                if isinstance(checksum, str) and hashlib.sha256(content).hexdigest() != checksum.lower():
                    error("snapshot_hash_mismatch", path, "文件 SHA-256 与留存记录不同")
            except OSError as exc:
                error("snapshot_unreadable", path, "无法读取留存文件：" + str(exc))
        elif any(row.get(field) is not None for field in ("path", "sha256", "bytes")):
            error("snapshot_unstored_fields", path, "未留存原件不填写文件路径、字节数或哈希")

    ref_keys = {"sources": "sources", "source_ids": "sources", "entity_ids": "entities", "image_ids": "assets", "claim_ids": "claims", "input_claim_ids": "claims"}
    date_keys = {"date", "valid_from", "valid_to", "published_at", "observed_at", "as_of", "effective_at", "accessed_at", "captured_at", "snapshot_at"}

    def chart_check(chart, path):
        if not isinstance(chart, dict):
            error("chart_type", path, "chart 须为对象")
            return
        for field in ("title", "unit"):
            text_field(chart, path, field)
        decimals = chart.get("decimals", 1)
        if isinstance(decimals, bool) or not isinstance(decimals, int) or not 0 <= decimals <= 6:
            error("chart_decimals", path + ".decimals", "decimals 须为 0–6 的整数")
        rows = chart.get("rows")
        if not isinstance(rows, list):
            error("chart_rows", path + ".rows", "图表 rows 须为数组")
            return
        for index, row in enumerate(rows):
            rp = f"{path}.rows[{index}]"
            if not isinstance(row, dict):
                error("chart_row", rp, "图表行须为对象")
                continue
            text_field(row, rp, "label")
            segments = row.get("segments")
            if not isinstance(segments, list):
                error("chart_segments", rp + ".segments", "segments 须为数组")
                continue
            for n, segment in enumerate(segments):
                sp = f"{rp}.segments[{n}]"
                if not isinstance(segment, dict):
                    error("chart_segment", sp, "图表分段须为对象")
                    continue
                text_field(segment, sp, "name")
                if not finite_number(segment.get("value")) or segment["value"] < 0:
                    error("chart_value", sp + ".value", "图表数值须为非负有限 number")

    def table_check(table, path):
        if not isinstance(table, dict):
            error("table_type", path, "table 须为对象")
            return
        headers, rows = table.get("headers"), table.get("rows")
        if not isinstance(headers, list) or not headers or any(not isinstance(h, str) or not h.strip() for h in headers):
            error("table_headers", path + ".headers", "headers 须为非空文字数组")
        if not isinstance(rows, list):
            error("table_rows", path + ".rows", "表格 rows 须为数组")
            return
        for index, row in enumerate(rows):
            rp = f"{path}.rows[{index}]"
            if not isinstance(row, dict) or not isinstance(row.get("cells"), list):
                error("table_row", rp, "表格行须为含 cells 数组的对象")
                continue
            if any(not isinstance(cell, str) and not finite_number(cell) for cell in row["cells"]):
                error("table_cell", rp + ".cells", "单元格须为文字或有限数值")
            width = len(row["cells"]) + int("sources" in row or "claim_ids" in row)
            if isinstance(headers, list) and width != len(headers):
                error("table_width", rp, "单元格与自动来源列的总列数须与 headers 一致")

    def date_check(value, path, key):
        precise = key in {"observed_at", "accessed_at", "captured_at", "snapshot_at"} or path == "$.meta.as_of"
        if value is None:
            if precise:
                error("required_date", path, "访问日/资料截至日不可为空")
            return
        if not isinstance(value, str):
            error("date_type", path, "日期须为 ISO 字符串；未知日期使用 null")
            return
        try:
            if re.fullmatch(r"\d{4}", value):
                dt.date(int(value), 1, 1)
                if precise:
                    raise ValueError()
            elif re.fullmatch(r"\d{4}-\d{2}", value):
                dt.date.fromisoformat(value + "-01")
                if precise:
                    raise ValueError()
            elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                dt.date.fromisoformat(value)
            elif "T" in value:
                dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            else:
                raise ValueError()
        except ValueError:
            error("invalid_date", path, "日期无效；使用 YYYY、YYYY-MM、YYYY-MM-DD 或 ISO 时间戳，访问/截至日至少精确到日")

    def walk(node, path):
        if isinstance(node, dict):
            for key, value in node.items():
                child = path + "." + key
                if key in ref_keys and not (path == "$" and key == "sources"):
                    if not isinstance(value, list):
                        error("reference_array", child, "引用必须为 ID 数组")
                    else:
                        for index, ident in enumerate(value):
                            if not isinstance(ident, str) or ident not in ids[ref_keys[key]]:
                                error("dangling_reference", f"{child}[{index}]", f"{ref_keys[key]} 引用不存在：{ident}")
                if key == "core_ids" and path == "$.meta":
                    if not isinstance(value, list):
                        error("reference_array", child, "core_ids 必须为主体 ID 数组")
                    else:
                        for index, ident in enumerate(value):
                            if not isinstance(ident, str) or ident not in ids["entities"]:
                                error("dangling_core", f"{child}[{index}]", "核心主体 ID 不存在：" + str(ident))
                if key in date_keys:
                    date_check(value, child, key)
                if key == "chart":
                    chart_check(value, child)
                if key == "table":
                    table_check(value, child)
                if key == "percent" and value is not None:
                    if not finite_number(value) or not 0 <= value <= 100:
                        error("invalid_percent", child, "百分比必须为 0–100 的有限数值；未知使用 null")
                if key == "amount" and value is not None:
                    if not finite_number(value):
                        error("invalid_amount", child, "amount 必须为有限数值；未知使用 null")
                    for detail in ("currency", "unit"):
                        if not isinstance(node.get(detail), str) or not node[detail].strip():
                            error("amount_context", path + "." + detail, "金额须同时保留币种与单位")
                walk(value, child)
            start, end = node.get("valid_from"), node.get("valid_to")
            if isinstance(start, str) and isinstance(end, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", start) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", end) and start > end:
                error("date_order", path, "valid_from 不得晚于 valid_to")
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{path}[{index}]")
        elif isinstance(node, float) and not math.isfinite(node):
            error("nonfinite_number", path, "数值必须有限；未知使用 null")

    walk(data, "$")

    source_rows = {r["id"]: r for r, _ in tables["sources"] if isinstance(r.get("id"), str)}
    for ident in source_rows:
        seen, cursor = set(), ident
        while cursor in source_rows:
            if cursor in seen:
                error("source_origin_cycle", "$.sources", "原始来源链存在循环：" + ident)
                break
            seen.add(cursor)
            cursor = source_rows[cursor].get("origin_id")
            if not isinstance(cursor, str):
                break

    retired = set()
    revision = data.get("revision", {})
    if not isinstance(revision, dict):
        error("revision_type", "$.revision", "revision 必须为对象")
        revision = {}
    if revision.get("kind") not in {None, "research_update", "presentation_only"}:
        error("revision_kind", "$.revision.kind", "更新类型须为 research_update 或 presentation_only")
    if previous is not None and isinstance(previous, dict) and revision.get("kind") == "presentation_only":
        for field in ("as_of", "snapshot_at"):
            if previous.get("meta", {}).get(field) != meta.get(field):
                error("presentation_snapshot", "$.meta." + field, "排版修改应保留原研究日期")
    declarations = revision.get("retired_ids", [])
    if not isinstance(declarations, list):
        error("retired_type", "$.revision.retired_ids", "retired_ids 必须为数组")
        declarations = []
    kind_aliases = {"entity": "entities", "relationship": "relationships", "source": "sources",
                    "asset": "assets", "section": "sections", "question": "questions", "archive": "archives",
                    "claim": "claims", "snapshot": "evidence_manifest",
                    "scorecard": "decision_scorecard", "checklist": "interview_checklist"}
    for index, declaration in enumerate(declarations):
        path = f"$.revision.retired_ids[{index}]"
        if not isinstance(declaration, dict):
            error("retired_record", path, "必须为 {kind,id,reason} 对象")
            continue
        kind = kind_aliases.get(declaration.get("kind"), declaration.get("kind")) if isinstance(declaration.get("kind"), str) else None
        ident, reason = declaration.get("id"), declaration.get("reason")
        if kind not in TRACKED_COLLECTIONS or not isinstance(ident, str) or not ident.strip() or not isinstance(reason, str) or not reason.strip():
            error("retired_record", path, "须给出有效 kind、非空 id 和具体 reason")
            continue
        key = (kind, ident)
        if key in retired:
            error("retired_duplicate", path, "重复的退出说明")
        retired.add(key)
        if ident in ids[kind]:
            warn("retired_still_present", path, "该 ID 仍在当前数据中，请检查退出说明")
    if previous is not None:
        if not isinstance(previous, dict):
            error("previous_type", "$previous", "旧版顶层必须为对象")
        else:
            for kind in TRACKED_COLLECTIONS:
                rows = previous.get(kind, [])
                if not isinstance(rows, list):
                    error("previous_collection", "$previous." + kind, "旧版集合不是数组")
                    continue
                previous_ids = {row["id"] for row in rows if isinstance(row, dict) and isinstance(row.get("id"), str)}
                for ident in sorted(previous_ids - ids[kind]):
                    if (kind, ident) not in retired:
                        error("unexplained_removal", "$." + kind, f"旧版 ID 消失：{ident}；有意更正须在 revision.retired_ids 写明 kind、id、reason")

    adjacency = {ident: set() for ident in ids["entities"]}
    pairs, confirmed_pairs, candidates, disputed = set(), set(), set(), set()
    candidate_edges = disputed_edges = 0
    for row, _ in tables["relationships"]:
        start, end = row.get("from"), row.get("to")
        if not isinstance(start, str) or not isinstance(end, str) or start not in adjacency or end not in adjacency:
            continue
        pair = tuple(sorted((start, end)))
        pairs.add(pair)
        candidate = row.get("status") == "candidate" or row.get("type") == "candidate"
        conflict = row.get("status") == "disputed" or row.get("disputed") is True
        if candidate:
            candidates.update((start, end))
            candidate_edges += 1
        if conflict:
            disputed.update((start, end))
            disputed_edges += 1
        references = row.get("sources", [])
        backed = isinstance(references, list) and bool(references) and all(isinstance(x, str) and x in ids["sources"] for x in references)
        if not candidate and not conflict and backed:
            adjacency[start].add(end)
            adjacency[end].add(start)
            confirmed_pairs.add(pair)
    reachable = set()
    if isinstance(root_id, str) and root_id in adjacency:
        stack = [root_id]
        while stack:
            ident = stack.pop()
            if ident not in reachable:
                reachable.add(ident)
                stack.extend(adjacency[ident] - reachable)
    unreachable = ids["entities"] - reachable
    if reachable:
        for ident in sorted(unreachable):
            warn("unreachable_from_root", "$.entities", f"{ident} 没有经带来源的确认关系连接到根主体；候选/争议连接不作确认路径")
    counts = {
        "entities": len(tables["entities"]),
        "people": sum(r.get("type") == "person" for r, _ in tables["entities"]),
        "companies": sum(r.get("type") == "company" for r, _ in tables["entities"]),
        "products": sum(r.get("type") == "product" for r, _ in tables["entities"]),
        "brands": sum(r.get("type") == "brand" for r, _ in tables["entities"]),
        "entity_pairs": len(pairs), "relationship_facts": len(tables["relationships"]),
        "confirmed_pairs": len(confirmed_pairs), "candidate_relationships": candidate_edges,
        "disputed_relationships": disputed_edges,
        "sources": len(tables["sources"]), "images": len(tables["assets"]),
        "sections": len(tables["sections"]), "questions": len(tables["questions"]),
        "archives": len(tables["archives"]), "findings": len(tables["findings"]),
        "timeline_events": len(tables["timeline"]),
        "claims": len(tables["claims"]), "evidence_files": sum(r.get("status") == "stored" for r, _ in tables["evidence_manifest"]),
        "scorecard_items": len(tables["decision_scorecard"]),
        "green_flags": green_count, "red_flags": red_count,
        "role_dimensions": role_dim_count,
        "checklist_items": len(tables["interview_checklist"]),
    }
    return result(counts, {"root_id": root_id, "confirmed_ids": sorted(reachable),
                           "unreachable_ids": sorted(unreachable),
                           "candidate_endpoint_ids": sorted(candidates),
                           "disputed_endpoint_ids": sorted(disputed)})


def print_report(report, as_json=False):
    if as_json:
        print(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False))
        return
    print("验证通过" if report["ok"] else "验证失败")
    labels = {"entities": "主体", "relationship_facts": "关系事实", "sources": "来源",
              "scorecard_items": "评估卡", "green_flags": "加分项", "red_flags": "避坑红旗",
              "role_dimensions": "岗位维度", "checklist_items": "面试核实项", "images": "图片"}
    print("；".join(f"{label} {report['counts'].get(key, 0)}" for key, label in labels.items()))
    for level, label in (("errors", "错误"), ("warnings", "警告")):
        for item in report[level]:
            print(f"{label} [{item['code']}] {item['path']}: {item['message']}")
    print(f"错误 {len(report['errors'])}，警告 {len(report['warnings'])}")
    for note in report["manual_review"]:
        print("内容复核：" + note)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dossier", type=Path, help="待检查的 JSON 文件")
    parser.add_argument("--previous", type=Path, help="用于检查消失项的旧版 JSON")
    parser.add_argument("--json", action="store_true", help="输出 JSON 诊断")
    args = parser.parse_args()
    try:
        data = load_json(args.dossier)
        previous = load_json(args.previous) if args.previous else None
        report = validate_dossier(data, args.dossier.resolve().parent, previous)
    except (OSError, ValueError, TypeError, RecursionError) as exc:
        report = {"ok": False, "errors": [{"code": "input_error", "path": "$", "message": str(exc)}],
                  "warnings": [], "counts": {}, "reachability": {}, "manual_review": MANUAL_REVIEW}
    print_report(report, args.json)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
