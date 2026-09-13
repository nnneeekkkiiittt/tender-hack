import httpx
from fastapi.testclient import TestClient


def test_analytics_requires_admin_and_csrf(env, monkeypatch):
    app, admin, make = env
    assert TestClient(app).get('/api/v1/analytics/users').status_code == 401
    for name, role in [('reader', 'user'), ('agent', 'supportL1')]:
        client, _ = make(name, role)
        assert client.get('/api/v1/analytics/users').status_code == 403
    seen = []
    async def upstream(self, method, url, **kwargs):
        seen.append((method, str(url), kwargs))
        return httpx.Response(200, json={'ok': True})
    monkeypatch.setattr(httpx.AsyncClient, 'request', upstream)
    assert admin.get('/api/v1/analytics/users?limit=1').json() == {'ok': True}
    assert seen[0][1] == 'http://analytics:8080/api/v1/analytics/users?limit=1'
    assert 'cookie' not in seen[0][2]['headers']
    assert admin.post('/api/v1/dashboards', headers={'X-Requested-With': ''}, json={}).status_code == 403
    assert admin.post('/api/v1/dashboards', json={'name': 'test'}).status_code == 200
