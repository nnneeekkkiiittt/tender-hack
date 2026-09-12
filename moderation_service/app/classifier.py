import os
from threading import BoundedSemaphore

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from .lexicon import obscene
from .normalization import variants

POLICY_VERSION = 'obscenity-v1'


class BusyError(Exception):
    pass


class Classifier:
    def __init__(self, path: str, threshold: float = 0.95):
        if not 0 < threshold < 1:
            raise ValueError('Invalid obscenity threshold')
        torch.set_num_threads(int(os.getenv('MODERATION_THREADS', '2')))
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(
            path, local_files_only=True, use_safetensors=True).eval().to('cpu')
        self.label = next(int(k) for k, v in self.model.config.id2label.items() if v == 'obscenity')
        self.threshold = threshold
        self.capacity = BoundedSemaphore(1)
        self.max_length = min(256, self.model.config.max_position_embeddings)
        self.check('Проверка готовности сервиса')

    def check(self, text: str) -> dict:
        if obscene(text):
            return self.result(True, 'lexicon')
        if not self.capacity.acquire(blocking=False):
            raise BusyError('Moderation busy')
        try:
            highest = 0.0
            with torch.inference_mode():
                for variant in variants(text):
                    chunks = self.tokenizer(variant, truncation=True, max_length=self.max_length,
                        stride=32, return_overflowing_tokens=True, padding=False)
                    count = len(chunks['input_ids'])
                    for start in range(0, count, 8):
                        features = [{k: chunks[k][i] for k in self.tokenizer.model_input_names if k in chunks}
                                    for i in range(start, min(start + 8, count))]
                        batch = self.tokenizer.pad(features, padding=True, return_tensors='pt')
                        scores = torch.sigmoid(self.model(**batch).logits)[:, self.label]
                        highest = max(highest, float(scores.max()))
                        if highest >= self.threshold:
                            return self.result(True, 'classifier')
            return self.result(False, 'classifier')
        finally:
            self.capacity.release()

    @staticmethod
    def result(blocked: bool, detector: str) -> dict:
        return {'decision': 'BLOCK' if blocked else 'ALLOW',
                'reason': 'OBSCENITY' if blocked else None,
                'policy_version': POLICY_VERSION, 'detector': detector}
