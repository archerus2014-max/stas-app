import os
import uuid
import requests
import urllib3
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI(title="STAS Full Local Production Server 24/7")

# Настройка CORS для работы из VK Mini App
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GIGACHAT_AUTH_KEY = "MDFhMDIyNmQtMDVlMC03NGIyLThhNzMtYjhiZmU2NGJhNmE2OmU1ZTViNDliLTZiMTctNGRhMS05MWQzLWU2ZjYyMWUyZTM4Zg=="

def get_gigachat_token():
    try:
        url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        payload = 'scope=GIGACHAT_API_PERS'
        headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'RqUID': str(uuid.uuid4()),
            'Authorization': f'Basic {GIGACHAT_AUTH_KEY}'
        }
        res = requests.post(url, headers=headers, data=payload, verify=False, timeout=8)
        return res.json().get("access_token")
    except Exception as e:
        print("[GigaChat Auth Error]:", e)
        return None

class AthleteData(BaseModel):
    full_name: str
    age: int
    top_sports: list[str]
    nerve_type: str
    reaction_ms: int
    bmi: float

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Server is running"}

@app.post("/api/analyze")
def analyze(data: AthleteData):
    token = get_gigachat_token()
    sports_str = ", ".join(data.top_sports)
    
    if token:
        try:
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': f'Bearer {token}'
            }
            prompt = (
                f"Ты спортивный агент Бельчонок СТАС из СШОР 'Академия спорта' г. Лангепас. "
                f"Составь эмоциональное, вдохновляющее и экспертное заключение для юного спортсмена по имени {data.full_name} ({data.age} лет). "
                f"Показатели обследования: ИМТ={data.bmi}, Сенсомоторная реакция={data.reaction_ms} мс, "
                f"Тип нервной системы по Теппинг-тесту Ильина={data.nerve_type}. "
                f"Математически рассчитанные подходящие секции: {sports_str}. "
                f"Пригласи его на тренировки в Лангепас!"
            )
            body = {
                "model": "GigaChat",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7
            }
            res = requests.post("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", headers=headers, json=body, verify=False, timeout=12)
            ai_text = res.json()['choices'][0]['message']['content']
            return {"status": "success", "ai_text": ai_text}
        except Exception as e:
            print("[GigaChat Generation Error]:", e)

    fallback_text = (
        f"Привет, {data.full_name}! Я Бельчонок СТАС из СШОР «Академия спорта» г. Лангепас. "
        f"Анализ твоих данных (ИМТ: {data.bmi}, реакция: {data.reaction_ms} мс, НС: {data.nerve_type}) "
        f"показал, что наибольших успехов ты добьешься в дисциплинах: {sports_str}! Ждем тебя на тренировках!"
    )
    return {"status": "fallback", "ai_text": fallback_text}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Роут главной страницы
@app.get("/")
def read_root():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

# Корректная отдача статических файлов (app.js, style.css, stas.png и т.д.)
@app.get("/{file_name:path}")
def read_static(file_name: str):
    file_path = os.path.join(BASE_DIR, file_name)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse(os.path.join(BASE_DIR, "index.html"))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)