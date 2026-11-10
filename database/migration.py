"""Non-destructive migration of the previous default workbook location."""
import os
import shutil
import tempfile
from filelock import FileLock


def prepare_workbook(root, destination):
    source = root / "data/platform.xlsx"
    if destination != root / "database/data/platform.xlsx" or not source.is_file():
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    with FileLock(str(source) + ".lock", timeout=15), FileLock(str(destination) + ".lock", timeout=15):
        if destination.exists():
            return
        descriptor, name = tempfile.mkstemp(dir=destination.parent, suffix=".xlsx")
        os.close(descriptor)
        try:
            shutil.copy2(source, name)
            os.replace(name, destination)
        finally:
            if os.path.exists(name):
                os.unlink(name)
