import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")

JAMAI_TOKEN = os.getenv("JAMAI_TOKEN", "")
JAMAI_PROJECT_ID = os.getenv("JAMAI_PROJECT_ID", "proj_9f386b9e35a4f019119bfc11")
JAMAI_API_BASE = os.getenv("JAMAI_API_BASE", "")

# Three JamAI action tables, one per stage of the exam workflow. The tables
# themselves are provisioned by the teacher/admin in the JamAI Base console;
# these IDs just need to match what was created there.
JAMAI_EXTRACTION_TABLE_ID = os.getenv("JAMAI_EXTRACTION_TABLE_ID", "Question_extraction")
JAMAI_SCORING_TABLE_ID = os.getenv("JAMAI_SCORING_TABLE_ID", "Subjective_test_scoring")
JAMAI_GENERATION_TABLE_ID = os.getenv("JAMAI_GENERATION_TABLE_ID", "Exam_generation")

# Optional explicit column-id overrides. The scoring table has two inputs
# (image + text), so auto-detecting "the first image column" / "the first
# text column" is fragile; set these if a table's column order/dtypes are
# ambiguous. Left unset, connector.py falls back to auto-detection.
JAMAI_EXTRACTION_IMAGE_COL = os.getenv("JAMAI_EXTRACTION_IMAGE_COL", "")
JAMAI_SCORING_IMAGE_COL = os.getenv("JAMAI_SCORING_IMAGE_COL", "")
JAMAI_SCORING_TEXT_COL = os.getenv("JAMAI_SCORING_TEXT_COL", "")
JAMAI_GENERATION_TEXT_COL = os.getenv("JAMAI_GENERATION_TEXT_COL", "")

DATA_DIR = BACKEND_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "data.db"

UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
