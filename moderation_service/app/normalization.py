"""Detection-only normalization. Never replace the user's stored text."""
import re
import unicodedata

LOOKALIKES = str.maketrans('aceopxykmth', 'асеорхукмтн')


def normalize(text: str) -> str:
    text = unicodedata.normalize('NFKC', text).casefold().replace('ё', 'е')
    return ''.join(c for c in text if unicodedata.category(c) not in {'Cf', 'Mn'})


def fold_word(word: str) -> str:
    return re.sub(r'(.)\1+', r'\1', word.translate(LOOKALIKES))


def variants(text: str) -> list[str]:
    normalized = normalize(text)
    folded = re.sub(r'[a-zа-я]+', lambda m: m[0].translate(LOOKALIKES)
                    if re.search('[а-я]', m[0]) else m[0], normalized)
    return list(dict.fromkeys([text, folded]))
