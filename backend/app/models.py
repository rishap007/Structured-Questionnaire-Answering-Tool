from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    questionnaires: Mapped[list["Questionnaire"]] = relationship(back_populates="owner")
    reference_documents: Mapped[list["ReferenceDocument"]] = relationship(back_populates="owner")


class ReferenceDocument(Base):
    __tablename__ = "reference_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    source_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(50))
    content_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped[User] = relationship(back_populates="reference_documents")
    chunks: Mapped[list["ReferenceChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")


class ReferenceChunk(Base):
    __tablename__ = "reference_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("reference_documents.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)
    section_title: Mapped[str] = mapped_column(String(255), default="General")
    chunk_text: Mapped[str] = mapped_column(Text)
    vector_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    document: Mapped[ReferenceDocument] = relationship(back_populates="chunks")


class Questionnaire(Base):
    __tablename__ = "questionnaires"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    source_filename: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    owner: Mapped[User] = relationship(back_populates="questionnaires")
    questions: Mapped[list["Question"]] = relationship(back_populates="questionnaire", cascade="all, delete-orphan")
    generation_runs: Mapped[list["GenerationRun"]] = relationship(back_populates="questionnaire", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    questionnaire_id: Mapped[int] = mapped_column(ForeignKey("questionnaires.id"), index=True)
    question_uid: Mapped[str] = mapped_column(String(50), index=True)
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    questionnaire: Mapped[Questionnaire] = relationship(back_populates="questions")
    generated_answer: Mapped["GeneratedAnswer"] = relationship(back_populates="question", uselist=False, cascade="all, delete-orphan")
    run_answers: Mapped[list["RunAnswer"]] = relationship(back_populates="question", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("questionnaire_id", "position", name="uq_questionnaire_position"),)


class GeneratedAnswer(Base):
    __tablename__ = "generated_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), unique=True, index=True)
    answer_text: Mapped[str] = mapped_column(Text)
    citations: Mapped[str] = mapped_column(Text, default="")
    evidence_snippets: Mapped[str] = mapped_column(Text, default="[]")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    avg_similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    question: Mapped[Question] = relationship(back_populates="generated_answer")
    edits: Mapped[list["EditedAnswer"]] = relationship(back_populates="generated_answer", cascade="all, delete-orphan")


class EditedAnswer(Base):
    __tablename__ = "edited_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    generated_answer_id: Mapped[int] = mapped_column(ForeignKey("generated_answers.id"), index=True)
    edited_text: Mapped[str] = mapped_column(Text)
    edited_citations: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    generated_answer: Mapped[GeneratedAnswer] = relationship(back_populates="edits")


class GenerationRun(Base):
    __tablename__ = "generation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    questionnaire_id: Mapped[int] = mapped_column(ForeignKey("questionnaires.id"), index=True)
    run_number: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    questionnaire: Mapped[Questionnaire] = relationship(back_populates="generation_runs")
    answers: Mapped[list["RunAnswer"]] = relationship(back_populates="run", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("questionnaire_id", "run_number", name="uq_questionnaire_run_number"),)


class RunAnswer(Base):
    __tablename__ = "run_answers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("generation_runs.id"), index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    answer_text: Mapped[str] = mapped_column(Text)
    citations: Mapped[str] = mapped_column(Text, default="")
    evidence_snippets: Mapped[str] = mapped_column(Text, default="[]")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    avg_similarity_score: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    run: Mapped[GenerationRun] = relationship(back_populates="answers")
    question: Mapped[Question] = relationship(back_populates="run_answers")

    __table_args__ = (UniqueConstraint("run_id", "question_id", name="uq_run_question"),)
