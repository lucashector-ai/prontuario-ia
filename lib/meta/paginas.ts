import { graph, tokenLongo } from '@/lib/meta/graph'

export type PaginaMeta = {
  id: string; nome: string; foto: string | null
  instagram: { id: string; username: string; foto: string | null } | null
}

/** Busca as páginas do Facebook (e o Instagram ligado a cada uma) do usuário que fez login na Meta. */
export async function buscarPaginas(tokenUsuario: string) {
  const longo = await tokenLongo(tokenUsuario)
  const j = await graph<{ data: any[] }>('me/accounts', {
    token: longo,
    params: { fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}', limit: '100' },
  })
  return (j.data || []).map(p => ({
    id: String(p.id), nome: String(p.name || ''), foto: p.picture?.data?.url || null, token: String(p.access_token || ''),
    instagram: p.instagram_business_account ? {
      id: String(p.instagram_business_account.id), username: String(p.instagram_business_account.username || ''),
      foto: p.instagram_business_account.profile_picture_url || null,
    } : null,
  }))
}
