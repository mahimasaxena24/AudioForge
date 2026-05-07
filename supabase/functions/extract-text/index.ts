import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText as extractPdfText } from "npm:unpdf@0.12.1";

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

    // Get book record
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (bookError || !book) {
      return new Response(JSON.stringify({ error: "Book not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await supabase
      .from("books")
      .update({ status: "processing", progress: 10 })
      .eq("id", bookId);

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pdfs")
      .download(book.file_path!);

    if (downloadError || !fileData) {
      await supabase
        .from("books")
        .update({ status: "failed", progress: 0 })
        .eq("id", bookId);
      return new Response(
        JSON.stringify({ error: "Failed to download PDF" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("books")
      .update({ progress: 30 })
      .eq("id", bookId);

    // Extract text using unpdf (handles compressed streams properly)
    const arrayBuffer = await fileData.arrayBuffer();
    const pdfResult = await extractPdfText(new Uint8Array(arrayBuffer), { mergePages: true });
    const text = pdfResult.text || "";

    if (!text || text.trim().length < 10) {
      await supabase
        .from("books")
        .update({ status: "failed", progress: 0 })
        .eq("id", bookId);
      return new Response(
        JSON.stringify({ error: "Could not extract text from PDF. The PDF may be scanned/image-based and requires OCR." }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabase
      .from("books")
      .update({ progress: 50 })
      .eq("id", bookId);

    // Clean text
    const cleanedText = cleanText(text);

    // Detect chapters
    const chapters = detectChapters(cleanedText);

    await supabase
      .from("books")
      .update({ progress: 60, extracted_text: cleanedText })
      .eq("id", bookId);

    // Insert chapters
    const chapterRows = chapters.map((ch, i) => ({
      book_id: bookId,
      title: ch.title,
      text_content: ch.content,
      chapter_order: i,
      status: "pending",
    }));

    await supabase.from("chapters").insert(chapterRows);

    await supabase
      .from("books")
      .update({ progress: 70 })
      .eq("id", bookId);

    return new Response(
      JSON.stringify({
        success: true,
        chaptersCount: chapters.length,
        textLength: cleanedText.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in extract-text:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ChapterData {
  title: string;
  content: string;
}

function detectChapters(text: string): ChapterData[] {
  // Try to split by chapter patterns
  const chapterRegex = /(?:chapter|ch\.?)\s*(\d+)[:\s.-]*(.*?)(?=(?:chapter|ch\.?)\s*\d+|$)/gis;
  const chapters: ChapterData[] = [];
  let match;

  while ((match = chapterRegex.exec(text)) !== null) {
    const num = match[1];
    const rest = match[2]?.trim() || "";
    const titleEnd = rest.indexOf("\n");
    const title = titleEnd > 0 && titleEnd < 100
      ? `Chapter ${num}: ${rest.substring(0, titleEnd).trim()}`
      : `Chapter ${num}`;
    const content = titleEnd > 0 ? rest.substring(titleEnd + 1).trim() : rest;
    if (content.length > 10) {
      chapters.push({ title, content });
    }
  }

  // If no chapters detected, split into ~500 word sections
  if (chapters.length === 0) {
    const words = text.split(/\s+/);
    const chunkSize = 500;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(" ");
      if (chunk.trim().length > 20) {
        chapters.push({
          title: `Section ${Math.floor(i / chunkSize) + 1}`,
          content: chunk.trim(),
        });
      }
    }
  }

  return chapters.length > 0
    ? chapters
    : [{ title: "Full Text", content: text }];
}
