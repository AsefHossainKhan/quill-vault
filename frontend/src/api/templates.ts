import { apiClient } from './client'
import type { Template } from '../types/api'

export interface CreateTemplatePayload {
  name: string
  icon?: string
  category?: string
  system_prompt: string
}

export interface UpdateTemplatePayload {
  name?: string
  icon?: string
  category?: string
  system_prompt?: string
}

/** List all templates (built-in + user's custom) */
export async function listTemplates(): Promise<Template[]> {
  const { data } = await apiClient.get<Template[]>('/templates')
  return data
}

/** Create a new custom template */
export async function createTemplate(
  payload: CreateTemplatePayload,
): Promise<Template> {
  const { data } = await apiClient.post<Template>('/templates', payload)
  return data
}

/** Update an existing template */
export async function updateTemplate(
  templateId: string,
  payload: UpdateTemplatePayload,
): Promise<Template> {
  const { data } = await apiClient.put<Template>(
    `/templates/${templateId}`,
    payload,
  )
  return data
}

/** Delete a custom template */
export async function deleteTemplate(templateId: string): Promise<void> {
  await apiClient.delete(`/templates/${templateId}`)
}
