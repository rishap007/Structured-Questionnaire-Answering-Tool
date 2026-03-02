from __future__ import annotations
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: str

    class Config:
        from_attributes = True


class ReferenceDocumentOut(BaseModel):
    id: int
    name: str
    source_filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionnaireOut(BaseModel):
    id: int
    name: str
    source_filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionOut(BaseModel):
    id: int
    question_uid: str
    position: int
    text: str

    class Config:
        from_attributes = True


class AnswerOut(BaseModel):
    generated_answer_id: int
    question_id: int
    question_uid: str
    position: int
    question_text: str
    generated_answer_text: str
    generated_citations: str
    edited_answer_text: Optional[str] = None
    edited_citations: Optional[str] = None
    evidence_snippets: list["EvidenceSnippetOut"]
    confidence_score: float
    confidence_level: str
    avg_similarity_score: float


class CoverageSummary(BaseModel):
    total_questions: int
    answered_with_citations: int
    not_found_count: int


class RunSummaryOut(BaseModel):
    id: int
    run_number: int
    created_at: datetime


class EvidenceSnippetOut(BaseModel):
    citation: str
    snippet_text: str
    similarity: float


class QuestionnaireResultOut(BaseModel):
    questionnaire: QuestionnaireOut
    run: Optional[RunSummaryOut] = None
    summary: CoverageSummary
    answers: list[AnswerOut]


class EditAnswerRequest(BaseModel):
    edited_text: str
    edited_citations: str = ""


class GenerateAnswersRequest(BaseModel):
    question_ids: list[int] = []
    question_uids: list[str] = []


class CompareAnswerOut(BaseModel):
    question_id: int
    question_uid: str
    position: int
    question_text: str
    old_answer_text: str
    new_answer_text: str
    old_confidence_score: float
    new_confidence_score: float
    changed: bool


class CompareRunsOut(BaseModel):
    questionnaire: QuestionnaireOut
    old_run: RunSummaryOut
    new_run: RunSummaryOut
    total_questions: int
    changed_answers: int
    items: list[CompareAnswerOut]
