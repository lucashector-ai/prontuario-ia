
import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

const WPP_TOKEN = process.env.WHATSAPP_TOKEN || ""
const WPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || ""

async function enviarWpp(para: string, texto: string) {
  if (!WPP_TOKEN || !WPP_PHONE_ID) return { ok: false, motivo: "sem credenciais" }
  const r = await fetch("https://graph.facebook.com/v20.0/" + WPP_PHONE_ID + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + WPP_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: para, type: "text", text: { body: texto } }),
  })
  return r.json()
}

export async function POST(req: NextRequest) {
  try {
    const { agendamento_id, medico_id } = await req.json()

    const { data: ag } = await supabase
      .from("agendamentos")
      .select("*, pacientes(nome, telefone)")
      .eq("id", agendamento_id)
      .single()

    if (!ag) return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 })

    const pac = (ag as any).pacientes
    if (!pac?.telefone) return NextResponse.json({ error: "Paciente sem telefone cadastrado" }, { status: 400 })

    const { data: medico } = await supabase.from("medicos").select("nome, especialidade").eq("id", medico_id).single()

    const dataFmt = new Date((ag as any).data_hora).toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
    })

    const msg = [
      `Olá, ${pac.nome}! 👋`,
      ``,
      `Sua consulta com *${(medico as any)?.nome || "o médico"}* está confirmada para *${dataFmt}*.`,
      ``,
      `Para otimizar seu atendimento, precisamos de algumas informações antes da consulta:`,
      ``,
      `*1.* Qual é sua queixa principal hoje?`,
      `*2.* Há quanto tempo está com esse problema?`,
      `*3.* Está tomando algum medicamento atualmente?`,
      `*4.* Tem alergia a algum medicamento?`,
      `*5.* Algo mais que gostaria que o médico soubesse?`,
      ``,
      `Responda essa mensagem com suas respostas. Isso ajuda o médico a se preparar melhor para o seu atendimento. 🩺`,
    ].join("\n")

    const tel = pac.telefone.replace(/[^0-9]/g, "")
    const wppResult = await enviarWpp(tel, msg)

    await supabase.from("agendamentos")
      .update({ pre_consulta_enviada: true })
      .eq("id", agendamento_id)

    const { data: conversa } = await supabase.from("whatsapp_conversas")
      .select("id").eq("telefone", tel).eq("medico_id", medico_id).maybeSingle()

    if (conversa) {
      await supabase.from("whatsapp_mensagens").insert({
        conversa_id: (conversa as any).id, tipo: "enviada", conteudo: msg,
        metadata: { tipo: "pre_consulta", agendamento_id },
      })
    }

    return NextResponse.json({ ok: true, telefone: tel, wpp: wppResult })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const agendamentoId = req.nextUrl.searchParams.get("agendamento_id")
  if (!agendamentoId) return NextResponse.json({ contexto: null })

  const { data: ag } = await supabase
    .from("agendamentos")
    .select("pre_consulta_contexto, pre_consulta_enviada")
    .eq("id", agendamentoId)
    .single()

  return NextResponse.json({ contexto: (ag as any)?.pre_consulta_contexto || null, enviada: (ag as any)?.pre_consulta_enviada || false })
}
