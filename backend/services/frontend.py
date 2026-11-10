"""Serve the workspace as one ordered, versioned script without a build dependency."""
import hashlib
import re
from backend.core.config import ROOT


def workspace_script():
    folder = ROOT / 'frontend/static'
    base = (folder / 'app.js').read_text(encoding='utf-8')
    suite = (folder / 'suite-ui.js').read_text(encoding='utf-8')
    bootstrap = base.rfind('(async () => {')
    if bootstrap < 0:
        raise RuntimeError('Workspace bootstrap is missing.')
    prefix = base[:bootstrap]
    startup = base[bootstrap:].split('\nwindow.legacySuiteUI =', 1)[0]
    for name in re.findall(r'^function (\w+)\(', suite, re.MULTILINE):
        prefix = re.sub(rf'\bfunction {name}\(', f'function legacy{name[0].upper() + name[1:]}(', prefix)
    capture = '\nwindow.legacySuiteUI = {libraryPage: legacyLibraryPage, playBody: legacyPlayBody, bind: legacyBind, filterCatalog: legacyFilterCatalog};\n'
    return prefix + capture + suite + '\n' + startup


def frontend_version():
    content = workspace_script() + (ROOT / 'frontend/static/style.css').read_text(encoding='utf-8')
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:12]
