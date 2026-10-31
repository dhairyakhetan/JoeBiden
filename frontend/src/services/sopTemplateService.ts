import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * sopTemplateService - the `sop_templates` copy-to-clipboard WhatsApp script
 * browser (handoff/20-sops-and-todos.md §4.5). Deliberately separate from
 * sopService.ts (see that file's own header) - a different table, a
 * different desk section, edited by a different (smaller) set of people in
 * practice even though RLS grants both to the same director/super_admin tier.
 *
 * Mirrors the throw-on-error / `{success, data}` shape every other
 * services/*.ts file uses - components own their own toast feedback.
 */

export interface SopTemplate {
  id: number
  departmentSlug: string
  label: string
  body: string
  updatedBy: number | null
  updatedAt: string
}

export interface SopTemplateInput {
  departmentSlug: string
  label: string
  body: string
}

const mapRow = (row: any): SopTemplate => ({
  id: row.id,
  departmentSlug: row.department_slug,
  label: row.label,
  body: row.body,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
})

const sopTemplateServiceImpl = {
  async list() {
    const { data, error } = await supabaseCommunity
      .from('sop_templates')
      .select('*')
      .order('id', { ascending: true })

    if (error) throw logSupabaseError('sopTemplateService.list', error)
    return { success: true, data: (data || []).map(mapRow) }
  },

  async create(input: SopTemplateInput) {
    const { data, error } = await supabaseCommunity
      .from('sop_templates')
      .insert({ department_slug: input.departmentSlug, label: input.label.trim(), body: input.body })
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopTemplateService.create', error)
    return { success: true, data: mapRow(data) }
  },

  async update(id: number, input: SopTemplateInput) {
    const { data, error } = await supabaseCommunity
      .from('sop_templates')
      .update({ department_slug: input.departmentSlug, label: input.label.trim(), body: input.body })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw logSupabaseError('sopTemplateService.update', error)
    return { success: true, data: mapRow(data) }
  },

  async remove(id: number) {
    const { error } = await supabaseCommunity.from('sop_templates').delete().eq('id', id)
    if (error) throw logSupabaseError('sopTemplateService.remove', error)
    return { success: true }
  },
}

export const sopTemplateService = withFunctionLogging('sopTemplateService', sopTemplateServiceImpl)

export default sopTemplateService
