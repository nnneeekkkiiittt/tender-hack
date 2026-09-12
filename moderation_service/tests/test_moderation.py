from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from app.classifier import BusyError, Classifier
from app.lexicon import obscene
from app.main import create_app
from app.normalization import normalize


@pytest.mark.parametrize('text', ['хуй', 'иди нахуй', 'пиздец', 'заебали', 'блядь', 'блять',
    'ХУЙ', 'хyй', 'ху\u200bй', 'х.у.й', 'я х у й', 'х_у_й', 'хууууй', 'х*й',
    'п*зда', 'е*ать', 'blyat', 'fuck', 'bullshit', 'Он написал «блядь»',
    'Вы долбоебы', 'долбоёб', 'мудак'])
def test_explicit_and_disguised_profanity(text):
    assert obscene(text)


@pytest.mark.parametrize('text', ['подстрахуй меня', 'страхуй', 'рубля', 'бляха', 'хулиган',
    'педикюр', 'сукно', 'Херсон', 'ебей', 'Я недоволен поддержкой', 'Вы идиоты',
    'HTTP 500: traceback', 'Как загрузить МЧД?', 'x * y', 'job', 'shipment'])
def test_no_substring_or_general_insult_blocks(text):
    assert not obscene(text)


def test_normalization_preserves_original_and_handles_invisible_marks():
    text = 'ХУ\u200bЙ'
    assert normalize(text) == 'хуй'
    assert text == 'ХУ\u200bЙ'


def test_rules_apply_without_model_capacity():
    classifier = Classifier.__new__(Classifier)
    assert classifier.check('пиздец')['decision'] == 'BLOCK'


def test_auth_validation_and_internal_failures_do_not_leak_text():
    classifier = Mock(check=Mock(return_value=Classifier.result(False, 'classifier')))
    with TestClient(create_app(classifier, api_key='test-key')) as client:
        assert client.get('/health/ready').status_code == 200
        assert client.post('/check', json={'text': 'Text'}).status_code == 401
        headers = {'Authorization': 'Bearer test-key'}
        assert client.post('/check', json={'text': 'x' * 10001}, headers=headers).status_code == 422
        assert client.post('/check', json={'text': 'Text', 'role': 'admin'}, headers=headers).status_code == 422
        assert client.post('/check', json={'text': 'Text'}, headers=headers).json()['decision'] == 'ALLOW'
        for error in (BusyError('private text'), RuntimeError('private text')):
            classifier.check.side_effect = error
            response = client.post('/check', json={'text': 'Text'}, headers=headers)
            assert response.status_code == 503 and 'private' not in response.text
