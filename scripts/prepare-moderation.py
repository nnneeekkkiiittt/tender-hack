"""Download checksum-pinned CPU moderation assets (no GPU required)."""
import argparse
import json
from pathlib import Path

from demo import ROOT, fetch

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--destination', type=Path, default=ROOT / '.demo/models/moderation')
args = parser.parse_args()
lock = json.loads((ROOT / 'assets/moderation.lock.json').read_text())
for asset in lock['models']:
    fetch(asset, args.destination / asset['path'])
