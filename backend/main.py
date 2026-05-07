import logging
import os
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("audioforge-api")


class Settings:
    def __init__(self) -> None:
        self.supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")
        self.supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.jwt_secret_key = os.getenv("JWT_SECRET_KEY", "dev-secret-key")
        self.jwt_expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))
        self.default_admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@audioforge.com")
        self.default_admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
        self.elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY", "")
        raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:8080")
        self.cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


settings = Settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    created_at: str | None = None
    created_by_admin: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "user"


class ChapterResponse(BaseModel):
    id: str
    book_id: str
    title: str
    text_content: str | None = None
    audio_path: str | None = None
    duration: str | None = None
    status: str
    chapter_order: int
    created_at: str


class BookResponse(BaseModel):
    id: str
    title: str
    author: str
    language: str
    status: str
    progress: int
    extracted_text: str | None = None
    file_path: str | None = None
    total_duration: str | None = None
    file_size: str | None = None
    voice_id: str | None = None
    voice_name: str | None = None
    created_at: str
    updated_at: str


class VoiceOption(BaseModel):
    voice_id: str
    name: str
    preview_url: str | None = None
    category: str | None = None


class BookDetailResponse(BaseModel):
    book: BookResponse
    chapters: list[ChapterResponse]


class DashboardSummary(BaseModel):
    total_books: int
    completed_books: int
    processing_books: int
    queued_books: int
    uploaded_books: int
    failed_books: int
    queue_count: int
    recent_books: list[BookResponse]


class SupabaseService:
    def __init__(self, supabase_url: str, service_key: str) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.service_key = service_key

    @property
    def available(self) -> bool:
        return bool(self.supabase_url and self.service_key)

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
        }
        if extra:
            headers.update(extra)
        return headers

    def _request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json: Any = None, data: Any = None, headers: dict[str, str] | None = None, timeout: int = 60) -> Any:
        if not self.available:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase backend is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
            )

        url = f"{self.supabase_url}{path}"
        response = requests.request(
            method,
            url,
            params=params,
            json=json,
            data=data,
            headers=self._headers(headers),
            timeout=timeout,
        )

        if response.status_code >= 400:
            detail: Any
            try:
                detail = response.json()
            except ValueError:
                detail = response.text
            raise HTTPException(status_code=response.status_code, detail=detail)

        if not response.text:
            return None

        content_type = response.headers.get("content-type", "")
        if "application/json" in content_type:
            return response.json()
        return response.text

    def list_users(self) -> list[dict[str, Any]]:
        data = self._request(
            "GET",
            "/rest/v1/app_users",
            params={"select": "id,name,email,role,created_at,created_by_admin", "order": "created_at.desc"},
        )
        return data or []

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        data = self._request(
            "GET",
            "/rest/v1/app_users",
            params={"select": "*", "email": f"eq.{email.lower()}"},
        )
        return data[0] if data else None

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        data = self._request(
            "GET",
            "/rest/v1/app_users",
            params={"select": "id,name,email,role,created_at,created_by_admin", "id": f"eq.{user_id}"},
        )
        return data[0] if data else None

    def create_user(self, *, name: str, email: str, password_hash: str, role: str, created_by_admin: str | None) -> dict[str, Any]:
        payload = {
            "name": name.strip(),
            "email": email.lower().strip(),
            "password_hash": password_hash,
            "role": role,
            "created_by_admin": created_by_admin,
        }
        data = self._request(
            "POST",
            "/rest/v1/app_users",
            params={"select": "id,name,email,role,created_at,created_by_admin"},
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        return data[0]

    def delete_user(self, user_id: str) -> None:
        self._request(
            "DELETE",
            "/rest/v1/app_users",
            params={"id": f"eq.{user_id}"},
            headers={"Prefer": "return=minimal"},
        )

    def list_books(self) -> list[dict[str, Any]]:
        data = self._request(
            "GET",
            "/rest/v1/books",
            params={"select": "*", "order": "created_at.desc"},
        )
        return data or []

    def get_book(self, book_id: str) -> dict[str, Any] | None:
        data = self._request(
            "GET",
            "/rest/v1/books",
            params={"select": "*", "id": f"eq.{book_id}"},
        )
        return data[0] if data else None

    def get_chapters(self, book_id: str) -> list[dict[str, Any]]:
        data = self._request(
            "GET",
            "/rest/v1/chapters",
            params={"select": "*", "book_id": f"eq.{book_id}", "order": "chapter_order.asc"},
        )
        return data or []

    def create_book(self, *, title: str, author: str, file_path: str, file_size: str, voice_id: str, voice_name: str) -> dict[str, Any]:
        payload = {
            "title": title.strip(),
            "author": author.strip(),
            "file_path": file_path,
            "file_size": file_size,
            "voice_id": voice_id,
            "voice_name": voice_name,
            "status": "queued",
            "progress": 0,
        }
        data = self._request(
            "POST",
            "/rest/v1/books",
            params={"select": "*"},
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        return data[0]


    def update_book(self, book_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        data = self._request(
            "PATCH",
            "/rest/v1/books",
            params={"select": "*", "id": f"eq.{book_id}"},
            json=payload,
            headers={"Prefer": "return=representation"},
        )
        return data[0] if data else None

    def delete_book(self, book_id: str) -> None:
        self._request(
            "DELETE",
            "/rest/v1/books",
            params={"id": f"eq.{book_id}"},
            headers={"Prefer": "return=minimal"},
        )

    def upload_pdf(self, *, file_path: str, content: bytes, content_type: str) -> None:
        self._request(
            "POST",
            f"/storage/v1/object/pdfs/{file_path}",
            data=content,
            headers={
                "Content-Type": content_type,
                "x-upsert": "false",
            },
            timeout=120,
        )

    def delete_storage_objects(self, bucket: str, paths: list[str]) -> None:
        cleaned = [path for path in paths if path]
        if not cleaned:
            return
        self._request(
            "DELETE",
            f"/storage/v1/object/{bucket}",
            json={"prefixes": cleaned},
        )

    def invoke_function(self, function_name: str, payload: dict[str, Any]) -> Any:
        return self._request(
            "POST",
            f"/functions/v1/{function_name}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=300,
        )


service = SupabaseService(settings.supabase_url, settings.supabase_service_role_key)
app = FastAPI(title="AudioForge API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user: dict[str, Any]) -> str:
    expires_delta = timedelta(minutes=settings.jwt_expire_minutes)
    expire = datetime.now(UTC) + expires_delta
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def strip_private_user_fields(user: dict[str, Any] | None) -> AuthUser:
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return AuthUser(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        role=user["role"],
        created_at=user.get("created_at"),
        created_by_admin=user.get("created_by_admin"),
    )


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return authorization.split(" ", 1)[1]


def get_current_user(token: str = Depends(get_bearer_token)) -> AuthUser:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = service.get_user_by_id(user_id)
    return strip_private_user_fields(user)


def require_admin(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def format_file_size(size_in_bytes: int) -> str:
    return f"{size_in_bytes / 1024 / 1024:.1f} MB"


def fetch_elevenlabs_voices() -> list[VoiceOption]:
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="ELEVENLABS_API_KEY is not configured on the backend")

    response = requests.get(
        "https://api.elevenlabs.io/v1/voices",
        headers={"xi-api-key": settings.elevenlabs_api_key},
        timeout=30,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    payload = response.json()
    voices = payload.get("voices", [])
    return [
        VoiceOption(
            voice_id=voice["voice_id"],
            name=voice["name"],
            preview_url=voice.get("preview_url"),
            category=voice.get("category"),
        )
        for voice in voices
    ]


def run_conversion_pipeline(book_id: str) -> None:
    try:
        logger.info("Starting conversion pipeline for book %s", book_id)
        service.update_book(book_id, {"status": "processing", "progress": 5})
        service.invoke_function("extract-text", {"bookId": book_id})
        service.invoke_function("start-conversion", {"bookId": book_id})
    except Exception:
        logger.exception("Conversion pipeline failed for book %s", book_id)
        try:
            service.update_book(book_id, {"status": "failed", "progress": 0})
        except Exception:
            logger.exception("Failed to update failed status for book %s", book_id)


@app.on_event("startup")
def seed_default_admin() -> None:
    if not service.available:
        logger.warning("Skipping default admin seed because Supabase service credentials are missing")
        return

    default_admin = service.get_user_by_email(settings.default_admin_email)
    if default_admin:
        logger.info("Default admin already exists")
        return

    logger.info("Creating default admin account for %s", settings.default_admin_email)
    service.create_user(
        name="AudioForge Admin",
        email=settings.default_admin_email,
        password_hash=hash_password(settings.default_admin_password),
        role="admin",
        created_by_admin=None,
    )


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
    user = service.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    public_user = strip_private_user_fields(user)
    return AuthResponse(access_token=create_access_token(user), user=public_user)


@app.get("/api/auth/me", response_model=AuthUser)
def me(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
    return current_user


@app.get("/api/voices", response_model=list[VoiceOption])
def list_voices(_: AuthUser = Depends(require_admin)) -> list[VoiceOption]:
    return fetch_elevenlabs_voices()


@app.get("/api/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary(_: AuthUser = Depends(get_current_user)) -> DashboardSummary:
    books = service.list_books()
    total_books = len(books)
    completed_books = sum(1 for book in books if book["status"] == "completed")
    processing_books = sum(1 for book in books if book["status"] == "processing")
    queued_books = sum(1 for book in books if book["status"] == "queued")
    uploaded_books = sum(1 for book in books if book["status"] == "uploaded")
    failed_books = sum(1 for book in books if book["status"] == "failed")
    return DashboardSummary(
        total_books=total_books,
        completed_books=completed_books,
        processing_books=processing_books,
        queued_books=queued_books,
        uploaded_books=uploaded_books,
        failed_books=failed_books,
        queue_count=processing_books + queued_books,
        recent_books=books[:4],
    )


@app.get("/api/books", response_model=list[BookResponse])
def list_books(_: AuthUser = Depends(get_current_user)) -> list[BookResponse]:
    return [BookResponse(**book) for book in service.list_books()]


@app.get("/api/books/{book_id}", response_model=BookDetailResponse)
def get_book_detail(book_id: str, _: AuthUser = Depends(get_current_user)) -> BookDetailResponse:
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    chapters = service.get_chapters(book_id)
    return BookDetailResponse(
        book=BookResponse(**book),
        chapters=[ChapterResponse(**chapter) for chapter in chapters],
    )


@app.get("/api/books/{book_id}/chapters", response_model=list[ChapterResponse])
def get_book_chapters(book_id: str, _: AuthUser = Depends(get_current_user)) -> list[ChapterResponse]:
    return [ChapterResponse(**chapter) for chapter in service.get_chapters(book_id)]


@app.post("/api/books/upload", response_model=BookResponse)
async def upload_book(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    author: str = Form(""),
    voice_id: str = Form(...),
    voice_name: str = Form(...),
    file: UploadFile = File(...),
    admin: AuthUser = Depends(require_admin),
) -> BookResponse:
    if file.content_type not in {"application/pdf", "application/x-pdf", "application/octet-stream"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PDF uploads are supported")
    if not voice_id.strip() or not voice_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecting an ElevenLabs voice is required")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    file_path = f"{uuid.uuid4()}.pdf"
    service.upload_pdf(file_path=file_path, content=content, content_type="application/pdf")
    book = service.create_book(
        title=title,
        author=author,
        file_path=file_path,
        file_size=format_file_size(len(content)),
        voice_id=voice_id,
        voice_name=voice_name,
    )
    logger.info("Admin %s queued book %s", admin.email, book["id"])
    background_tasks.add_task(run_conversion_pipeline, book["id"])
    return BookResponse(**book)


@app.delete("/api/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: str, admin: AuthUser = Depends(require_admin)) -> None:
    book = service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    chapters = service.get_chapters(book_id)
    audio_paths = [chapter.get("audio_path") for chapter in chapters if chapter.get("audio_path")]
    try:
        if book.get("file_path"):
            service.delete_storage_objects("pdfs", [book["file_path"]])
        if audio_paths:
            service.delete_storage_objects("audiobooks", audio_paths)
    except Exception:
        logger.exception("Storage cleanup failed for book %s", book_id)
    service.delete_book(book_id)
    logger.info("Admin %s deleted book %s", admin.email, book_id)


@app.get("/api/users", response_model=list[AuthUser])
def list_users(admin: AuthUser = Depends(require_admin)) -> list[AuthUser]:
    logger.info("Admin %s fetched user list", admin.email)
    return [strip_private_user_fields(user) for user in service.list_users()]


@app.post("/api/users", response_model=AuthUser, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreateRequest, admin: AuthUser = Depends(require_admin)) -> AuthUser:
    role = payload.role.lower().strip()
    if role != "user":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only user accounts can be created here")
    if len(payload.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
    if service.get_user_by_email(payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with that email already exists")

    user = service.create_user(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        created_by_admin=admin.id,
    )
    return strip_private_user_fields(user)


@app.delete("/api/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, admin: AuthUser = Depends(require_admin)) -> None:
    if admin.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own admin account")

    user = service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user["role"] == "admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin accounts cannot be deleted here")

    service.delete_user(user_id)
