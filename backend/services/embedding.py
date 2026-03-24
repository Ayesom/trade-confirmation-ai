import json
import os
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any
from pathlib import Path

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "../data/chroma_db")
TEMPLATES_PATH = os.path.join(os.path.dirname(__file__), "../data/sample_trades/templates.json")
COLLECTION_NAME = "trade_confirmations"

_model = None
_client = None
_collection = None


def get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path=CHROMA_PATH)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"}
        )
    return _collection


def template_to_text(template: Dict[str, Any]) -> str:
    """Convert a template dict to a rich text string for embedding."""
    parts = [
        f"Trade Type: {template.get('trade_type_label', '')}",
        f"Counterparty: {template.get('counterparty', '')}",
        f"Jurisdiction: {template.get('jurisdiction', '')}",
        f"Description: {template.get('description', '')}",
    ]
    if template.get("currency_pair"):
        parts.append(f"Currency Pair: {template['currency_pair']}")
    if template.get("reference_entity"):
        parts.append(f"Reference Entity: {template['reference_entity']}")
    if template.get("security_name"):
        parts.append(f"Security: {template['security_name']}")
    if template.get("issuer"):
        parts.append(f"Issuer: {template['issuer']}")
    if template.get("tenor"):
        parts.append(f"Tenor: {template['tenor']}")
    if template.get("floating_rate_benchmark"):
        parts.append(f"Floating Rate: {template['floating_rate_benchmark']}")
    clauses = template.get("clauses", {})
    for k, v in clauses.items():
        parts.append(f"{k.replace('_', ' ').title()}: {v}")
    return ". ".join(parts)


def seed_templates():
    """Seed ChromaDB with templates from JSON file."""
    collection = get_collection()
    model = get_model()

    if collection.count() > 0:
        return {"message": "Templates already seeded", "count": collection.count()}

    with open(TEMPLATES_PATH, "r") as f:
        templates = json.load(f)

    documents = []
    embeddings = []
    metadatas = []
    ids = []

    for t in templates:
        text = template_to_text(t)
        embedding = model.encode(text).tolist()
        documents.append(text)
        embeddings.append(embedding)
        metadatas.append({
            "id": t["id"],
            "trade_type": t["trade_type"],
            "trade_type_label": t["trade_type_label"],
            "counterparty": t.get("counterparty", ""),
            "jurisdiction": t.get("jurisdiction", ""),
            "version": str(t.get("version", "1.0")),
            "template_json": json.dumps(t),
        })
        ids.append(t["id"])

    collection.add(documents=documents, embeddings=embeddings, metadatas=metadatas, ids=ids)
    return {"message": f"Seeded {len(templates)} templates", "count": len(templates)}


def search_templates(query: str, trade_type: str = None, top_k: int = 3) -> List[Dict[str, Any]]:
    """Semantic search for most relevant templates."""
    collection = get_collection()
    model = get_model()

    query_embedding = model.encode(query).tolist()

    where_filter = {"trade_type": trade_type} if trade_type else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    matches = []
    for i in range(len(results["ids"][0])):
        metadata = results["metadatas"][0][i]
        distance = results["distances"][0][i]
        similarity_score = round((1 - distance) * 100, 1)
        template_data = json.loads(metadata["template_json"])
        matches.append({
            "template": template_data,
            "similarity_score": similarity_score,
            "rank": i + 1,
        })

    return matches


def add_template(template: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new template to the vector store."""
    collection = get_collection()
    model = get_model()

    text = template_to_text(template)
    embedding = model.encode(text).tolist()
    template_id = template.get("id", f"TPL-{template.get('trade_type', 'UNK').upper()[:3]}-{collection.count()+1:03d}")

    collection.add(
        documents=[text],
        embeddings=[embedding],
        metadatas=[{
            "id": template_id,
            "trade_type": template.get("trade_type", ""),
            "trade_type_label": template.get("trade_type_label", ""),
            "counterparty": template.get("counterparty", ""),
            "jurisdiction": template.get("jurisdiction", ""),
            "version": str(template.get("version", "1.0")),
            "template_json": json.dumps(template),
        }],
        ids=[template_id],
    )
    return {"id": template_id, "message": "Template added successfully"}


def get_all_templates() -> List[Dict[str, Any]]:
    """Return all templates from the store."""
    collection = get_collection()
    if collection.count() == 0:
        return []
    results = collection.get(include=["metadatas"])
    templates = []
    for meta in results["metadatas"]:
        templates.append(json.loads(meta["template_json"]))
    return templates