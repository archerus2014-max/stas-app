// ==========================================
// 1. КОНФИГУРАЦИЯ И ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ==========================================

const API_URL = "https://oven-mockup-chase.ngrok-free.dev";

let currentQuizStep = 0;
let reactionStartTime = 0;
let reactionTimer = null;
let tappingTimer = null;
let tapCount = 0;
let tappingTimeLeft = 30;

let userAnswers = {
    full_name: "Юный спортсмен",
    birth_date: "15.05.2016",
    sex: "female",
    height_cm: 116,
    weight_kg: 24,
    father_height_cm: 178,
    mother_height_cm: 165,
    physical: {
        speed: 5, strength: 5, coordination: 5,
        speed_strength: 5, flexibility: 5, endurance: 5
    },
    temperament: "sanguine",
    reaction_ms: 300,
    tapping_test: { nerve_type: "Стабильная НС" }
};

const quizQuestions = [
    { title: "ФИО Ребенка", field: "full_name", type: "text", default: "Иван Иванов" },
    { title: "Дата рождения (ДД.ММ.ГГГГ)", field: "birth_date", type: "date_text", default: "15.05.2016" },
    { title: "Пол", field: "sex", type: "select", options: [{l: "Женский", v: "female"}, {l: "Мужской", v: "male"}] },
    { title: "Рост ребенка (см)", field: "height_cm", type: "number", default: 125 },
    { title: "Вес ребенка (кг)", field: "weight_kg", type: "number", default: 25 },
    { title: "Рост отца (см)", field: "father_height_cm", type: "number", default: 178 },
    { title: "Рост матери (см)", field: "mother_height_cm", type: "number", default: 165 },
    { title: "Темперамент", field: "temperament", type: "select", options: [
        {l: "Сангвиник (живой, подвижный)", v: "sanguine"},
        {l: "Холерик (быстрый, порывистый)", v: "choleric"},
        {l: "Флегматик (неспешный, спокойный)", v: "phlegmatic"},
        {l: "Меланхолик (склонный к переживаниям)", v: "melancholic"}
    ]}
];

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ И ПРОВЕРКА СВЯЗИ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    checkApiConnection();
});

async function checkApiConnection() {
    const statusEl = document.getElementById("apiStatus");
    try {
        const res = await fetch(`${API_URL}/health`, { method: "GET", headers: { "ngrok-skip-browser-warning": "true" } });
        if (res.ok && statusEl) {
            statusEl.textContent = "STAS API: Подключено";
            statusEl.classList.add("connected");
        }
    } catch (e) {
        console.log("Health check skipped:", e);
    }
}

function showScreen(screenId) {
    const screens = ["welcomeScreen", "quizScreen", "reactionScreen", "tappingScreen", "resultsScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.classList.remove("hidden");
            } else {
                el.classList.add("hidden");
            }
        }
    });
    window.scrollTo(0, 0);
}

// ==========================================
// 3. ПОШАГОВЫЙ КВИЗ
// ==========================================
function startQuiz() {
    currentQuizStep = 0;
    showScreen("quizScreen");
    renderQuestion();
}

function renderQuestion() {
    const q = quizQuestions[currentQuizStep];
    const container = document.getElementById("questionContainer");
    const indicator = document.getElementById("stepIndicator");
    const progressFill = document.getElementById("progressFill");
    const prevBtn = document.getElementById("prevBtn");

    if (indicator) indicator.textContent = `Шаг ${currentQuizStep + 1} из ${quizQuestions.length}`;
    if (progressFill) progressFill.style.width = `${((currentQuizStep + 1) / quizQuestions.length) * 100}%`;
    if (prevBtn) prevBtn.style.display = currentQuizStep > 0 ? "inline-block" : "none";

    let inputHtml = "";
    if (q.type === "date_text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" inputmode="numeric" pattern="[0-9.]*" placeholder="ДД.ММ.ГГГГ" maxlength="10" value="${userAnswers[q.field] || q.default || ''}" oninput="formatDateInput(this)">`;
    } else if (q.type === "text" || q.type === "number") {
        inputHtml = `<input type="${q.type}" id="quizInput" class="quiz-input" value="${userAnswers[q.field] || q.default || ''}">`;
    } else if (q.type === "select") {
        const options = q.options.map(o => `<option value="${o.v}" ${userAnswers[q.field] === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
        inputHtml = `<select id="quizInput" class="quiz-select">${options}</select>`;
    }

    container.innerHTML = `
        <h3 class="question-title">${q.title}</h3>
        <div class="input-wrapper">${inputHtml}</div>
        <button type="button" class="btn-primary" style="margin-top:20px;" onclick="nextStep()">Далее ➔</button>
    `;
}

function formatDateInput(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 8) v = v.substring(0, 8);
    if (v.length >= 5) {
        input.value = `${v.substring(0, 2)}.${v.substring(2, 4)}.${v.substring(4, 8)}`;
    } else if (v.length >= 3) {
        input.value = `${v.substring(0, 2)}.${v.substring(2, 4)}`;
    } else {
        input.value = v;
    }
}

function saveCurrentAnswer() {
    const q = quizQuestions[currentQuizStep];
    const input = document.getElementById("quizInput");
    if (input && q) {
        let val = input.value;
        if (q.type === "number") val = parseFloat(val) || 0;
        userAnswers[q.field] = val;
    }
}

function nextStep() {
    saveCurrentAnswer();
    if (currentQuizStep < quizQuestions.length - 1) {
        currentQuizStep++;
        renderQuestion();
    } else {
        showScreen("reactionScreen");
    }
}

function prevStep() {
    saveCurrentAnswer();
    if (currentQuizStep > 0) {
        currentQuizStep--;
        renderQuestion();
    }
}

// ==========================================
// 4. ТЕСТ НА РЕАКЦИЮ
// ==========================================
function startReactionTest() {
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (btn) btn.style.display = "none";
    box.style.background = "#ff4d4f";
    prompt.textContent = "Ждите зеленый цвет...";

    const delay = Math.floor(Math.random() * 3000) + 2000;
    reactionTimer = setTimeout(() => {
        box.style.background = "#52c41a";
        prompt.textContent = "ЖМИ СКОРЕЕ!";
        reactionStartTime = Date.now();
    }, delay);
}

function handleReactionClick() {
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (!reactionStartTime) {
        clearTimeout(reactionTimer);
        box.style.background = "#faad14";
        prompt.textContent = "Слишком рано! Нажмите старт снова.";
        if (btn) btn.style.display = "inline-block";
        return;
    }

    const diff = Date.now() - reactionStartTime;
    userAnswers.reaction_ms = diff;
    reactionStartTime = 0;

    box.style.background = "#1890ff";
    prompt.textContent = `Ваше время реакции: ${diff} мс! Переходим дальше...`;

    setTimeout(() => {
        showScreen("tappingScreen");
    }, 1500);
}

// ==========================================
// 5. ТЕППИНГ-ТЕСТ ИЛЬИНА
// ==========================================
function startTappingTest() {
    tapCount = 0;
    tappingTimeLeft = 30;
    const countEl = document.getElementById("tapCountDisplay");
    const timerEl = document.getElementById("tapTimer");
    const btn = document.getElementById("startTapBtn");
    const promptText = document.getElementById("tapPromptText");

    if (countEl) countEl.textContent = "0";
    if (timerEl) timerEl.textContent = "30";
    if (btn) btn.style.display = "none";
    if (promptText) promptText.textContent = "ЖМИТЕ МАКСИМАЛЬНО БЫСТРО!";

    tappingTimer = setInterval(() => {
        tappingTimeLeft--;
        if (timerEl) timerEl.textContent = tappingTimeLeft;

        if (tappingTimeLeft <= 0) {
            clearInterval(tappingTimer);
            finishTappingTest();
        }
    }, 1000);
}

function registerTap() {
    if (tappingTimeLeft > 0 && tappingTimeLeft < 30) {
        tapCount++;
        const countEl = document.getElementById("tapCountDisplay");
        if (countEl) countEl.textContent = tapCount;
    }
}

async function finishTappingTest() {
    let nerveType = "Стабильная НС";
    if (tapCount > 180) nerveType = "Сильная НС";
    else if (tapCount < 120) nerveType = "Слабая НС";

    userAnswers.tapping_test = { nerve_type: nerveType, count: tapCount };

    showScreen("resultsScreen");
    await fetchServerGigaChatAI();
}

// ==========================================
// 6. ОТПРАВКА В FASTAPI И ВЫВОД РЕЗУЛЬТАТОВ
// ==========================================
function calculateAge(birthDateString) {
    if (!birthDateString) return 8;

    let birthDate;
    if (birthDateString.includes(".")) {
        const parts = birthDateString.split(".");
        birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    } else {
        birthDate = new Date(birthDateString);
    }

    if (isNaN(birthDate.getTime())) return 8;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 ? age : 8;
}

async function fetchServerGigaChatAI() {
    const nameEl = document.getElementById("resChildName");
    const subEl = document.getElementById("resChildAgeSex");
    const aiTextEl = document.getElementById("resAiText");

    if (nameEl) nameEl.textContent = userAnswers.full_name;
    if (subEl) subEl.textContent = `${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;
    if (aiTextEl) aiTextEl.innerHTML = "<p style='color: #0077ff; font-weight: bold;'>Бельчонок СТАС проводит 4-компонентный расчёт...</p>";

    const payload = {
        full_name: String(userAnswers.full_name),
        age: parseInt(calculateAge(userAnswers.birth_date)),
        sex: String(userAnswers.sex),
        height_cm: parseFloat(userAnswers.height_cm),
        weight_kg: parseFloat(userAnswers.weight_kg),
        father_height_cm: parseFloat(userAnswers.father_height_cm),
        mother_height_cm: parseFloat(userAnswers.mother_height_cm),
        physical: userAnswers.physical,
        temperament: String(userAnswers.temperament),
        reaction_ms: parseInt(userAnswers.reaction_ms),
        nerve_type: String(userAnswers.tapping_test.nerve_type)
    };

    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
                "Bypass-Tunnel-Reminder": "true"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result && result.ai_text && aiTextEl) {
            aiTextEl.innerHTML = result.ai_text
                .split('\n\n')
                .map(p => `<p style="margin-bottom: 12px; line-height: 1.6;">${p}</p>`)
                .join('');
        }

        renderDashboard(result);
    } catch (e) {
        console.error("Ошибка API:", e);
        if (aiTextEl) {
            aiTextEl.innerHTML = "<div style='color: red; padding: 10px;'>Ошибка связи с бэкендом. Проверьте watchdog.bat.</div>";
        }
    }
}

function renderDashboard(data) {
    const gridEl = document.getElementById("recommendedGrid");
    const targetHeightEl = document.getElementById("resTargetHeightVal");
    const heightEl = document.getElementById("resHeightVal");
    const weightEl = document.getElementById("resWeightVal");
    const reactionEl = document.getElementById("resReactionVal");
    const tempEl = document.getElementById("resTemperamentVal");
    const tapEl = document.getElementById("resTappingVal");

    if (heightEl) heightEl.textContent = `${userAnswers.height_cm} см`;
    if (weightEl) weightEl.textContent = `${userAnswers.weight_kg} кг`;
    if (reactionEl) reactionEl.textContent = `${userAnswers.reaction_ms} мс`;
    if (tempEl) tempEl.textContent = userAnswers.temperament;
    if (tapEl) tapEl.textContent = userAnswers.tapping_test.nerve_type;

    if (targetHeightEl && data.predicted_adult_height) {
        targetHeightEl.textContent = `${data.predicted_adult_height} см`;
    }

    if (!gridEl || !data.top_sports) return;

    gridEl.innerHTML = "";
    data.top_sports.forEach((item, index) => {
        const card = document.createElement("div");
        card.style.cssText = "background: #fff; border-left: 5px solid #0077ff; padding: 14px; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);";
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="margin: 0; color: #1e293b; font-size: 16px;">#${index + 1} ${item.sport_name}</h4>
                <span style="background: #0077ff; color: #fff; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 14px;">${item.score}%</span>
            </div>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">
                <strong>Организация:</strong> ${item.org}<br>
                <strong>Статус:</strong> ${item.status_note}
            </p>
        `;
        gridEl.appendChild(card);
    });
}

function restartQuiz() {
    showScreen("welcomeScreen");
}