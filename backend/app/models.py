from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from fastapi import Path
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Identifier = Annotated[int, Path(gt=0, le=9223372036854775807)]

Username = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64, pattern=r"^[\w.-]+$")
]
Password = Annotated[str, StringConstraints(min_length=10, max_length=128)]
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]
Role = Literal["user", "admin", "supportL1", "supportL2", "supportL3"]
SupportRole = Literal["supportL1", "supportL2", "supportL3"]
Status = Literal["NEW", "IN WORK", "DONE", "CANCELLED"]
Topic = Literal["TECHNICAL", "DOCUMENTS", "PROCUREMENT", "ACCOUNT", "CONTRACT", "OTHER"]
Reason = Literal[
    "SLOW WORK", "INCORRECT ANSWER", "IRRELEVANT ANSWER", "RUDE BEHAVIOUR", "DEPRECATED KNOWLEDGE BASE"
]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Credentials(Input):
    name: Username
    password: Password


class Login(Input):
    name: Username
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    remember: bool = False


class User(BaseModel):
    id: str
    name: str
    role: Role


class PasswordChange(Input):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Password


class PasswordReset(Input):
    new_password: Password


class EmployeeCreate(Credentials):
    role: SupportRole


class EmployeeUpdate(Input):
    name: Username
    role: SupportRole


class TicketCreate(Input):
    text: Text
    topic: Topic = "OTHER"
    request_id: UUID | None = None


class MessageCreate(Input):
    text: Text


class Assignment(Input):
    operator_id: int = Field(gt=0, le=9223372036854775807)


class Escalation(Input):
    expected_level: Literal[1, 2]


class StatusChange(Input):
    status: Literal["DONE", "CANCELLED"]


class Classification(Input):
    topic: Topic
    subtopic: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None


class ReactionInput(Input):
    like: bool
    reasons: list[Reason] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def validate_reasons(self):
        if self.like == bool(self.reasons) or len(self.reasons) != len(set(self.reasons)):
            raise ValueError("Positive ratings have no reasons; negative ratings need unique reasons")
        return self


class Reaction(BaseModel):
    id: str
    claim_id: str
    submitted_by: str
    target_kind: Literal["AI_MESSAGE", "OPERATOR"]
    message_id: str | None
    operator_id: str | None
    like: bool
    reasons: list[Reason]


class Ticket(BaseModel):
    id: str
    author_id: str
    author_name: str
    title: str
    topic: str
    subtopic: str | None
    status: Status
    handling_level: Literal[0, 1, 2, 3]
    operator_id: str | None
    operator_name: str | None
    created_at: datetime
    updated_at: datetime
    assigned_at: datetime | None
    resolved_at: datetime | None
    cancelled_at: datetime | None


class Message(BaseModel):
    id: str
    author_id: str | None
    author_name: str | None
    author_kind: str
    text: str
    sent_at: datetime
    sources: list[str] = Field(default_factory=list)
    disliked: bool = False
    liked: bool = False
    reaction: Reaction | None = None
    ml_context: dict | None = None


class MessagePage(BaseModel):
    items: list[Message]
    next_before: str | None


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    offset: int
    limit: int


class AiRoute(BaseModel):
    line: Literal["L1", "L2", "L3", "OUT_OF_SCOPE"]
    confidence: float = Field(default=1, ge=0, le=1)
    topic: str = Field(default="Общее", max_length=1000)
    subtopic: str | None = Field(default=None, max_length=1000)
    reasoning: str = Field(default="", max_length=4000)
    needs_rag: bool = True


class AiCitation(BaseModel):
    text: str = Field(max_length=20000)
    doc_name: str = Field(max_length=1000)
    breadcrumb: str = Field(default="", max_length=2000)
    page: int | None = None
    page_end: int | None = None
    edition: str | None = None
    score: float = 0
    support_line: str = "L2"


class AiContextCard(BaseModel):
    user_query: str = Field(max_length=10000)
    classified_line: Literal["L1", "L2", "L3", "OUT_OF_SCOPE"]
    confidence: float = Field(ge=0, le=1)
    topic: str
    subtopic: str | None = None
    bot_answer: str | None = None
    sources_found: list[dict] = Field(default_factory=list, max_length=30)
    escalation_reason: str | None = None


class AiAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=20000)
    sources: list[str] = Field(default_factory=list, max_length=30)
    status: Literal["AUTO_RESOLVED", "ESCALATED", "OUT_OF_SCOPE"] = "AUTO_RESOLVED"
    route: AiRoute | None = None
    citations: list[AiCitation] = Field(default_factory=list, max_length=30)
    context_card: AiContextCard | None = None

    @model_validator(mode="after")
    def valid_escalation(self):
        if self.status == "ESCALATED" and (self.route is None or self.route.line == "OUT_OF_SCOPE"):
            raise ValueError("Escalation requires a support line")
        return self
