"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: string;
  success?: string;
};

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getPassword(formData: FormData) {
  const value = formData.get("password");
  return typeof value === "string" ? value : "";
}

function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return null;
  }

  try {
    const parsed = new URL(siteUrl);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export async function signUp(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!getSupabaseConfig()) {
    return {
      error: "O cadastro ainda não está disponível. Configure o Supabase no servidor.",
    };
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl) {
    return {
      error: "Configure NEXT_PUBLIC_SITE_URL com o endereço deste aplicativo.",
    };
  }

  const email = getString(formData, "email");
  const password = getPassword(formData);
  if (!email || password.length < 10) {
    return {
      error: "Informe um e-mail válido e uma senha com pelo menos 10 caracteres.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=%2Fperfil`,
    },
  });

  if (error) {
    console.error("PartyUp sign-up failed:", error.code ?? "unknown");
    return {
      error:
        "Não foi possível criar a conta. Confira os dados e tente novamente.",
    };
  }

  if (data.session) {
    redirect("/perfil");
  }

  return {
    success:
      "Conta criada. Confira seu e-mail para confirmar o endereço e acessar seu perfil.",
  };
}

export async function signIn(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!getSupabaseConfig()) {
    return {
      error: "O login ainda não está disponível. Configure o Supabase no servidor.",
    };
  }

  const email = getString(formData, "email");
  const password = getPassword(formData);
  if (!email || !password) {
    return { error: "Informe seu e-mail e sua senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("PartyUp sign-in failed:", error.code ?? "unknown");
    return { error: "Não foi possível entrar. Confira seus dados e tente novamente." };
  }

  redirect("/perfil");
}

export async function signInWithProvider(formData: FormData) {
  const provider = formData.get("provider");
  if (provider !== "google" && provider !== "facebook" && provider !== "x") {
    redirect("/entrar?erro=provedor");
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl || !getSupabaseConfig()) {
    redirect("/entrar?erro=provedor");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=%2Fperfil`,
    },
  });

  if (error) {
    console.error("PartyUp OAuth sign-in failed:", error.code ?? "unknown");
    redirect("/entrar?erro=provedor");
  }
  if (!data.url) {
    throw new Error("Supabase did not return an OAuth authorization URL.");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveProfile(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("PartyUp profile session lookup failed:", userError.code ?? "unknown");
    return { error: "Sua sessão expirou. Entre novamente para salvar o perfil." };
  }
  if (!user) {
    return { error: "Sua sessão expirou. Entre novamente para salvar o perfil." };
  }

  const displayName = getString(formData, "displayName");
  const bio = getString(formData, "bio");
  const timezone = getString(formData, "timezone");
  const preferredLanguage = getString(formData, "preferredLanguage");
  const playStyle = getString(formData, "playStyle");
  const communicationPreference = getString(formData, "communicationPreference");
  const avatarPath = getString(formData, "avatarPath") || null;
  const showInDiscovery = formData.get("showInDiscovery") === "on";
  const showBioInDiscovery = formData.get("showBioInDiscovery") === "on";
  const submittedPlatforms = formData.getAll("platforms");

  if (displayName.length < 2 || displayName.length > 40) {
    return { error: "Seu nome de jogador deve ter entre 2 e 40 caracteres." };
  }
  if (bio.length > 280) {
    return { error: "A apresentação pode ter no máximo 280 caracteres." };
  }
  if (!["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "UTC"].includes(timezone)) {
    return { error: "Selecione um fuso horário válido." };
  }
  if (!["pt-BR", "en", "es"].includes(preferredLanguage)) {
    return { error: "Selecione um idioma válido." };
  }
  if (
    !["", "casual", "competitive", "cooperative", "social"].includes(playStyle)
  ) {
    return { error: "Selecione um estilo de jogo válido." };
  }
  if (!["", "voice", "text", "any"].includes(communicationPreference)) {
    return { error: "Selecione uma preferência de comunicação válida." };
  }

  if (submittedPlatforms.some((platform) => typeof platform !== "string")) {
    return { error: "A seleção de plataformas enviada é inválida." };
  }
  const platformSlugs = [
    ...new Set(
      submittedPlatforms
        .filter((platform): platform is string => typeof platform === "string")
        .map((platform) => platform.trim()),
    ),
  ];
  if (
    platformSlugs.length > 5 ||
    platformSlugs.some(
      (slug) =>
        slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
    )
  ) {
    return { error: "Selecione até 5 plataformas válidas." };
  }
  if (avatarPath && avatarPath !== `${user.id}/avatar`) {
    return { error: "A foto de perfil enviada é inválida." };
  }

  const { error } = await supabase.rpc("save_current_user_profile", {
    p_display_name: displayName,
    p_bio: bio || null,
    p_timezone: timezone,
    p_preferred_language: preferredLanguage,
    p_play_style: playStyle || null,
    p_communication_preference: communicationPreference || null,
    p_avatar_path: avatarPath,
    p_show_in_discovery: showInDiscovery,
    p_platform_slugs: platformSlugs,
    p_show_bio: showBioInDiscovery,
  });

  if (error) {
    console.error("PartyUp profile save failed:", error.code ?? "unknown");
    return {
      error: "Não foi possível salvar seu perfil. Tente novamente em instantes.",
    };
  }

  revalidatePath("/perfil");
  revalidatePath("/jogadores");
  redirect("/perfil?perfil_salvo=1");
}

export async function saveProfileGames(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("PartyUp profile games session lookup failed:", userError.code ?? "unknown");
    return { error: "Sua sessão expirou. Entre novamente para salvar seus jogos." };
  }
  if (!user) {
    return { error: "Sua sessão expirou. Entre novamente para salvar seus jogos." };
  }

  const submittedGames = formData.getAll("games");
  if (submittedGames.some((game) => typeof game !== "string")) {
    return { error: "A seleção de jogos enviada é inválida." };
  }

  const gameSlugs = [
    ...new Set(
      submittedGames
        .filter((game): game is string => typeof game === "string")
        .map((game) => game.trim()),
    ),
  ];

  if (
    gameSlugs.length > 20 ||
    gameSlugs.some(
      (slug) =>
        slug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
    )
  ) {
    return { error: "Selecione até 20 jogos válidos do catálogo." };
  }

  const { error } = await supabase.rpc("replace_current_user_games", {
    p_game_slugs: gameSlugs,
  });

  if (error) {
    console.error("PartyUp profile games save failed:", error.code ?? "unknown");
    return {
      error: "Não foi possível salvar seus jogos. Tente novamente em instantes.",
    };
  }

  revalidatePath("/perfil");
  redirect("/perfil?jogos_salvos=1");
}
