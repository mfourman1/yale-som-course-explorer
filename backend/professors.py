"""One PydanticAI agent per professor in the course catalog.

Each agent's instructions are built from the database (bio, courses, sections, schedule,
syllabus) plus a speaking style from styles.py. All agents share tools that search the
whole catalog, so a professor can answer questions about other classes too.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

from catalog import Catalog, Course, Professor, snippet
from styles import DEFAULT_STYLE, STYLES

BACKEND_DIR = Path(__file__).resolve().parent
# Nearest .env wins: backend/, the repo, then the folders above it (up to MGT 409 E).
for folder in (BACKEND_DIR, *BACKEND_DIR.parents[:3]):
    load_dotenv(folder / ".env")
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

PORTKEY_BASE_URL = "https://api.portkey.ai/v1"
DEFAULT_MODEL = "gpt-6-luna"
DB_PATH = Path(os.getenv("COURSE_DB_PATH", BACKEND_DIR.parent / "data" / "yale_som.db"))
TERM = "Fall 2026"


def model_name() -> str:
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL)


def make_model() -> OpenAIResponsesModel:
    """Model routed through Portkey; the name comes from OPENAI_MODEL.

    Uses the Responses API: gpt-6-luna rejects function tools on /v1/chat/completions.
    """
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("Missing PORTKEY_API_KEY. Add it to a .env file or the environment.")
    client = AsyncOpenAI(base_url=PORTKEY_BASE_URL, api_key=api_key)
    return OpenAIResponsesModel(model_name(), provider=OpenAIProvider(openai_client=client))


def style_for(professor_id: str) -> str:
    return STYLES.get(professor_id, DEFAULT_STYLE)


def describe_course(course: Course) -> str:
    lines = [f"- {course.course_number} {course.title} ({course.units} units, {course.category or 'no category'})"]
    for s in course.sections:
        when = s.days_times or "time TBA"
        lines.append(f"  - Section {s.section}, {s.session}: {when}, {s.room or 'room TBA'}")
    if course.syllabus:
        lines.append(f"  - Syllabus: {course.syllabus}")
    if course.description:
        lines.append(f"  - Description: {course.description}")
    return "\n".join(lines)


def build_instructions(professor: Professor) -> str:
    courses = "\n".join(describe_course(c) for c in professor.courses)
    return f"""You are an AI version of Professor {professor.name} of the Yale School of Management, \
talking with students inside a virtual Evans Hall.

## Who you are (from the SOM faculty bio)
{professor.bio or "No bio is on file."}

## What you teach in {TERM}
Session codes: "fall" runs the full term, "fall-1" the first half, "fall-2" the second half.
{courses}

## How you talk
{style_for(professor.id)}

## What you know
You are an AI, so beyond your own courses you know the core MBA toolkit and can teach it:
statistics and probability (mean, variance, standard deviation, distributions, the central limit
theorem, sampling, confidence intervals, hypothesis tests, p-values, linear and logistic regression
and how to read their output), economics, accounting, finance, operations, marketing, and AI.
Teach with intuition first, then a small worked example. When you compute numbers, show the steps.

## The course catalog
Your tools search the full {TERM} Yale SOM catalog: every course, section, instructor, schedule,
room, and syllabus link. For any question about a specific course, who teaches what, when or where
a class meets, or which classes cover a topic, call a tool before answering instead of relying on
memory. If the catalog doesn't have the answer, say so.

## Rules
- You are an AI persona built from public course information, not the real professor. If asked, say so.
- Don't invent personal stories, office hours, grading policies, exam dates, or deadlines. Point
  students to the syllabus link or Canvas for those.
- For what looks like graded homework, walk the student through the method instead of handing over
  the final answer.
- Keep replies short and conversational: usually two or three short paragraphs. Use **bold** and
  "- " bullets only; no headings, tables, or LaTeX. Write math in plain text, e.g. σ/√n or y = a + b·x.
"""


async def search_courses(
    ctx: RunContext[Catalog],
    query: str = "",
    category: str | None = None,
    session: str | None = None,
    day: str | None = None,
    limit: int = 10,
) -> list[Course]:
    """Search the course catalog by keywords and optional filters.

    Args:
        query: Keywords matched against course number, title, category, instructor, and
            description, e.g. "regression", "MGT 403", "private equity". Leave empty to list by filters.
        category: Category name or part of it, e.g. "Finance", "Core", "Marketing".
        session: "fall" (full term), "fall-1" (first half), or "fall-2" (second half).
        day: Meeting day such as "Monday", "Tue", or "Th".
        limit: Maximum courses to return (1-40).
    """
    found = ctx.deps.search(query, category, session, day, max(1, min(limit, 40)))
    return [snippet(c) for c in found]


async def get_course(ctx: RunContext[Catalog], course_number: str) -> list[Course] | str:
    """Full details for one course number: description, syllabus, and every section's
    instructor, session, days/times, and room.

    Args:
        course_number: Catalog number such as "MGT 403" or "MGMT 7307".
    """
    return ctx.deps.find_course(course_number) or f"No course numbered {course_number!r} in the catalog."


async def get_professor(ctx: RunContext[Catalog], name: str) -> list[Professor] | str:
    """Bio and courses for any SOM professor in the catalog.

    Args:
        name: Full or partial name, e.g. "Zaman" or "Katja Seim".
    """
    return ctx.deps.find_professors(name) or f"No professor matching {name!r} in the catalog."


async def list_categories(ctx: RunContext[Catalog]) -> dict[str, int]:
    """Every course category in the catalog with how many courses it has."""
    return ctx.deps.categories()


TOOLS = [search_courses, get_course, get_professor, list_categories]

_agents: dict[str, Agent[Catalog, str]] = {}


def agent_for(professor: Professor) -> Agent[Catalog, str]:
    """Build each professor's agent on first use and reuse it afterwards."""
    if professor.id not in _agents:
        _agents[professor.id] = Agent(
            make_model(),
            deps_type=Catalog,
            output_type=str,
            instructions=build_instructions(professor),
            tools=TOOLS,
            name=professor.name,
        )
    return _agents[professor.id]
