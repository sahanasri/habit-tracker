from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, select, text, update
from sqlalchemy.orm import Session

from .auth import create_session, get_current_user, hash_password, token_hash, verify_password
from .database import Base, engine, get_db
from .models import AuthSession, Habit, HabitCompletion, HabitNote, User
from .schemas import AuthCredentials, AuthView, DashboardView, HabitCreate, HabitUpdate, HabitView, NoteCreate, NoteView


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    if "user_id" not in {column["name"] for column in inspect(engine).get_columns("habits")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE habits ADD COLUMN user_id INTEGER REFERENCES users(id)"))
    yield


app = FastAPI(title="Habit Tracker API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def completion_dates(db: Session, habit_id: int, through: date) -> set[date]:
    rows = db.scalars(
        select(HabitCompletion.completed_on).where(
            HabitCompletion.habit_id == habit_id,
            HabitCompletion.completed_on <= through,
        )
    )
    return set(rows)


def streak(completed: set[date], through: date) -> int:
    count = 0
    cursor = through
    while cursor in completed:
        count += 1
        cursor -= timedelta(days=1)
    return count


def habit_view(db: Session, habit: Habit, selected_date: date) -> HabitView:
    completed = completion_dates(db, habit.id, selected_date)
    week_start = selected_date - timedelta(days=6)
    return HabitView(
        id=habit.id,
        name=habit.name,
        description=habit.description,
        color=habit.color,
        icon=habit.icon,
        target_days_per_week=habit.target_days_per_week,
        is_archived=habit.is_archived,
        completed_today=selected_date in completed,
        current_streak=streak(completed, selected_date),
        completed_last_7_days=sorted(day for day in completed if day >= week_start),
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=AuthView, status_code=status.HTTP_201_CREATED)
def register(payload: AuthCredentials, db: Session = Depends(get_db)) -> AuthView:
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    db.execute(update(Habit).where(Habit.user_id.is_(None)).values(user_id=user.id))
    db.commit()
    return AuthView(token=create_session(db, user), email=user.email)


@app.post("/api/auth/login", response_model=AuthView)
def login(payload: AuthCredentials, db: Session = Depends(get_db)) -> AuthView:
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return AuthView(token=create_session(db, user), email=user.email)


@app.post("/api/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: Session = Depends(get_db)) -> Response:
    _, _, token = request.headers.get("Authorization", "").partition(" ")
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash(token)))
    if session:
        db.delete(session)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/dashboard", response_model=DashboardView)
def dashboard(
    selected_date: date = Query(default_factory=date.today, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DashboardView:
    habits = list(db.scalars(select(Habit).where(
        Habit.user_id == user.id, Habit.is_archived.is_(False)
    ).order_by(Habit.created_at)))
    views = [habit_view(db, habit, selected_date) for habit in habits]
    completed_count = sum(item.completed_today for item in views)
    total_count = len(views)
    return DashboardView(
        selected_date=selected_date,
        habits=views,
        completed_count=completed_count,
        total_count=total_count,
        completion_rate=round(completed_count / total_count, 4) if total_count else 0,
        best_streak=max((item.current_streak for item in views), default=0),
    )


@app.post("/api/habits", response_model=HabitView, status_code=status.HTTP_201_CREATED)
def create_habit(
    payload: HabitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitView:
    habit = Habit(user_id=user.id, **payload.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit_view(db, habit, date.today())


def get_habit_or_404(db: Session, habit_id: int, user_id: int) -> Habit:
    habit = db.scalar(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@app.patch("/api/habits/{habit_id}", response_model=HabitView)
def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitView:
    habit = get_habit_or_404(db, habit_id, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    return habit_view(db, habit, date.today())


@app.delete("/api/habits/{habit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_habit(
    habit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    db.delete(get_habit_or_404(db, habit_id, user.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.post("/api/habits/{habit_id}/toggle", response_model=HabitView)
def toggle_habit(
    habit_id: int,
    completed_on: date = Query(default_factory=date.today, alias="date"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitView:
    habit = get_habit_or_404(db, habit_id, user.id)
    existing = db.scalar(
        select(HabitCompletion).where(
            HabitCompletion.habit_id == habit_id,
            HabitCompletion.completed_on == completed_on,
        )
    )
    if existing:
        db.delete(existing)
    else:
        db.add(HabitCompletion(habit_id=habit_id, completed_on=completed_on))
    db.commit()
    return habit_view(db, habit, completed_on)


@app.get("/api/habits/{habit_id}/notes", response_model=list[NoteView])
def list_notes(
    habit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HabitNote]:
    get_habit_or_404(db, habit_id, user.id)
    return list(db.scalars(select(HabitNote).where(HabitNote.habit_id == habit_id).order_by(HabitNote.noted_on.desc())))


@app.post("/api/habits/{habit_id}/notes", response_model=NoteView, status_code=status.HTTP_201_CREATED)
def create_note(
    habit_id: int,
    payload: NoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitNote:
    get_habit_or_404(db, habit_id, user.id)
    note = HabitNote(habit_id=habit_id, **payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
