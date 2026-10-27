import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from platform_core.store import ExcelStore
from services.migration import migrate_legacy

parser = argparse.ArgumentParser(
    description="Read-only legacy SQLite import into an empty Excel workbook."
)
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--workbook", type=Path, required=True)
args = parser.parse_args()
print(
    "Imported into the demo account."
    if migrate_legacy(ExcelStore(args.workbook), args.source)
    else "No import: missing source, existing agents, or previously imported source."
)
