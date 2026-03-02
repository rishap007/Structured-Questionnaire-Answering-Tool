from pathlib import Path

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.database import SessionLocal
from app.models import Question, Questionnaire, ReferenceChunk, ReferenceDocument, User
from app.rag.chunker import chunk_document
from app.rag.retriever import retriever


ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "seed_data"


def load_seed(db: Session):
    user = db.query(User).filter(User.email == "admin@aluminatech.com").first()
    if not user:
        user = User(email="admin@aluminatech.com", hashed_password=hash_password("Admin12345"))
        db.add(user)
        db.commit()
        db.refresh(user)

    refs_dir = SEED_DIR / "reference_docs"
    for file in refs_dir.glob("*.txt"):
        exists = db.query(ReferenceDocument).filter(ReferenceDocument.user_id == user.id, ReferenceDocument.source_filename == file.name).first()
        if exists:
            continue
        text = file.read_text(encoding="utf-8")
        doc = ReferenceDocument(
            user_id=user.id,
            name=file.stem.replace("_", " ").title(),
            source_filename=file.name,
            content_type="text/plain",
            content_text=text,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        chunks = chunk_document(text, chunk_size=700, overlap=100)
        payload = []
        for c in chunks:
            vector_id = f"doc-{doc.id}-chunk-{c.chunk_index}"
            db.add(
                ReferenceChunk(
                    document_id=doc.id,
                    chunk_index=c.chunk_index,
                    section_title=c.section_title,
                    chunk_text=c.text,
                    vector_id=vector_id,
                )
            )
            payload.append(
                {
                    "vector_id": vector_id,
                    "document_id": str(doc.id),
                    "document_name": doc.name,
                    "section_title": c.section_title,
                    "chunk_text": c.text,
                }
            )
        db.commit()
        retriever.add_chunks(payload)

    questionnaire_file = SEED_DIR / "questionnaires" / "aluminatech_vendor_security_questionnaire.csv"
    q_exists = db.query(Questionnaire).filter(Questionnaire.user_id == user.id, Questionnaire.source_filename == questionnaire_file.name).first()
    if not q_exists:
        import pandas as pd

        df = pd.read_csv(questionnaire_file)
        questionnaire = Questionnaire(user_id=user.id, name="AluminaTech Vendor Security Questionnaire", source_filename=questionnaire_file.name)
        db.add(questionnaire)
        db.commit()
        db.refresh(questionnaire)

        for idx, row in enumerate(df["Question"].tolist(), start=1):
            db.add(Question(questionnaire_id=questionnaire.id, question_uid=f"Q-{idx:03d}", position=idx, text=row))
        db.commit()


if __name__ == "__main__":
    db = SessionLocal()
    try:
        load_seed(db)
        print("Seed data loaded.")
        print("User: admin@aluminatech.com / Admin12345")
    finally:
        db.close()
