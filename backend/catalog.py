"""Read-only access to the Fall 2026 Yale SOM course catalog in data/yale_som.db.

The courses table is small (234 sections), so it is loaded into memory once and
searched in Python. Each row is one section; rows that share a course number and
title are grouped into one Course with several sections.
"""

from __future__ import annotations

import re
import sqlite3
import unicodedata
from collections import Counter
from pathlib import Path

from pydantic import BaseModel

DAY_ALIASES = {
    "m": "M", "mo": "M", "mon": "M", "monday": "M",
    "t": "T", "tu": "T", "tue": "T", "tues": "T", "tuesday": "T",
    "w": "W", "we": "W", "wed": "W", "wednesday": "W",
    "th": "Th", "thu": "Th", "thur": "Th", "thurs": "Th", "thursday": "Th",
    "f": "F", "fr": "F", "fri": "F", "friday": "F",
}
STOPWORDS = {
    "a", "an", "and", "any", "are", "about", "class", "classes", "course", "courses", "do",
    "for", "in", "is", "of", "on", "or", "som", "that", "the", "to", "what", "which", "with", "yale",
}
SNIPPET_CHARS = 280


class Section(BaseModel):
    section: str
    instructor: str | None
    session: str
    days_times: str | None
    room: str | None


class Course(BaseModel):
    course_number: str
    title: str
    category: str | None
    units: str
    description: str | None
    syllabus: str | None
    sections: list[Section]


class Professor(BaseModel):
    id: str
    name: str
    bio: str | None
    courses: list[Course]  # only the sections this professor teaches


def clean_text(text: str | None) -> str | None:
    """Undo the hard line wraps in catalog text while keeping paragraph breaks."""
    if not text or not text.strip():
        return None
    paragraphs = re.split(r"\n\s*\n", text.replace("\r\n", "\n"))
    return "\n\n".join(" ".join(p.split()) for p in paragraphs if p.strip())


def display_name(catalog_name: str) -> str:
    """'Zaman, Tauhid' -> 'Tauhid Zaman'."""
    last, _, first = catalog_name.partition(",")
    return f"{first.strip()} {last.strip()}".strip()


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def meeting_days(days_times: str | None) -> set[str]:
    """'M  W 10:05 AM-11:25 AM' -> {'M', 'W'}."""
    days = set()
    for token in (days_times or "").split():
        if any(ch.isdigit() for ch in token):
            break
        days.add(token)
    return days


class Catalog:
    def __init__(self, db_path: Path):
        with sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True) as con:
            con.row_factory = sqlite3.Row
            rows = con.execute("SELECT * FROM courses ORDER BY course_number, course_title, section").fetchall()

        courses: dict[tuple[str, str], Course] = {}
        bios: dict[str, str | None] = {}
        for row in rows:
            instructor = display_name(row["faculty_1"]) if row["faculty_1"] else None
            if instructor and not bios.get(instructor):
                bios[instructor] = clean_text(row["faculty_bio"])
            key = (row["course_number"], row["course_title"])
            if key not in courses:
                courses[key] = Course(
                    course_number=row["course_number"],
                    title=row["course_title"],
                    category=row["course_category"] or None,
                    units=row["units"],
                    description=clean_text(row["course_description"]),
                    syllabus=row["syllabus"] or None,
                    sections=[],
                )
            courses[key].sections.append(
                Section(
                    section=row["section"],
                    instructor=instructor,
                    session=row["course_session"],
                    days_times=" ".join((row["daytimes"] or "").split()) or None,
                    room=row["room"] or None,
                )
            )
        self.courses = list(courses.values())

        self.professors: dict[str, Professor] = {}
        for name in sorted(bios):
            taught = [
                c.model_copy(update={"sections": [s for s in c.sections if s.instructor == name]})
                for c in self.courses
                if any(s.instructor == name for s in c.sections)
            ]
            self.professors[slugify(name)] = Professor(id=slugify(name), name=name, bio=bios[name], courses=taught)

    def search(
        self,
        query: str = "",
        category: str | None = None,
        session: str | None = None,
        day: str | None = None,
        limit: int = 10,
    ) -> list[Course]:
        """Keyword search ranked by where the words match; filters narrow the sections."""
        terms = [t for t in re.findall(r"[a-z0-9&]+", query.lower()) if t not in STOPWORDS]
        day_code = DAY_ALIASES.get(day.strip().lower()) if day else None
        results: list[tuple[int, Course]] = []
        for course in self.courses:
            if category and category.lower() not in (course.category or "").lower():
                continue
            sections = [
                s
                for s in course.sections
                if (not session or s.session == session.lower())
                and (not day_code or day_code in meeting_days(s.days_times))
            ]
            if not sections:
                continue
            score = 0
            if terms:
                fields = [
                    (f"{course.course_number} {course.title}".lower(), 3),
                    ((course.category or "").lower(), 2),
                    (" ".join(s.instructor or "" for s in course.sections).lower(), 2),
                    ((course.description or "").lower(), 1),
                ]
                score = sum(max((w for text, w in fields if term in text), default=0) for term in terms)
                if score == 0:
                    continue
            results.append((score, course.model_copy(update={"sections": sections})))
        results.sort(key=lambda r: -r[0])
        return [c for _, c in results[:limit]]

    def find_course(self, course_number: str) -> list[Course]:
        wanted = " ".join(course_number.upper().split())
        return [c for c in self.courses if c.course_number == wanted]

    def find_professors(self, name: str) -> list[Professor]:
        parts = [p for p in re.findall(r"[a-z]+", name.lower()) if p not in {"prof", "professor", "dr"}]
        return [p for p in self.professors.values() if parts and all(part in p.name.lower() for part in parts)]

    def categories(self) -> dict[str, int]:
        return dict(Counter(c.category or "Uncategorized" for c in self.courses).most_common())


def snippet(course: Course) -> Course:
    """Shorten the description so search results stay small."""
    text = course.description
    if text and len(text) > SNIPPET_CHARS:
        text = text[:SNIPPET_CHARS].rsplit(" ", 1)[0] + "..."
    return course.model_copy(update={"description": text})
