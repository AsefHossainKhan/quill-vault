"""Template CRUD endpoints."""

import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from src.api.deps import CurrentUser, DB
from src.models.template import Template
from src.schemas.template import TemplateCreate, TemplateUpdate

router = APIRouter()


@router.get("")
async def list_templates(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Template).where(
            (Template.user_id == None) | (Template.user_id == current_user.id)  # noqa: E711
        ).order_by(Template.is_builtin.desc(), Template.name)
    )
    templates = result.scalars().all()
    return templates


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_template(body: TemplateCreate, db: DB, current_user: CurrentUser):
    template = Template(
        user_id=current_user.id,
        name=body.name,
        icon=body.icon,
        category=body.category,
        system_prompt=body.system_prompt,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.put("/{template_id}")
async def update_template(
    template_id: uuid.UUID,
    body: TemplateUpdate,
    db: DB,
    current_user: CurrentUser,
):
    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot modify built-in template")
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if body.name is not None:
        template.name = body.name
    if body.icon is not None:
        template.icon = body.icon
    if body.category is not None:
        template.category = body.category
    if body.system_prompt is not None:
        template.system_prompt = body.system_prompt

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: DB,
    current_user: CurrentUser,
):
    template = await db.get(Template, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot delete built-in template")
    if template.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    await db.delete(template)
    await db.commit()
