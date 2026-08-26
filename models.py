from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

class TappingTestResult(BaseModel):
    t1: int = 0
    t2: int = 0
    t3: int = 0
    t4: int = 0
    t5: int = 0
    t6: int = 0
    total_clicks: int = 0
    nerve_type: str = "Выпуклый (Сильная НС)"

class TemperamentAnswers(BaseModel):
    behavior: Optional[str] = "sanguine"
    decision: Optional[str] = "sanguine"
    social: Optional[str] = "sanguine"
    monotony: Optional[str] = "sanguine"

class UserProfile(BaseModel):
    full_name: Optional[str] = "Спортсмен"
    birth_date: str = "2019-01-01"
    age_years: float = 5.0
    sex: str = "female"
    height_cm: float = 116.0
    weight_kg: float = 22.0
    father_height_cm: Optional[float] = None
    mother_height_cm: Optional[float] = None
    
    physical: Dict[str, float] = Field(default_factory=lambda: {
        "speed": 6.0,
        "strength": 6.0,
        "coordination": 6.0,
        "speed_strength": 6.0,
        "flexibility": 6.0,
        "endurance": 6.0
    })
    
    psychology: Dict[str, float] = Field(default_factory=lambda: {
        "discipline": 7.0,
        "stress_resistance": 7.0,
        "motivation": 8.0
    })
    
    temperament: Optional[str] = "sanguine"
    temperament_answers: Optional[TemperamentAnswers] = None
    tapping_test: Optional[TappingTestResult] = None
    
    goal: Optional[str] = "health"
    preferences: List[str] = Field(default_factory=list)
    restrictions: List[str] = Field(default_factory=list)

class SportProfile(BaseModel):
    id: str
    name: str
    category: str = "Вид спорта РФ"
    physical: Dict[str, float] = Field(default_factory=dict)
    psychology: Dict[str, float] = Field(default_factory=dict)
    anthropometry: Dict[str, float] = Field(default_factory=dict)
    team: bool = False
    contact: str = "none"
    age_min: Optional[int] = 7
    age_max: Optional[int] = 18
    sources: List[str] = Field(default_factory=list)

class SportAvailability(BaseModel):
    sport_id: str
    name: str
    status: str = "active"
    organization_or_object: str
    address: str = "г. Лангепас"
    notes: Optional[str] = None
    source: Optional[str] = "Langsport.xls"

class SportScore(BaseModel):
    sport_id: str
    sport_name: str
    score: float
    components: Dict[str, float] = Field(default_factory=dict)
    reasons_positive: List[str] = Field(default_factory=list)
    reasons_negative: List[str] = Field(default_factory=list)
    age_eligible: bool = True
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    age_note: Optional[str] = None
    availability_status: str = "unknown"
    availability_note: str = "Всероссийский вид спорта"
    local_availability: Optional[SportAvailability] = None

class StasResult(BaseModel):
    user_info: Dict[str, Any] = Field(default_factory=dict)
    scores: List[SportScore] = Field(default_factory=list)
    top_sports: List[SportScore] = Field(default_factory=list)
    langepas_sports: List[SportScore] = Field(default_factory=list)
    alternatives: List[SportScore] = Field(default_factory=list)
    age_excluded: List[SportScore] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    data_version: str = "10.0 (Опросник Белова/Айзенка + ОФП Дошкольники)"
    generated_at: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)