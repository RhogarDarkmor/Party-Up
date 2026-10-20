"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const gameModes = ["casual", "competitive", "cooperative", "ranked"] as const;
const languages = ["pt-BR", "en", "es"] as const;
const partyIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.name !== "AuthSessionMissingError") {
      console.error("PartyUp party session lookup failed:", error.code ?? "unknown");
    }
    redirect("/entrar");
  }
  if (!user) {
    redirect("/entrar");
  }

  return supabase;
}

export async function createParty(formData: FormData) {
  const gameSlug = getString(formData, "game");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const contactInfo = getString(formData, "contactInfo");
  const gameMode = getString(formData, "mode");
  const startsAt = getString(formData, "startsAt");
  const language = getString(formData, "language");
  const maxPlayers = Number(getString(formData, "maxPlayers"));

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameSlug) ||
    title.length < 3 ||
    title.length > 80 ||
    description.length > 500 ||
    contactInfo.length > 200 ||
    !gameModes.includes(gameMode as (typeof gameModes)[number]) ||
    !languages.includes(language as (typeof languages)[number]) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) ||
    !Number.isFinite(Date.parse(`${startsAt}:00Z`)) ||
    !Number.isInteger(maxPlayers) ||
    maxPlayers < 2 ||
    maxPlayers > 8
  ) {
    redirect("/parties/nova?erro=invalid");
  }

  const supabase = await getAuthenticatedClient();
  const { error } = await supabase.rpc("create_party", {
    p_game_slug: gameSlug,
    p_title: title,
    p_description: description || null,
    p_contact_info: contactInfo || null,
    p_game_mode: gameMode,
    p_starts_at: `${startsAt}:00`,
    p_language: language,
    p_max_players: maxPlayers,
  });

  if (error) {
    console.error("PartyUp party creation failed:", error.code ?? "unknown");
    redirect("/parties/nova?erro=save");
  }

  revalidatePath("/parties");
  revalidatePath("/perfil");
  redirect("/parties?criada=1");
}

export async function joinParty(formData: FormData) {
  const partyId = getString(formData, "partyId");
  if (!partyIdPattern.test(partyId)) {
    redirect("/parties?erro=invalid");
  }

  const supabase = await getAuthenticatedClient();
  const { error } = await supabase.rpc("join_party", { p_party_id: partyId });
  if (error) {
    console.error("PartyUp party join failed:", error.code ?? "unknown");
    redirect("/parties?erro=join");
  }

  revalidatePath("/parties");
  revalidatePath("/perfil");
  redirect("/parties?entrou=1");
}

export async function leaveParty(formData: FormData) {
  const partyId = getString(formData, "partyId");
  if (!partyIdPattern.test(partyId)) {
    redirect("/parties?erro=invalid");
  }

  const supabase = await getAuthenticatedClient();
  const { error } = await supabase.rpc("leave_party", { p_party_id: partyId });
  if (error) {
    console.error("PartyUp party leave failed:", error.code ?? "unknown");
    redirect("/parties?erro=leave");
  }

  revalidatePath("/parties");
  revalidatePath("/perfil");
  redirect("/parties?saiu=1");
}

export async function cancelParty(formData: FormData) {
  const partyId = getString(formData, "partyId");
  if (!partyIdPattern.test(partyId)) {
    redirect("/parties?erro=invalid");
  }

  const supabase = await getAuthenticatedClient();
  const { error } = await supabase.rpc("cancel_party", { p_party_id: partyId });
  if (error) {
    console.error("PartyUp party cancellation failed:", error.code ?? "unknown");
    redirect("/parties?erro=cancel");
  }

  revalidatePath("/parties");
  revalidatePath("/perfil");
  redirect("/parties?cancelada=1");
}
