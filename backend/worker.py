"""Background processing queue for uploaded student papers.

The JamAI SDK's sync client blocks on network I/O, so each paper is scored
in a thread-pool worker rather than the FastAPI event loop. The frontend
polls the exam's paper list to observe each row's status transition:
queued -> processing -> scored | error
"""

from concurrent.futures import ThreadPoolExecutor

from backend import db, grading, settings

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="paper-score")


def enqueue_paper_upload(exam_id: int, student_id: str, file_bytes: bytes, filename: str) -> int:
    """Persist the uploaded image and queue a background scoring job. Returns paper_id."""
    paper_id = db.create_queued_paper(exam_id, student_id, filename)

    image_path = settings.UPLOAD_DIR / f"paper{paper_id}_{filename}"
    image_path.write_bytes(file_bytes)
    db.set_paper_image_path(paper_id, str(image_path))

    _executor.submit(_process_paper, paper_id)
    return paper_id


def enqueue_rescore(paper_id: int) -> None:
    """Re-run scoring for an already-uploaded paper, preserving teacher overrides."""
    _executor.submit(_process_paper, paper_id)


def _process_paper(paper_id: int) -> None:
    try:
        db.set_paper_status(paper_id, "processing")
        grading.run_scoring(paper_id)
        db.set_paper_status(paper_id, "scored")
    except Exception as exc:  # noqa: BLE001 - surface any failure on the row itself
        db.set_paper_status(paper_id, "error", error=str(exc))
