import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chapterId } = await req.json();
    if (!chapterId) {
      return new Response(JSON.stringify({ error: "chapterId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get chapter
    const { data: chapter, error: chErr } = await supabase
      .from("chapters")
      .select("*, books(*)")
      .eq("id", chapterId)
      .single();

    if (chErr || !chapter) {
      return new Response(JSON.stringify({ error: "Chapter not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voiceId = chapter.books?.voice_id;

    if (!voiceId) {
      await supabase.from("chapters").update({ status: "failed" }).eq("id", chapterId);
      await supabase.from("books").update({ status: "failed", progress: 0 }).eq("id", chapter.book_id);
      return new Response(JSON.stringify({ error: "No ElevenLabs voice was selected for this book" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!chapter.text_content || chapter.text_content.trim().length < 5) {
      await supabase.from("chapters").update({ status: "failed" }).eq("id", chapterId);
      return new Response(JSON.stringify({ error: "Chapter has no text content" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark chapter as processing
    await supabase.from("chapters").update({ status: "processing" }).eq("id", chapterId);

    // Truncate text for ElevenLabs (max ~5000 chars per request)
    const textToConvert = chapter.text_content.substring(0, 4500);

    // Call ElevenLabs TTS
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: textToConvert,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text();
      console.error("ElevenLabs error:", ttsResponse.status, errBody);
      await supabase.from("chapters").update({ status: "failed" }).eq("id", chapterId);
      return new Response(
        JSON.stringify({ error: `TTS failed: ${ttsResponse.status}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBytes = new Uint8Array(audioBuffer);

    // Upload audio to storage
    const audioPath = `${chapter.book_id}/${chapterId}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("audiobooks")
      .upload(audioPath, audioBytes, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      await supabase.from("chapters").update({ status: "failed" }).eq("id", chapterId);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio file" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Estimate duration (rough: ~150 words per minute)
    const wordCount = textToConvert.split(/\s+/).length;
    const durationMinutes = wordCount / 150;
    const mins = Math.floor(durationMinutes);
    const secs = Math.round((durationMinutes - mins) * 60);
    const durationStr = `${mins}:${secs.toString().padStart(2, "0")}`;

    // Update chapter
    await supabase
      .from("chapters")
      .update({
        status: "completed",
        audio_path: audioPath,
        duration: durationStr,
      })
      .eq("id", chapterId);

    // Check if all chapters for this book are done
    const { data: allChapters } = await supabase
      .from("chapters")
      .select("status")
      .eq("book_id", chapter.book_id);

    const allDone = allChapters?.every((c) => c.status === "completed");
    const anyFailed = allChapters?.some((c) => c.status === "failed");

    if (allDone) {
      await supabase
        .from("books")
        .update({ status: "completed", progress: 100 })
        .eq("id", chapter.book_id);
    } else if (anyFailed) {
      // Keep processing, some failed
      const completedCount = allChapters?.filter((c) => c.status === "completed").length || 0;
      const total = allChapters?.length || 1;
      await supabase
        .from("books")
        .update({ progress: 70 + Math.round((completedCount / total) * 30) })
        .eq("id", chapter.book_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        audioPath,
        duration: durationStr,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in convert-chapter:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
