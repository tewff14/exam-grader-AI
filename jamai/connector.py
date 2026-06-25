"""Thin wrapper around the JamAI Base Python SDK.

The app talks to three JamAI action tables, one per stage of the exam
workflow. Each table is provisioned by the teacher/admin in the JamAI Base
console (this module only calls them) - see the docstring on each function
below for the input/output columns a table needs to match this contract.
"""

import json
import re
from functools import lru_cache

from jamaibase import JamAI
import jamaibase.types as t

from backend import settings

TABLE_TYPE = "action"

_CODE_FENCE_RE = re.compile(r"^```[a-zA-Z]*\n|\n```$")


def _strip_code_fence(text: str) -> str:
    """Models often wrap JSON output in a ```json ... ``` fence despite being
    told not to. Strip it so json.loads sees raw JSON either way.
    """
    return _CODE_FENCE_RE.sub("", text.strip()).strip()


@lru_cache(maxsize=1)
def get_client() -> JamAI:
    kwargs = dict(project_id=settings.JAMAI_PROJECT_ID, token=settings.JAMAI_TOKEN)
    if settings.JAMAI_API_BASE:
        kwargs["api_base"] = settings.JAMAI_API_BASE
    return JamAI(**kwargs)


# JamAI Base adds these to every table; the SDK's column metadata has no
# flag marking them as such, so they have to be excluded by name to avoid
# auto-detection grabbing one instead of a real input column.
_SYSTEM_COLUMNS = {"ID", "Updated at"}


@lru_cache(maxsize=8)
def _detect_columns(
    table_id: str, image_override: str | None, text_override: str | None
) -> tuple[str | None, str | None, str]:
    """Detect (image_input_col, text_input_col, final_output_col) for a table.

    image_input_col / text_input_col: an explicit override wins; otherwise
    the first non-system input column (no gen_config) matching that dtype is
    used. Either may end up None if the table has no such input.
    final_output_col: the last output column (gen_config set), i.e. the
    table's final result column.
    """
    client = get_client()
    meta = client.table.get_table(TABLE_TYPE, table_id)

    image_col = image_override
    text_col = text_override
    output_cols = []
    for col in meta.cols:
        if col.id in _SYSTEM_COLUMNS:
            continue
        if col.gen_config is not None:
            output_cols.append(col.id)
        elif image_col is None and col.dtype in ("image", "file"):
            image_col = col.id
        elif text_col is None and col.dtype in ("text", "str") and col.id != image_col:
            text_col = col.id

    if not output_cols:
        raise RuntimeError(f"Could not find any output column in table '{table_id}'.")
    return image_col, text_col, output_cols[-1]


def _run(
    table_id: str,
    image_col: str | None,
    text_col: str | None,
    final_col: str,
    image_path: str | None,
    text_value: str | None,
) -> object:
    """Add one row to `table_id` and return the parsed JSON from its final column."""
    client = get_client()
    data: dict = {}
    if image_col and image_path:
        data[image_col] = client.file.upload_file(image_path).uri
    if text_col and text_value is not None:
        data[text_col] = text_value

    response = client.table.add_table_rows(
        TABLE_TYPE,
        t.MultiRowAddRequest(table_id=table_id, data=[data], stream=False),
    )
    row = response.rows[0]
    raw_text = _strip_code_fence(row.columns[final_col].text)
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"JamAI table '{table_id}' final column '{final_col}' did not return valid JSON: {raw_text!r}"
        ) from exc


def extract_questions(image_path: str) -> list[dict]:
    """Upload a blank question-paper image to the extraction table.

    Table contract:
      input:  one image/file column (the question paper).
      output: final column = JSON array, one entry per question -
        [{"question_no": int, "text": str, "topic": str}, ...]
    """
    image_col, _, final_col = _detect_columns(
        settings.JAMAI_EXTRACTION_TABLE_ID, settings.JAMAI_EXTRACTION_IMAGE_COL or None, None
    )
    if image_col is None:
        raise RuntimeError(
            f"Could not find an image/file input column in table "
            f"'{settings.JAMAI_EXTRACTION_TABLE_ID}'."
        )
    result = _run(settings.JAMAI_EXTRACTION_TABLE_ID, image_col, None, final_col, image_path, None)
    if not isinstance(result, list):
        raise ValueError(f"Extraction table returned non-list JSON: {result!r}")
    return result


def score_paper(image_path: str, qa_payload: list[dict]) -> list[dict]:
    """Upload a student's answer paper + the exam's questions/solutions to the scoring table.

    Table contract:
      input:  one image/file column (the student's answer paper) and one text
        column that receives the questions+solutions JSON payload.
      output: final column = JSON array, one entry per question -
        [{"question_no": int, "student_answer": str, "score": float,
          "max_score": float, "feedback": str}, ...]
    """
    image_col, text_col, final_col = _detect_columns(
        settings.JAMAI_SCORING_TABLE_ID,
        settings.JAMAI_SCORING_IMAGE_COL or None,
        settings.JAMAI_SCORING_TEXT_COL or None,
    )
    if image_col is None:
        raise RuntimeError(
            f"Could not find an image/file input column in table '{settings.JAMAI_SCORING_TABLE_ID}'."
        )
    if text_col is None:
        raise RuntimeError(
            f"Could not find a text input column for the questions/solutions payload in "
            f"table '{settings.JAMAI_SCORING_TABLE_ID}'."
        )
    result = _run(
        settings.JAMAI_SCORING_TABLE_ID,
        image_col,
        text_col,
        final_col,
        image_path,
        json.dumps(qa_payload),
    )
    if not isinstance(result, list):
        raise ValueError(f"Scoring table returned non-list JSON: {result!r}")
    return result


def generate_exam(context_payload: dict) -> list[dict]:
    """Send aggregated performance context + the teacher's prompt to the generation table.

    Table contract:
      input:  one text column that receives the context JSON (performance
        summary + the teacher's characteristic prompt).
      output: final column = JSON array, one entry per suggested question -
        [{"question_no": int, "text": str, "topic": str,
          "suggested_solution": str, "suggested_max_points": float}, ...]
    """
    _, text_col, final_col = _detect_columns(
        settings.JAMAI_GENERATION_TABLE_ID, None, settings.JAMAI_GENERATION_TEXT_COL or None
    )
    if text_col is None:
        raise RuntimeError(
            f"Could not find a text input column in table '{settings.JAMAI_GENERATION_TABLE_ID}'."
        )
    result = _run(
        settings.JAMAI_GENERATION_TABLE_ID, None, text_col, final_col, None, json.dumps(context_payload)
    )
    if not isinstance(result, list):
        raise ValueError(f"Generation table returned non-list JSON: {result!r}")
    return result


def health_check() -> dict:
    """Report detected columns (or the error) for each of the three tables."""
    checks = {
        "extraction": (
            settings.JAMAI_EXTRACTION_TABLE_ID,
            settings.JAMAI_EXTRACTION_IMAGE_COL or None,
            None,
        ),
        "scoring": (
            settings.JAMAI_SCORING_TABLE_ID,
            settings.JAMAI_SCORING_IMAGE_COL or None,
            settings.JAMAI_SCORING_TEXT_COL or None,
        ),
        "generation": (
            settings.JAMAI_GENERATION_TABLE_ID,
            None,
            settings.JAMAI_GENERATION_TEXT_COL or None,
        ),
    }
    info = {}
    for name, (table_id, image_override, text_override) in checks.items():
        try:
            image_col, text_col, final_col = _detect_columns(table_id, image_override, text_override)
            info[name] = {
                "table_id": table_id,
                "image_column": image_col,
                "text_column": text_col,
                "final_column": final_col,
            }
        except Exception as exc:  # noqa: BLE001 - surface per-table misconfiguration without crashing
            info[name] = {"table_id": table_id, "error": str(exc)}
    return info
