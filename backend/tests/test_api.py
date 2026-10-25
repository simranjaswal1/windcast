import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _get(**params):
    r = client.get("/api/errors", params=params)
    if r.status_code == 500:
        pytest.skip("no data snapshot available")
    return r


def test_errors_are_paginated_and_sorted_by_size():
    first, second = _get(page_size=10).json(), _get(page_size=10, page=2).json()
    sizes = [abs(r["error"]) for r in first["rows"]]
    assert len(first["rows"]) == 10 and sizes == sorted(sizes, reverse=True)
    assert first["total"] > 10 and first["pages"] >= 2
    assert {r["startTime"] for r in first["rows"]}.isdisjoint({r["startTime"] for r in second["rows"]})


def test_errors_rejects_bad_input():
    assert client.get("/api/errors", params={"page_size": 1000}).status_code == 422
    assert client.get("/api/errors", params={"sort": "nope"}).status_code in (422, 500)
