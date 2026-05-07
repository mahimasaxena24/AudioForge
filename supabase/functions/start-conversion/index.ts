import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { bookId } = await req.json();
    if (!bookId) {
      return new Response(JSON.stringify({ error: "bookId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all pending chapters for this book
    const { data: chapters, error } = await supabase
      .from("chapters")
      .select("id")
      .eq("book_id", bookId)
      .eq("status", "pending")
      .order("chapter_order");

    if (error || !chapters || chapters.length === 0) {
      return new Response(
        JSON.stringify({ error: "No pending chapters found. Extract text first." }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update book to processing
    await supabase
      .from("books")
      .update({ status: "processing", progress: 70 })
      .eq("id", bookId);

    // Convert each chapter sequentially by calling the convert-chapter function
    const results = [];
    for (const chapter of chapters) {
      try {
        const response = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/convert-chapter`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ chapterId: chapter.id }),
          }
        );
        const result = await response.json();
        results.push({ chapterId: chapter.id, ...result });
      } catch (err) {
        console.error(`Failed to convert chapter ${chapter.id}:`, err);
        results.push({ chapterId: chapter.id, error: String(err) });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in start-conversion:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
