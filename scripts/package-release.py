#!/usr/bin/env python3
"""Build a deterministic, explicitly allowlisted review ZIP; never publish it."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent
FILES = tuple(sorted((
    'manifest.json', 'PRIVACY.md',
    'background/authorization.js', 'background/registrations.js', 'background/service-worker.js',
    'content/lock.js',
    'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
    'popup/popup.html', 'popup/popup.css', 'popup/popup.js',
    'settings/settings.html', 'settings/settings.css', 'settings/settings.js',
    'shared/client.js', 'shared/crypto.js', 'shared/storage.js', 'shared/utils.js',
    'shared/tokens.css', 'shared/ui.css', 'shared/ui.js',
)))


def read_source(name):
    path = ROOT / name
    if any(parent.is_symlink() for parent in (path, *path.parents) if parent != ROOT.parent):
        raise ValueError(f'Symlink is not a release source: {name}')
    if not path.is_file() or not path.resolve().is_relative_to(ROOT):
        raise ValueError(f'Missing or unsafe release source: {name}')
    return path.read_bytes()


def build():
    manifest = json.loads(read_source('manifest.json'))
    version = manifest['version']
    if not isinstance(version, str) or not re.fullmatch(r'(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}', version):
        raise ValueError('Invalid manifest version')
    if any(int(part) > 65535 for part in version.split('.')) or not any(int(part) for part in version.split('.')):
        raise ValueError('Invalid manifest version')
    package = json.loads(read_source('package.json'))
    lock = json.loads(read_source('package-lock.json'))
    if {package['version'], lock['version'], lock['packages']['']['version']} != {version}:
        raise ValueError('Manifest, package and lockfile versions must agree')
    if manifest.get('manifest_version') != 3:
        raise ValueError('Only Manifest V3 is supported')
    styles = read_source('shared/tokens.css') + b'\n' + read_source('content/lock.css')
    match = re.search(rb'const STYLES = `([\s\S]*?)`;', read_source('content/lock.js'))
    if not match or match.group(1) != b'\n' + styles:
        raise ValueError('Embedded lock styles are stale; run npm run sync:styles')
    output = io.BytesIO()
    # Stored entries avoid compressor-version differences. Sorted paths, fixed
    # timestamps/modes and no source metadata make identical bytes reproducible.
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name in FILES:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, read_source(name))
    return version, output.getvalue()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'dist')
    args = parser.parse_args()
    version, data = build()  # Validate every source before producing an artifact.
    args.output_dir.mkdir(parents=True, exist_ok=True)
    name = f'padlox-{version}.zip'
    digest = hashlib.sha256(data).hexdigest()
    (args.output_dir / name).write_bytes(data)
    (args.output_dir / f'padlox-{version}.sha256').write_text(f'{digest}  {name}\n', encoding='utf-8')
    print(f'{args.output_dir / name}\nSHA-256: {digest}\nReview candidate only; tests and store release gates are separate.')


if __name__ == '__main__':
    main()
