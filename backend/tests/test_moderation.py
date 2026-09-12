from unittest.mock import Mock
from uuid import uuid4

import httpx
import psycopg
import pytest
from conftest import create_ticket

from app.moderation import Decision, HttpModerationService, ModerationUnavailable


def snapshot(url):
    with psycopg.connect(url) as conn:
        return {table: conn.execute(f'SELECT * FROM {table} ORDER BY id').fetchall()
                for table in ('claims', 'messages', 'claim_events', 'reactions')}


@pytest.mark.parametrize('unavailable', [False, True])
def test_initial_block_or_outage_has_no_writes_or_ai_call(env, database_url, unavailable):
    app, _, make = env
    owner, _ = make('moderation-owner')
    service = Mock()
    if unavailable:
        service.check.side_effect = ModerationUnavailable()
    else:
        service.check.return_value = Decision(decision='BLOCK', reason='OBSCENITY', policy_version='test')
    app.state.moderation_service = service
    app.state.ai_service = Mock()
    before = snapshot(database_url)
    response = owner.post('/api/tickets', json={'text': 'Forbidden message'})
    assert response.status_code == (503 if unavailable else 422)
    assert response.json()['detail']['code'] == ('MODERATION_UNAVAILABLE' if unavailable else 'MESSAGE_BLOCKED')
    assert snapshot(database_url) == before
    app.state.ai_service.ask.assert_not_called()


@pytest.mark.parametrize('level', [0, 1, 2, 3])
@pytest.mark.parametrize('unavailable', [False, True])
def test_followup_block_preserves_history_queue_and_assignment(env, database_url, level, unavailable):
    app, _, make = env
    owner, _ = make('moderation-owner')
    other, _ = make('moderation-other')
    ticket = create_ticket(owner)
    with psycopg.connect(database_url) as conn:
        for tier in range(1, level + 1):
            conn.execute('UPDATE claims SET handling_level=%s WHERE id=%s', (tier, ticket['id']))
    app.state.moderation_service = Mock(check=Mock(return_value=Decision(
        decision='BLOCK', reason='OBSCENITY', policy_version='test')))
    if unavailable:
        app.state.moderation_service.check.side_effect = ModerationUnavailable()
    before = snapshot(database_url)
    path = f"/api/tickets/{ticket['id']}/messages"
    assert other.post(path, json={'text': 'Forbidden'}).status_code == 404
    app.state.moderation_service.check.assert_not_called()
    assert owner.post(path, json={'text': 'Forbidden'}).status_code == (503 if unavailable else 422)
    assert snapshot(database_url) == before


def test_retry_existing_claim_does_not_need_moderation_again(env):
    app, _, make = env
    owner, _ = make('moderation-retry')
    request_id = str(uuid4())
    ticket = create_ticket(owner, request_id=request_id)
    app.state.moderation_service = Mock(check=Mock(side_effect=ModerationUnavailable()))
    assert create_ticket(owner, request_id=request_id)['id'] == ticket['id']
    app.state.moderation_service.check.assert_not_called()


@pytest.mark.parametrize('body', [{}, {'decision': 'UNKNOWN'},
    {'decision': 'ALLOW', 'reason': 'OBSCENITY', 'policy_version': 'test'},
    {'decision': 'BLOCK', 'reason': None, 'policy_version': 'test'}])
def test_invalid_contract_is_an_outage_not_allow_or_block(body):
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))) as client:
        with pytest.raises(ModerationUnavailable):
            HttpModerationService(client, 'http://moderation/check').check('Text')


def test_http_auth_transport_and_timeout():
    def handler(request):
        assert request.headers['authorization'] == 'Bearer test-key'
        assert request.read() == b'{"text":"Text"}'
        return httpx.Response(200, json={'decision': 'ALLOW', 'reason': None, 'policy_version': 'test'})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert HttpModerationService(client, 'http://moderation/check', 'test-key').check('Text').decision == 'ALLOW'
        with pytest.raises(ModerationUnavailable):
            HttpModerationService(client, '').check('Text')
    def timeout(request):
        raise httpx.ReadTimeout('private message', request=request)
    with httpx.Client(transport=httpx.MockTransport(timeout)) as client:
        with pytest.raises(ModerationUnavailable):
            HttpModerationService(client, 'http://moderation/check').check('Text')
