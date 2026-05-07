import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FileText, Loader2, Mic2, Upload, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchVoices, uploadBook } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

const UploadPage = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: voices = [], isLoading: voicesLoading } = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
  });

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voice_id === selectedVoiceId) || null,
    [selectedVoiceId, voices],
  );

  const handleDrag = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === "dragenter" || event.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile?.type === "application/pdf") {
        setFile(droppedFile);
        if (!title) setTitle(droppedFile.name.replace(".pdf", ""));
      }
    },
    [title],
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) setTitle(selected.name.replace(".pdf", ""));
    }
  };

  const handleSubmit = async () => {
    if (!file || !title || !selectedVoice) return;
    setIsUploading(true);

    try {
      await uploadBook(file, title, author, selectedVoice.voice_id, selectedVoice.name);
      toast({
        title: "Book queued",
        description: `"${title}" will be narrated using ${selectedVoice.name}.`,
      });
      navigate("/status");
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-foreground">Upload Book</h1>
        <p className="mt-1 text-muted-foreground">Admins can upload PDFs and send them straight into the conversion queue.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display">Upload PDF</CardTitle>
              <CardDescription>Drag and drop or click to select a PDF file</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-all ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : file
                      ? "border-success bg-success/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
                onClick={() => !isUploading && document.getElementById("file-input")?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />
                {file ? (
                  <>
                    <FileText className="mb-3 h-12 w-12 text-success" />
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="font-medium text-foreground">Drop your PDF here</p>
                    <p className="mt-1 text-sm text-muted-foreground">or click to browse files</p>
                  </>
                )}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="title">Book Title</Label>
                  <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Enter title" className="mt-1.5" disabled={isUploading} />
                </div>
                <div>
                  <Label htmlFor="author">Author</Label>
                  <Input id="author" value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Enter author name" className="mt-1.5" disabled={isUploading} />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-border/70 bg-muted/40 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Mic2 className="h-4 w-4 text-primary" />
                  ElevenLabs Voice
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Selecting a voice is mandatory before conversion starts.</p>
                <select
                  className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedVoiceId}
                  onChange={(event) => setSelectedVoiceId(event.target.value)}
                  disabled={isUploading || voicesLoading}
                >
                  <option value="">{voicesLoading ? "Loading voices..." : "Select a voice"}</option>
                  {voices.map((voice) => (
                    <option key={voice.voice_id} value={voice.voice_id}>
                      {voice.name}{voice.category ? ` (${voice.category})` : ""}
                    </option>
                  ))}
                </select>
                {selectedVoice && (
                  <p className="mt-2 text-xs text-muted-foreground">Selected voice: <span className="font-medium text-foreground">{selectedVoice.name}</span></p>
                )}
              </div>

              <Button onClick={handleSubmit} disabled={!file || !title || !selectedVoice || isUploading} className="mt-6 w-full" size="lg">
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Queuing conversion...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" /> Upload and Start Conversion
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-base font-display">Admin Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { step: "1", label: "Queue Upload", desc: "Book enters the live processing queue" },
                { step: "2", label: "Extract Text", desc: "The backend triggers PDF parsing" },
                { step: "3", label: "Detect Chapters", desc: "Sections are split for narration" },
                { step: "4", label: "Generate Audio", desc: "AI voices create chapter audio" },
                { step: "5", label: "Monitor Status", desc: "Track progress from the admin dashboard" },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card gradient-accent p-5">
            <BookOpen className="mb-2 h-8 w-8 text-accent-foreground" />
            <p className="font-display font-semibold text-accent-foreground">Role-Protected Uploads</p>
            <p className="mt-1 text-sm text-accent-foreground/80">Only admins can upload or manage books. Listener accounts stay focused on playback.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
