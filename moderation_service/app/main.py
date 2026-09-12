import os
from contextlib import asynccontextmanager
from hmac import compare_digest

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .classifier import BusyError, Classifier


class CheckInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(min_length=1, max_length=10000)


def create_app(classifier=None, api_key=None):
    key = os.getenv('MODERATION_API_KEY', '') if api_key is None else api_key

    @asynccontextmanager
    async def lifespan(app):
        app.state.classifier = classifier if classifier is not None else Classifier(
            os.getenv('MODERATION_MODEL_PATH', '/model'), float(os.getenv('OBSCENITY_THRESHOLD', '0.95')))
        yield

    app = FastAPI(title='Tender moderation', lifespan=lifespan)

    @app.get('/health/ready')
    def ready():
        return {'status': 'ready'}

    @app.post('/check')
    def check(body: CheckInput, authorization: str = Header('')):
        if key and not compare_digest(authorization, 'Bearer ' + key):
            raise HTTPException(401, 'Invalid moderation credentials')
        try:
            return app.state.classifier.check(body.text)
        except BusyError:
            raise HTTPException(503, 'Moderation busy') from None
        except Exception:  # noqa: BLE001 - fail closed without logging private model inputs
            # Do not log message text, model tokens, or credentials.
            raise HTTPException(503, 'Moderation unavailable') from None

    return app


app = create_app()
