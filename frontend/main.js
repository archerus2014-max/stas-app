import bridge from '@vkontakte/vk-bridge';
import html2pdf from 'html2pdf.js';

const API_URL = "https://sportivnyj-agent-archerus.amvera.io";

bridge.send("VKWebAppInit")
    .then(() => bridge.send("VKWebAppHideLoadingScreen"))
    .catch((err) => console.log("VK Bridge Init:", err));

// ====================== СОСТОЯНИЕ ======================
let currentMode = null; // 'child' | 'adult'
let currentQuizStep = 0;
let activeQuizQuestions = [];
let useNormsMode = false;

let reactionStartTime = 0;
let reactionTimer = null;
let reactionActive = false;

let tappingTimer = null;
let tappingTimeLeft = 30;
let tappingActive = false;
let currentSquare = 1;
let squareCounts = [0, 0, 0, 0, 0, 0];

let lastAnalysisResult = null;

let userAnswers = {
    first_name: "",
    age: 30,
    sex: "female",
    height_cm: 165,
    weight_kg: 65,

    // детский режим
    birth_date: "15.05.2016",
    father_height_cm: 178,
    mother_height_cm: 165,
    physical: {
        speed: 6, strength: 6, coordination: 6,
        speed_strength: 6, flexibility: 6, endurance: 6
    },
    normatives: {
        pullups: 1, flexibility_cm: 8, situps: 29,
        long_jump_cm: 134, shuttle_run_sec: 9.0, run_30m_sec: 6.0,
        pushups: 10, target_throw: 3
    },
    temperament: "sanguine",
    reaction_ms: 300,
    tapping_test: { nerve_type: "Стабильная НС", curve_type: "Ровный тип", count: 150 },

    // взрослый режим
    complaints: {
        back: false, joints: false, pressure: false,
        headache: false, heart: false, dyspnea: false,
        overweight: false, none: true
    },
    activity_level: "low",
    goals: []
};

// ====================== ВОПРОСЫ ======================
const skillOptions = [
    { label: "Ниже среднего / Требует развития", value: 3 },
    { label: "Средний уровень / Как у сверстников", value: 6 },
    { label: "Высокий уровень / Выделяется", value: 8 },
    { label: "Выдающийся результат", value: 10 }
];

const childBaseQuestions = [
    { title: "Имя ребенка", field: "first_name", type: "text", placeholder: "Например: Иван" },
    { title: "Дата рождения (ДД.ММ.ГГГГ)", field: "birth_date", type: "date_text", placeholder: "15.05.2016" },
    { title: "Пол ребенка", field: "sex", type: "gender_cards" },
    { title: "Рост ребенка (см)", field: "height_cm", type: "number", default: 125 },
    { title: "Вес ребенка (кг)", field: "weight_kg", type: "number", default: 25 },
    { title: "Рост отца (см)", field: "father_height_cm", type: "number", default: 178 },
    { title: "Рост матери (см)", field: "mother_height_cm", type: "number", default: 165 }
];

const physicalQuestions = [
    { title: "Скорость и быстрота движений", field: "speed", subfield: "physical", type: "cards_skill" },
    { title: "Сила и мышечное усилие", field: "strength", subfield: "physical", type: "cards_skill" },
    { title: "Координация и ловкость", field: "coordination", subfield: "physical", type: "cards_skill" },
    { title: "Скоростно-силовые качества (прыгучесть)", field: "speed_strength", subfield: "physical", type: "cards_skill" },
    { title: "Гибкость и подвижность суставов", field: "flexibility", subfield: "physical", type: "cards_skill" },
    { title: "Выносливость при долгих нагрузках", field: "endurance", subfield: "physical", type: "cards_skill" }
];

const normativesQuestions = [
    { title: "Подтягивание из виса", avg: "Норма: 1 раз", field: "pullups", subfield: "normatives", type: "number_norm", unit: "раз", default: 1 },
    { title: "Наклон вперед стоя", avg: "Норма: 8 см", field: "flexibility_cm", subfield: "normatives", type: "number_norm", unit: "см", default: 8 },
    { title: "Поднимание туловища за 1 мин", avg: "Норма: 29 раз", field: "situps", subfield: "normatives", type: "number_norm", unit: "раз", default: 29 },
    { title: "Прыжок в длину с места", avg: "Норма: 134 см", field: "long_jump_cm", subfield: "normatives", type: "number_norm", unit: "см", default: 134 },
    { title: "Челночный бег 3×10 м", avg: "Норма: 9.0 сек", field: "shuttle_run_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 9.0 },
    { title: "Бег на 30 м", avg: "Норма: 6.0 сек", field: "run_30m_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 6.0 },
    { title: "Отжимания", avg: "Норма: 10 раз", field: "pushups", subfield: "normatives", type: "number_norm", unit: "раз", default: 10 },
    { title: "Метание мяча в цель (из 5)", avg: "Норма: 3", field: "target_throw", subfield: "normatives", type: "number_norm", unit: "раз", default: 3 }
];

const finalChildQuestions = [
    { title: "Темперамент и поведение", field: "temperament", type: "cards_options", options: [
        { label: "Сангвиник (живой, общительный)", value: "sanguine" },
        { label: "Холерик (импульсивный, быстрый)", value: "choleric" },
        { label: "Флегматик (спокойный, упорный)", value: "phlegmatic" },
        { label: "Меланхолик (чуткий, осторожный)", value: "melancholic" }
    ]}
];

const adultQuestions = [
    { title: "Ваше имя (или как к вам обращаться)", field: "first_name", type: "text", placeholder: "Например: Алексей" },
    { title: "Ваш возраст", field: "age", type: "number", default: 35 },
    { title: "Пол", field: "sex", type: "gender_cards" },
    { title: "Рост (см)", field: "height_cm", type: "number", default: 170 },
    { title: "Вес (кг)", field: "weight_kg", type: "number", default: 70 },
    { title: "Есть ли у вас жалобы?", field: "complaints", type: "multi_check", options: [
        { label: "Боли в спине / пояснице", value: "back" },
        { label: "Проблемы с суставами", value: "joints" },
        { label: "Повышенное / пониженное давление", value: "pressure" },
        { label: "Частые головные боли", value: "headache" },
        { label: "Проблемы с сердцем / одышка", value: "heart" },
        { label: "Одышка при нагрузке", value: "dyspnea" },
        { label: "Лишний вес", value: "overweight" },
        { label: "Жалоб нет", value: "none" }
    ]},
    { title: "Текущий уровень физической активности", field: "activity_level", type: "cards_options", options: [
        { label: "Низкий (мало двигаюсь)", value: "low" },
        { label: "Средний (прогулки, иногда спорт)", value: "medium" },
        { label: "Высокий (регулярно занимаюсь)", value: "high" }
    ]},
    { title: "Ваша главная цель", field: "goals", type: "multi_check", options: [
        { label: "Снизить вес / улучшить фигуру", value: "weight" },
        { label: "Укрепить спину и осанку", value: "back" },
        { label: "Повысить выносливость", value: "endurance" },
        { label: "Снять стресс / улучшить самочувствие", value: "stress" },
        { label: "Просто поддерживать здоровье", value: "general" }
    ]}
];

const temperamentRu = {
    sanguine: "Сангвиник",
    choleric: "Холерик",
    phlegmatic: "Флегматик",
    melancholic: "Меланхолик"
};

// ====================== ИНИЦИАЛИЗАЦИЯ ======================
bridge.send('VKWebAppGetUserInfo')
    .then((user) => {
        if (user && user.first_name) {
            userAnswers.first_name = user.first_name;
        }
    })
    .catch(() => {});

fetch(`${API_URL}/health`)
    .then(res => res.json())
    .then(data => {
        const badge = document.getElementById("apiStatus");
        if (badge && data.status === "ok") {
            badge.textContent = "STAS Engine: Онлайн";
            badge.style.background = "#dcfce7";
        }
    })
    .catch(() => {});

// ====================== ВЫБОР РЕЖИМА ======================
document.getElementById("modeChild")?.addEventListener("click", () => {
    currentMode = "child";
    document.getElementById("modeChild").classList.add("active");
    document.getElementById("modeAdult").classList.remove("active");
    document.getElementById("normsCard")?.classList.remove("hidden");
    document.getElementById("startBtn").disabled = false;
    document.getElementById("startBtn").textContent = "Начать тестирование ребёнка ➔";
});

document.getElementById("modeAdult")?.addEventListener("click", () => {
    currentMode = "adult";
    document.getElementById("modeAdult").classList.add("active");
    document.getElementById("modeChild").classList.remove("active");
    document.getElementById("normsCard")?.classList.add("hidden");
    useNormsMode = false;
    document.getElementById("normsCard")?.classList.remove("active");
    document.getElementById("startBtn").disabled = false;
    document.getElementById("startBtn").textContent = "Начать опрос для здоровья ➔";
});

document.getElementById("normsCard")?.addEventListener("click", () => {
    useNormsMode = !useNormsMode;
    document.getElementById("normsCard").classList.toggle("active", useNormsMode);
});

document.getElementById("startBtn")?.addEventListener("click", () => {
    if (!currentMode) return;

    if (currentMode === "child") {
        if (useNormsMode) {
            activeQuizQuestions = [...childBaseQuestions, ...normativesQuestions, ...finalChildQuestions];
        } else {
            activeQuizQuestions = [...childBaseQuestions, ...physicalQuestions, ...finalChildQuestions];
        }
    } else {
        activeQuizQuestions = [...adultQuestions];
    }

    currentQuizStep = 0;
    showScreen("quizScreen");
    renderQuestion();
});

// ====================== ОБЩИЕ ФУНКЦИИ ======================
function showScreen(screenId) {
    const screens = ["welcomeScreen", "quizScreen", "reactionScreen", "tappingScreen", "resultsScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === screenId) {
                el.classList.remove("hidden");
                el.style.display = "block";
            } else {
                el.classList.add("hidden");
                el.style.display = "none";
            }
        }
    });
    window.scrollTo(0, 0);
}

function renderQuestion() {
    const q = activeQuizQuestions[currentQuizStep];
    const container = document.getElementById("questionContainer");
    const indicator = document.getElementById("stepIndicator");
    const progressFill = document.getElementById("progressFill");
    const prevBtn = document.getElementById("prevBtn");

    if (indicator) indicator.textContent = `Шаг ${currentQuizStep + 1} из ${activeQuizQuestions.length}`;
    if (progressFill) progressFill.style.width = `${((currentQuizStep + 1) / activeQuizQuestions.length) * 100}%`;
    if (prevBtn) prevBtn.style.display = currentQuizStep > 0 ? "inline-block" : "none";

    let currentValue = q.subfield ? userAnswers[q.subfield][q.field] : userAnswers[q.field];
    let inputHtml = "";

    if (q.type === "text" || q.type === "date_text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" placeholder="${q.placeholder || ''}" value="${currentValue || ''}">`;
    } else if (q.type === "number") {
        inputHtml = `<input type="number" id="quizInput" class="quiz-input" value="${currentValue || q.default || ''}">`;
    } else if (q.type === "number_norm") {
        inputHtml = `
            <div class="normative-card">
                ${q.avg ? `<p class="normative-avg">${q.avg}</p>` : ''}
                <div class="normative-input-box">
                    <input type="number" id="quizInput" class="quiz-input" value="${currentValue !== undefined ? currentValue : (q.default || '')}">
                    <span class="normative-unit">${q.unit}</span>
                </div>
            </div>`;
    } else if (q.type === "gender_cards") {
        const activeSex = userAnswers.sex || "female";
        inputHtml = `
            <div class="cards-select-grid">
                <div class="select-card ${activeSex === 'female' ? 'active' : ''}" data-val="female">👧 Девочка / Женский</div>
                <div class="select-card ${activeSex === 'male' ? 'active' : ''}" data-val="male">👦 Мальчик / Мужской</div>
            </div>
            <input type="hidden" id="quizInput" value="${activeSex}">`;
    } else if (q.type === "cards_skill") {
        const curScore = userAnswers.physical[q.field] || 6;
        inputHtml = `<div class="cards-select-grid">` +
            skillOptions.map(opt => `<div class="select-card ${curScore === opt.value ? 'active' : ''}" data-val="${opt.value}">${opt.label}</div>`).join('') +
            `</div><input type="hidden" id="quizInput" value="${curScore}">`;
    } else if (q.type === "cards_options") {
        const cur = currentValue || (q.options[0] && q.options[0].value);
        inputHtml = `<div class="cards-select-grid">` +
            q.options.map(opt => `<div class="select-card ${cur === opt.value ? 'active' : ''}" data-val="${opt.value}">${opt.label}</div>`).join('') +
            `</div><input type="hidden" id="quizInput" value="${cur}">`;
    } else if (q.type === "multi_check") {
        const selected = Array.isArray(currentValue) ? currentValue :
            (typeof currentValue === 'object' ? Object.keys(currentValue).filter(k => currentValue[k]) : []);
        inputHtml = `<div class="cards-select-grid">` +
            q.options.map(opt => {
                const isActive = selected.includes(opt.value) || (opt.value === "none" && selected.length === 0);
                return `<div class="select-card ${isActive ? 'active' : ''}" data-val="${opt.value}" data-multi="true">${opt.label}</div>`;
            }).join('') +
            `</div><input type="hidden" id="quizInput" value="${selected.join(',')}">`;
    }

    container.innerHTML = `
        <h3 class="question-title">${q.title}</h3>
        <div class="input-wrapper">${inputHtml}</div>
        <button type="button" class="btn-primary" id="nextStepBtn" style="margin-top:16px;">Далее ➔</button>
    `;

    container.querySelectorAll(".select-card").forEach(card => {
        card.addEventListener("click", () => {
            const isMulti = card.getAttribute("data-multi") === "true";
            if (isMulti) {
                card.classList.toggle("active");
                if (card.getAttribute("data-val") === "none") {
                    container.querySelectorAll(".select-card").forEach(c => {
                        if (c !== card) c.classList.remove("active");
                    });
                } else {
                    container.querySelector('[data-val="none"]')?.classList.remove("active");
                }
                const selected = Array.from(container.querySelectorAll(".select-card.active")).map(c => c.getAttribute("data-val"));
                document.getElementById("quizInput").value = selected.join(",");
            } else {
                container.querySelectorAll(".select-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                document.getElementById("quizInput").value = card.getAttribute("data-val");
            }
        });
    });

    document.getElementById("nextStepBtn")?.addEventListener("click", nextStep);
}

function saveCurrentAnswer() {
    const q = activeQuizQuestions[currentQuizStep];
    const input = document.getElementById("quizInput");
    if (!input || !q) return;

    let val = input.value;

    if (q.type === "number" || q.type === "number_norm") {
        val = q.isFloat ? parseFloat(val) || 0 : parseInt(val) || 0;
    }

    if (q.type === "multi_check") {
        const arr = val ? val.split(",").filter(Boolean) : [];
        if (q.field === "complaints") {
            userAnswers.complaints = {
                back: arr.includes("back"),
                joints: arr.includes("joints"),
                pressure: arr.includes("pressure"),
                headache: arr.includes("headache"),
                heart: arr.includes("heart"),
                dyspnea: arr.includes("dyspnea"),
                overweight: arr.includes("overweight"),
                none: arr.includes("none") || arr.length === 0
            };
        } else if (q.field === "goals") {
            userAnswers.goals = arr;
        }
        return;
    }

    if (q.subfield) {
        userAnswers[q.subfield][q.field] = val;
    } else {
        userAnswers[q.field] = val;
    }
}

function nextStep() {
    saveCurrentAnswer();
    if (currentQuizStep < activeQuizQuestions.length - 1) {
        currentQuizStep++;
        renderQuestion();
    } else {
        if (currentMode === "child") {
            if (useNormsMode) {
                calculatePhysicalFromNorms();
            }
            showScreen("reactionScreen");
            resetReactionUI();
        } else {
            showScreen("resultsScreen");
            document.getElementById("childResultsBlock").classList.add("hidden");
            document.getElementById("adultResultsBlock").classList.remove("hidden");
            processAdultResults();
        }
    }
}

document.getElementById("prevBtn")?.addEventListener("click", () => {
    saveCurrentAnswer();
    if (currentQuizStep > 0) {
        currentQuizStep--;
        renderQuestion();
    }
});

// ====================== ПЕРЕСЧЁТ ИЗ НОРМАТИВОВ ======================
function calculatePhysicalFromNorms() {
    const n = userAnswers.normatives;

    const strength = Math.min(10, Math.max(1, Math.round(
        (n.pullups / 3) * 4 + (n.pushups / 15) * 4 + (n.situps / 35) * 2
    )));
    const flexibility = Math.min(10, Math.max(1, Math.round((n.flexibility_cm / 12) * 8 + 2)));
    const endurance = Math.min(10, Math.max(1, Math.round((n.situps / 35) * 7 + (n.pushups / 15) * 3)));
    const speed_strength = Math.min(10, Math.max(1, Math.round((n.long_jump_cm / 160) * 8 + 2)));
    const speedVal = n.run_30m_sec > 0
        ? Math.min(10, Math.max(1, Math.round((5.0 / n.run_30m_sec) * 8 + 2)))
        : 6;
    const coordination = Math.min(10, Math.max(1, Math.round(
        (n.target_throw / 5) * 6 + (8.5 / (n.shuttle_run_sec || 9)) * 4
    )));

    userAnswers.physical = {
        speed: speedVal,
        strength,
        coordination,
        speed_strength,
        flexibility,
        endurance
    };
}

// ====================== ТЕСТ РЕАКЦИИ ======================
function resetReactionUI() {
    if (reactionTimer) clearTimeout(reactionTimer);
    reactionStartTime = 0;
    reactionActive = false;
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");
    if (box) box.style.background = "#0077ff";
    if (prompt) prompt.textContent = "Нажмите кнопку ниже для старта";
    if (btn) btn.style.display = "inline-block";
}

document.getElementById("startReactionBtn")?.addEventListener("click", () => {
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    document.getElementById("startReactionBtn").style.display = "none";
    box.style.background = "#ff4d4f";
    prompt.textContent = "Ждите зеленый цвет...";
    reactionActive = true;
    reactionStartTime = 0;

    const delay = Math.floor(Math.random() * 2500) + 1500;
    reactionTimer = setTimeout(() => {
        box.style.background = "#52c41a";
        prompt.textContent = "ЖМИ СКОРЕЕ!";
        reactionStartTime = Date.now();
    }, delay);
});

document.getElementById("reactionBox")?.addEventListener("click", () => {
    if (!reactionActive) return;
    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (!reactionStartTime) {
        clearTimeout(reactionTimer);
        reactionActive = false;
        box.style.background = "#faad14";
        prompt.textContent = "Слишком рано! Нажмите начать снова.";
        btn.style.display = "inline-block";
        return;
    }

    const diff = Date.now() - reactionStartTime;
    userAnswers.reaction_ms = diff;
    reactionActive = false;
    box.style.background = "#0077ff";
    prompt.textContent = `Время реакции: ${diff} мс!`;

    setTimeout(() => {
        showScreen("tappingScreen");
        resetTappingUI();
    }, 1000);
});

// ====================== ТЕППИНГ-ТЕСТ ======================
function resetTappingUI() {
    if (tappingTimer) clearInterval(tappingTimer);
    squareCounts = [0, 0, 0, 0, 0, 0];
    currentSquare = 1;
    tappingTimeLeft = 30;
    tappingActive = false;

    for (let i = 1; i <= 6; i++) {
        const sq = document.getElementById(`sq${i}`);
        const cnt = document.getElementById(`sqCount${i}`);
        if (sq) sq.classList.toggle("active", i === 1);
        if (cnt) cnt.textContent = "0";
    }
    document.getElementById("tapTimer").textContent = "30";
    document.getElementById("currentSquareNum").textContent = "1";
    document.getElementById("startTapBtn").style.display = "inline-block";
}

document.getElementById("startTapBtn")?.addEventListener("click", () => {
    resetTappingUI();
    tappingActive = true;
    document.getElementById("startTapBtn").style.display = "none";

    tappingTimer = setInterval(() => {
        tappingTimeLeft--;
        document.getElementById("tapTimer").textContent = tappingTimeLeft;
        const elapsed = 30 - tappingTimeLeft;
        if (elapsed > 0 && elapsed % 5 === 0 && elapsed < 30) {
            currentSquare++;
            for (let i = 1; i <= 6; i++) {
                document.getElementById(`sq${i}`).classList.toggle("active", i === currentSquare);
            }
            document.getElementById("currentSquareNum").textContent = currentSquare;
            if (navigator.vibrate) navigator.vibrate(60);
        }

        if (tappingTimeLeft <= 0) {
            clearInterval(tappingTimer);
            tappingActive = false;
            finishTapping();
        }
    }, 1000);
});

document.querySelectorAll(".tap-square").forEach(sq => {
    sq.addEventListener("click", () => {
        if (!tappingActive) return;
        const num = parseInt(sq.getAttribute("data-sq"));
        if (num === currentSquare) {
            squareCounts[num - 1]++;
            document.getElementById(`sqCount${num}`).textContent = squareCounts[num - 1];
        }
    });
});

function finishTapping() {
    const total = squareCounts.reduce((a, b) => a + b, 0);
    const [N1, N2, N3] = squareCounts;
    let type = "Ровный тип";
    let nerveType = "Средняя сила НС";

    if (Math.max(N2, N3) > N1) {
        type = "Выпуклый тип"; nerveType = "Сильная НС";
    } else if (N2 < N1 && N3 <= N2) {
        type = "Нисходящий тип"; nerveType = "Слабая НС";
    }

    userAnswers.tapping_test = {
        nerve_type: `${nerveType} (${type})`,
        curve_type: type,
        count: total
    };

    showScreen("resultsScreen");
    document.getElementById("childResultsBlock").classList.remove("hidden");
    document.getElementById("adultResultsBlock").classList.add("hidden");
    sendDataToBackend();
}

// ====================== РЕЗУЛЬТАТЫ ДЕТЕЙ ======================
function calculateAge(birthDateString) {
    if (!birthDateString) return 8;
    const parts = birthDateString.split(".");
    if (parts.length === 3) {
        const bDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(bDate.getTime())) {
            let age = new Date().getFullYear() - bDate.getFullYear();
            return age > 0 ? age : 8;
        }
    }
    return 8;
}

function formatAiText(text) {
    if (!text) return "";
    return text
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*/g, '')
        .split('\n\n')
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

async function sendDataToBackend() {
    const nameEl = document.getElementById("resName");
    const subEl = document.getElementById("resSub");
    const aiTextEl = document.getElementById("resAiText");

    const displayName = userAnswers.first_name.trim() || "Юный спортсмен";
    if (nameEl) nameEl.textContent = displayName;
    if (subEl) subEl.textContent = `${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;
    if (aiTextEl) aiTextEl.innerHTML = "<p style='color:#0077ff;font-weight:bold;'>Бельчонок СТАС рассчитывает профиль...</p>";

    updateSkillBars();

    const payload = {
        full_name: displayName,
        age: calculateAge(userAnswers.birth_date),
        sex: userAnswers.sex,
        height_cm: parseFloat(userAnswers.height_cm),
        weight_kg: parseFloat(userAnswers.weight_kg),
        father_height_cm: parseFloat(userAnswers.father_height_cm),
        mother_height_cm: parseFloat(userAnswers.mother_height_cm),
        physical: userAnswers.physical,
        normatives: useNormsMode ? userAnswers.normatives : null,
        temperament: userAnswers.temperament,
        reaction_ms: userAnswers.reaction_ms,
        nerve_type: userAnswers.tapping_test.nerve_type
    };

    try {
        const res = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        lastAnalysisResult = data;

        if (aiTextEl && data.ai_text) {
            aiTextEl.innerHTML = formatAiText(data.ai_text);
        }
        renderChildDashboard(data);
    } catch (e) {
        if (aiTextEl) aiTextEl.innerHTML = "<p style='color:red;'>Ошибка связи с сервером.</p>";
    }
}

function updateSkillBars() {
    const p = userAnswers.physical;
    const setBar = (valId, fillId, val) => {
        const percent = Math.min(100, Math.max(0, val * 10));
        const vEl = document.getElementById(valId);
        const fEl = document.getElementById(fillId);
        if (vEl) vEl.textContent = `${percent}%`;
        if (fEl) fEl.style.width = `${percent}%`;
    };
    setBar("barSpeedVal", "barSpeedFill", p.speed);
    setBar("barStrengthVal", "barStrengthFill", p.strength);
    setBar("barCoordVal", "barCoordFill", p.coordination);
    setBar("barSpeedStrengthVal", "barSpeedStrengthFill", p.speed_strength);
    setBar("barFlexVal", "barFlexFill", p.flexibility);
    setBar("barEnduranceVal", "barEnduranceFill", p.endurance);
}

function renderCircularGauge(score, strokeColor = "#0077ff") {
    return `
        <div class="card-left">
            <div class="circle-chart">
                <svg viewBox="0 0 36 36" class="circular-chart">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <path class="circle" stroke="${strokeColor}" stroke-dasharray="${score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                    <text x="18" y="20.35" class="percentage">${score}%</text>
                </svg>
            </div>
        </div>`;
}

function renderChildDashboard(data) {
    document.getElementById("resHeightVal").textContent = `${userAnswers.height_cm} см`;
    document.getElementById("resWeightVal").textContent = `${userAnswers.weight_kg} кг`;
    document.getElementById("resBmiVal").textContent = (userAnswers.weight_kg / Math.pow(userAnswers.height_cm / 100, 2)).toFixed(1);
    document.getElementById("resReactionVal").textContent = `${userAnswers.reaction_ms} мс`;
    document.getElementById("resTemperamentVal").textContent = temperamentRu[userAnswers.temperament] || userAnswers.temperament;
    document.getElementById("resTappingVal").textContent = userAnswers.tapping_test.nerve_type;

    if (data.predicted_adult_height) {
        document.getElementById("resTargetHeightVal").textContent = `${data.predicted_adult_height} см`;
    }

    const gridEl = document.getElementById("recommendedGrid");
    if (gridEl && data.top_sports) {
        gridEl.innerHTML = data.top_sports.map((item, idx) => {
            let strokeColor = "#0077ff";
            if (item.status_note?.includes("НП1")) strokeColor = "#10b981";
            if (item.status_note?.includes("Ранний возраст")) strokeColor = "#f59e0b";
            return `
                <div class="recommendation-card" style="border-left-color: ${strokeColor};">
                    ${renderCircularGauge(item.score, strokeColor)}
                    <div class="card-right">
                        <h4 class="rec-title">#${idx + 1} ${item.sport_name}</h4>
                        <p class="rec-org"><strong>Организация:</strong> ${item.org || ''}</p>
                        <p class="rec-note"><strong>Статус:</strong> ${item.status_note || ''}</p>
                    </div>
                </div>`;
        }).join('');
    }

    const otherGridEl = document.getElementById("otherRecommendedGrid");
    if (otherGridEl && data.other_top_sports) {
        otherGridEl.innerHTML = data.other_top_sports.map((item, idx) => `
            <div class="recommendation-card other-card" style="border-left-color: #7c3aed;">
                ${renderCircularGauge(item.score, "#7c3aed")}
                <div class="card-right">
                    <h4 class="rec-title">#${idx + 1} ${item.sport_name}</h4>
                    <p class="rec-note"><strong>Статус:</strong> ${item.status_note || ''}</p>
                </div>
            </div>`).join('');
    }
}

// ====================== РЕЗУЛЬТАТЫ ВЗРОСЛЫХ ======================
function processAdultResults() {
    const nameEl = document.getElementById("resName");
    const subEl = document.getElementById("resSub");
    const aiTextEl = document.getElementById("resAiText");
    const healthSummary = document.getElementById("adultHealthSummary");
    const recGrid = document.getElementById("adultRecommendedGrid");

    const name = userAnswers.first_name.trim() || "Друг";
    if (nameEl) nameEl.textContent = name;
    if (subEl) subEl.textContent = `${userAnswers.age} лет | ${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;

    const complaintsList = [];
    if (userAnswers.complaints.back) complaintsList.push("боли в спине");
    if (userAnswers.complaints.joints) complaintsList.push("проблемы с суставами");
    if (userAnswers.complaints.pressure) complaintsList.push("давление");
    if (userAnswers.complaints.headache) complaintsList.push("головные боли");
    if (userAnswers.complaints.heart || userAnswers.complaints.dyspnea) complaintsList.push("проблемы с сердцем/одышка");
    if (userAnswers.complaints.overweight) complaintsList.push("лишний вес");

    let aiText = `${name}, спасибо, что уделил(а) время своему здоровью!\n\n`;
    if (complaintsList.length > 0) {
        aiText += `Я учёл твои жалобы: ${complaintsList.join(", ")}. `;
    } else {
        aiText += `Отлично, что серьёзных жалоб нет. `;
    }
    aiText += `На основе возраста, уровня активности и целей я подобрал безопасные рекомендации.\n\n`;
    aiText += `Важно: при хронических заболеваниях или сильных болях обязательно проконсультируйся с врачом.`;

    if (aiTextEl) aiTextEl.innerHTML = formatAiText(aiText);

    if (healthSummary) {
        healthSummary.innerHTML = `
            <div class="info-row"><span>Возраст:</span><b>${userAnswers.age} лет</b></div>
            <div class="info-row"><span>ИМТ:</span><b>${(userAnswers.weight_kg / Math.pow(userAnswers.height_cm / 100, 2)).toFixed(1)}</b></div>
            <div class="info-row"><span>Активность:</span><b>${userAnswers.activity_level === 'low' ? 'Низкая' : userAnswers.activity_level === 'medium' ? 'Средняя' : 'Высокая'}</b></div>
            <div class="info-row"><span>Жалобы:</span><b>${complaintsList.length ? complaintsList.join(", ") : "нет"}</b></div>
        `;
    }

    const recommendations = generateAdultRecommendations();
    if (recGrid) {
        recGrid.innerHTML = recommendations.map(item => `
            <div class="recommendation-card" style="border-left-color: ${item.color};">
                <div class="card-left" style="font-size:28px;display:flex;align-items:center;justify-content:center;">${item.icon}</div>
                <div class="card-right">
                    <h4 class="rec-title">${item.title}</h4>
                    <p class="rec-note">${item.desc}</p>
                </div>
            </div>
        `).join('');
    }
}

function generateAdultRecommendations() {
    const recs = [];
    const c = userAnswers.complaints;
    const goals = userAnswers.goals || [];

    recs.push({
        icon: "🚶",
        title: "Ежедневная ходьба",
        desc: "30–60 минут в комфортном темпе. Лучший старт для любого уровня.",
        color: "#10b981"
    });

    if (c.back || goals.includes("back")) {
        recs.push({
            icon: "🧘",
            title: "ЛФК и укрепление кора",
            desc: "Упражнения на мышцы спины и живота без осевой нагрузки.",
            color: "#f59e0b"
        });
    }

    if (c.joints || c.overweight || goals.includes("weight")) {
        recs.push({
            icon: "🏊",
            title: "Плавание / аквааэробика",
            desc: "Разгружает суставы и позвоночник, сжигает калории.",
            color: "#0077ff"
        });
    }

    if (c.pressure || c.headache || goals.includes("stress")) {
        recs.push({
            icon: "🌲",
            title: "Скандинавская ходьба",
            desc: "Снижает давление, улучшает настроение, прорабатывает 90% мышц.",
            color: "#7c3aed"
        });
    }

    if (goals.includes("endurance") || userAnswers.activity_level === "low") {
        recs.push({
            icon: "🚴",
            title: "Велосипед / эллипс",
            desc: "Мягкая кардионагрузка. Начинай с 20–30 минут 3 раза в неделю.",
            color: "#0ea5e9"
        });
    }

    if (recs.length < 3) {
        recs.push({
            icon: "🏋️",
            title: "Силовые с собственным весом",
            desc: "Приседания, отжимания, планка. 2–3 раза в неделю.",
            color: "#64748b"
        });
    }

    return recs.slice(0, 5);
}

// ====================== PDF и ПЕРЕЗАПУСК ======================
document.getElementById("downloadPdfBtn")?.addEventListener("click", () => {
    window.print();
});

document.getElementById("restartBtn")?.addEventListener("click", () => {
    currentMode = null;
    useNormsMode = false;
    document.getElementById("modeChild")?.classList.remove("active");
    document.getElementById("modeAdult")?.classList.remove("active");
    document.getElementById("normsCard")?.classList.add("hidden");
    document.getElementById("normsCard")?.classList.remove("active");
    document.getElementById("startBtn").disabled = true;
    document.getElementById("startBtn").textContent = "Выберите режим";
    showScreen("welcomeScreen");
});