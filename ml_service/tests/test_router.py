from unittest.mock import Mock

import pytest

from app.ml.router import IntentRouter


@pytest.mark.parametrize('line', ['L1', 'L2', 'L3', 'OUT_OF_SCOPE'])
def test_router_keeps_all_supported_tiers_and_accepts_fenced_json(line):
    router = IntentRouter()
    response = Mock()
    response.json.return_value = {'choices': [{'message': {
        'content': '```json\n{"line":"' + line + '","topic":"Test","confidence":2}\n```'}}]}
    router.session.post = Mock(return_value=response)
    decision = router.route('Test question')
    assert decision.line == line
    assert decision.confidence == 1
    assert decision.needs_rag == (line in {'L1', 'L2'})


def test_router_failure_keeps_incident_escalation():
    router = IntentRouter()
    router.session.post = Mock(side_effect=RuntimeError('unavailable'))
    decision = router.route('HTTP 500 Internal Server Error')
    assert decision.line == 'L3'
    assert not decision.needs_rag
