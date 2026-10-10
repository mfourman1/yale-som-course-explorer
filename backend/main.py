"""FastAPI backend: course catalog endpoints and a chat endpoint per professor agent.

Run from this folder:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_ai.exceptions import AgentRunError, ModelHTTPError, UsageLimitExceeded
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.usage import UsageLimits

from catalog import Catalog, Course, Professor, snippet
from professors import DB_PATH, agent_for, model_name, style_for

log = logging.getLogger("som-backend")

# A normal answer is 1-3 model requests; the caps stop a runaway tool loop.
CHAT_LIMITS = UsageLimits(request_limit=6, tool_calls_limit=8, total_tokens_limit=60_000)
MAX_HISTORY = 20

catalog = Catalog(DB_PATH)
app = FastAPI(title="Yale SOM Course Explorer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ProfessorSummary(BaseModel):
    id: str
    name: str
    courses: list[str]


class ProfessorDetail(Professor):
    style: str


class ChatTurn(BaseModel):
    role: Literal["user", "professor"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatTurn] = Field(default_factory=list)


class ChatReply(BaseModel):
    professor_id: str
    professor: str
    reply: str


def get_professor_or_404(professor_id: str) -> Professor:
    professor = catalog.professors.get(professor_id)
    if not professor:
        raise HTTPException(404, f"No professor with id {professor_id!r}.")
    return professor


def to_messages(history: list[ChatTurn]) -> list[ModelMessage]:
    return [
        ModelRequest(parts=[UserPromptPart(content=t.content)])
        if t.role == "user"
        else ModelResponse(parts=[TextPart(content=t.content)])
        for t in history[-MAX_HISTORY:]
    ]


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": model_name(),
        "professors": len(catalog.professors),
        "courses": len(catalog.courses),
        "api_key_configured": bool(os.getenv("PORTKEY_API_KEY")),
    }


@app.get("/api/professors")
def list_professors() -> list[ProfessorSummary]:
    return [
        ProfessorSummary(id=p.id, name=p.name, courses=[f"{c.course_number} {c.title}" for c in p.courses])
        for p in catalog.professors.values()
    ]


@app.get("/api/professors/{professor_id}")
def professor_detail(professor_id: str) -> ProfessorDetail:
    professor = get_professor_or_404(professor_id)
    return ProfessorDetail(**professor.model_dump(), style=style_for(professor_id))


@app.get("/api/courses")
def search_courses(
    q: str = "",
    category: str | None = None,
    session: Literal["fall", "fall-1", "fall-2"] | None = None,
    day: str | None = None,
    limit: int = Query(25, ge=1, le=200),
) -> list[Course]:
    return [snippet(c) for c in catalog.search(q, category, session, day, limit)]


@app.post("/api/professors/{professor_id}/chat")
async def chat(professor_id: str, body: ChatRequest) -> ChatReply:
    professor = get_professor_or_404(professor_id)
    try:
        agent = agent_for(professor)
    except RuntimeError as exc:  # missing API key
        raise HTTPException(503, str(exc)) from exc
    try:
        result = await agent.run(
            body.message,
            message_history=to_messages(body.history),
            deps=catalog,
            usage_limits=CHAT_LIMITS,
        )
    except UsageLimitExceeded as exc:
        raise HTTPException(502, "The professor got stuck looking things up. Try rephrasing.") from exc
    except (ModelHTTPError, AgentRunError) as exc:
        log.exception("Agent run failed for %s", professor_id)
        raise HTTPException(502, "The AI model is unavailable right now. Try again in a moment.") from exc
    return ChatReply(professor_id=professor.id, professor=professor.name, reply=result.output)
