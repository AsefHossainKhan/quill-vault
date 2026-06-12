"""Seed built-in templates and test users into the database."""

import asyncio
import uuid

from sqlalchemy import text

from src.db.session import engine
from src.utils.security import hash_password

BUILTIN_TEMPLATES = [
    {
        "name": "Meeting Minutes",
        "icon": "📋",
        "category": "Meeting",
        "system_prompt": (
            "Generate structured meeting minutes from this transcript. "
            "Include: date/participants (if mentioned), agenda items, key discussion points, "
            "decisions made, and action items with owners and due dates. "
            "Format as clean markdown with headers."
        ),
        "is_builtin": True,
    },
    {
        "name": "Summary",
        "icon": "📝",
        "category": "General",
        "system_prompt": (
            "Write a concise executive summary of this conversation. "
            "Cover: main topics discussed, key outcomes, and any open questions. "
            "Target length: 3–5 paragraphs."
        ),
        "is_builtin": True,
    },
    {
        "name": "Action Items",
        "icon": "✅",
        "category": "Meeting",
        "system_prompt": (
            "Extract all action items from this transcript. "
            "For each item include: task description, owner (if mentioned), deadline (if mentioned). "
            "Format as a checklist in markdown."
        ),
        "is_builtin": True,
    },
    {
        "name": "Email Draft",
        "icon": "📧",
        "category": "Communication",
        "system_prompt": (
            "Write a professional follow-up email summarizing this meeting. "
            "Include: brief recap, decisions made, action items, and next steps. "
            "Use a friendly but professional tone."
        ),
        "is_builtin": True,
    },
]


async def seed():
    # ── Seed templates ───────────────────────────────────────────────
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM templates"))
        count = result.scalar()
        if count and count >= len(BUILTIN_TEMPLATES):
            print(f"  Already have {count} templates, skipping template seed.")
        else:
            for tmpl in BUILTIN_TEMPLATES:
                await conn.execute(
                    text(
                        "INSERT INTO templates (id, name, icon, category, system_prompt, is_builtin, created_at, updated_at) "
                        "VALUES (:id, :name, :icon, :category, :system_prompt, :is_builtin, NOW(), NOW()) "
                        "ON CONFLICT (id) DO NOTHING"
                    ),
                    {"id": str(uuid.uuid4()), **tmpl},
                )
                print(f"  Created template: {tmpl['icon']} {tmpl['name']}")

    # ── Seed test users ──────────────────────────────────────────────
    test_users = [
        {"username": "user1", "email": "user1@u.com", "password": "123qwe", "full_name": "User One"},
        {"username": "user2", "email": "user2@u.com", "password": "123qwe", "full_name": "User Two"},
        {"username": "user3", "email": "user3@u.com", "password": "123qwe", "full_name": "User Three"},
    ]

    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        if user_count and user_count >= len(test_users):
            print(f"  Already have {user_count} users, skipping user seed.")
        else:
            for u in test_users:
                await conn.execute(
                    text(
                        "INSERT INTO users (id, username, email, full_name, hashed_password, is_active, created_at, updated_at) "
                        "VALUES (:id, :username, :email, :full_name, :hashed_password, TRUE, NOW(), NOW()) "
                        "ON CONFLICT (email) DO NOTHING"
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "username": u["username"],
                        "email": u["email"],
                        "full_name": u["full_name"],
                        "hashed_password": hash_password(u["password"]),
                    },
                )
                print(f"  Created user: {u['email']} / {u['password']}")

    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
