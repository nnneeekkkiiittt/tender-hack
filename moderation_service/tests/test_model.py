import os

import pytest

from app.classifier import Classifier


@pytest.fixture(scope='module')
def model():
    path = os.getenv('MODERATION_TEST_MODEL')
    if not path:
        pytest.skip('Set MODERATION_TEST_MODEL to checksum-verified local weights')
    return Classifier(path)


@pytest.mark.parametrize('text', ['Как загрузить МЧД?', 'Вы идиоты', 'подстрахуй меня',
                                 'ебей', 'Регистрация не работает'])
def test_real_model_allows_clean_text(model, text):
    assert model.check(text)['decision'] == 'ALLOW'


def test_long_tail_is_checked(model):
    text = 'Пожалуйста помогите. ' * 450
    assert model.check(text)['decision'] == 'ALLOW'
    assert model.check(text + 'блядь')['decision'] == 'BLOCK'


def test_model_checks_every_window(model, monkeypatch):
    from types import SimpleNamespace

    import torch
    calls = []
    def forward(**batch):
        calls.append(len(batch['input_ids']))
        logits = torch.full((len(batch['input_ids']), model.model.config.num_labels), -10.0)
        # A synthetic positive only beyond the first batch proves no truncation.
        if len(calls) > 1:
            logits[-1, model.label] = 10.0
        return SimpleNamespace(logits=logits)
    monkeypatch.setattr(model.model, 'forward', forward)
    assert model.check('Проверка документа. ' * 500)['decision'] == 'BLOCK'
    assert len(calls) > 1
