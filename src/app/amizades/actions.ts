"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const playerIdPattern =
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
      console.error("PartyUp friendship session lookup failed:", error.code ?? "unknown");
    }
    redirect("/entrar");
  }
  if (!user) {
    redirect("/entrar");
  }

  return supabase;
}

export async function sendFriendRequest(formData: FormData) {
  const playerId = getString(formData, "playerId");
  if (!playerIdPattern.test(playerId)) {
    redirect("/jogadores?amizade=erro");
  }

  const supabase = await getAuthenticatedClient();
  const { error } = await supabase.rpc("send_friend_request", {
    p_player_id: playerId,
  });

  if (error) {
    console.error("PartyUp friend request creation failed:", error.code ?? "unknown");
    redirect(`/jogadores/${playerId}?amizade=erro`);
  }

  revalidatePath("/amizades");
  revalidatePath(`/jogadores/${playerId}`);
  redirect(`/jogadores/${playerId}?amizade=enviado`);
}

export async function respondToFriendRequest(formData: FormData) {
  const playerId = getString(formData, "playerId");
  const response = getString(formData, "response");
  if (!playerIdPattern.test(playerId) || !["aceitar", "recusar"].includes(response)) {
    redirect("/amizades?amizade=erro");
  }

  const supabase = await getAuthenticatedClient();
  const accepted = response === "aceitar";
  const { error } = await supabase.rpc("respond_to_friend_request", {
    p_player_id: playerId,
    p_accept: accepted,
  });

  if (error) {
    console.error("PartyUp friend request response failed:", error.code ?? "unknown");
    redirect("/amizades?amizade=erro");
  }

  revalidatePath("/amizades");
  revalidatePath(`/jogadores/${playerId}`);
  redirect(`/amizades?amizade=${accepted ? "aceito" : "recusado"}`);
}
