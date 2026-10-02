from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class AuthCredentials(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=8, max_length=128)


class AccountView(BaseModel):
    name: str
    email: str


class AuthView(AccountView):
    token: str


class HabitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="#19785b", pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str = Field(default="check", max_length=32)
    target_days_per_week: int = Field(default=7, ge=1, le=7)


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    icon: str | None = Field(default=None, max_length=32)
    target_days_per_week: int | None = Field(default=None, ge=1, le=7)
    is_archived: bool | None = None


class HabitView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    color: str
    icon: str
    target_days_per_week: int
    is_archived: bool
    completed_today: bool
    current_streak: int
    completed_last_7_days: list[date]


class DashboardView(BaseModel):
    selected_date: date
    habits: list[HabitView]
    completed_count: int
    total_count: int
    completion_rate: float
    best_streak: int


class NoteCreate(BaseModel):
    noted_on: date
    body: str = Field(min_length=1, max_length=1000)


class NoteView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: int
    noted_on: date
    body: str
