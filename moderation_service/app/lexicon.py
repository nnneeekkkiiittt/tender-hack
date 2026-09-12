import json
import re
from pathlib import Path

from .normalization import fold_word, normalize

DATA = json.loads((Path(__file__).resolve().parents[1] / 'data/obscenity_ru.json').read_text())
PATTERNS = [re.compile(p) for p in DATA['patterns']]


def matches(word: str) -> bool:
    return any(candidate not in DATA['exceptions'] and any(p.fullmatch(candidate) for p in PATTERNS)
               for candidate in (word, fold_word(word)))


def obscene(text: str) -> bool:
    text = normalize(text)
    tokens = list(re.finditer(r'[a-zа-я0-9*]+', text))
    for i, token in enumerate(tokens):
        if matches(token[0]):
            return True
        # Join only bounded runs of isolated letters, never entire sentences.
        if len(token[0]) != 1:
            continue
        candidate = token[0]
        end = token.end()
        for following in tokens[i + 1:i + 16]:
            if len(following[0]) != 1 or not re.fullmatch(r'[\s._-]{1,3}', text[end:following.start()]):
                break
            candidate += following[0]
            if len(candidate) >= 3 and matches(candidate):
                return True
            end = following.end()
    return False
