// ==========================================
// 1. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ
// ==========================================

const API_URL = "https://sportivnyj-agent-archerus.amvera.io";

let currentQuizStep = 0;
let reactionStartTime = 0;
let reactionTimer = null;
let reactionActive = false;

let tappingTimer = null;
let tapCount = 0;
let tappingTimeLeft = 30;
let tappingActive = false;

let useNormsMode = false;

let userAnswers = {
    full_name: "",
    birth_date: "15.05.2016",
    sex: "female",
    height_cm: 125,
    weight_kg: 25,
    father_height_cm: 178,
    mother_height_cm: 165,
    physical: {
        speed: 6, strength: 6, coordination: 6,
        speed_strength: 6, flexibility: 6, endurance: 6
    },
    normatives: {
        pullups: 1,
        flexibility_cm: 8,
        situps: 29,
        long_jump_cm: 134,
        shuttle_run_sec: 9.0,
        run_30m_sec: 6.0,
        pushups: 10,
        target_throw: 3
    },
    temperament: "sanguine",
    reaction_ms: 300,
    tapping_test: { nerve_type: "Стабильная НС" }
};

const skillOptions = [
    { label: "Ниже среднего / Требует развития", value: 3 },
    { label: "Средний уровень / Как у большинства сверстников", value: 6 },
    { label: "Высокий уровень / Выделяется среди ровесников", value: 8 },
    { label: "Выдающийся результат / Отличная подготовка", value: 10 }
];

const baseQuestions = [
    { title: "ФИО Ребенка", field: "full_name", type: "text", placeholder: "Введите ФИО ребенка" },
    { title: "Дата рождения (ДД.ММ.ГГГГ)", field: "birth_date", type: "date_text", placeholder: "15.05.2016" },
    { title: "Пол ребенка", field: "sex", type: "gender_cards" },
    { title: "Рост ребенка (см)", field: "height_cm", type: "number", isFloat: false, default: 125 },
    { title: "Вес ребенка (кг)", field: "weight_kg", type: "number", isFloat: false, default: 25 },
    { title: "Рост отца (см)", field: "father_height_cm", type: "number", isFloat: false, default: 178 },
    { title: "Рост матери (см)", field: "mother_height_cm", type: "number", isFloat: false, default: 165 }
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
    { 
        title: "Подтягивание из виса на высокой перекладине (Силовые способности)", 
        desc: "Из положения вис хватом сверху, ноги не касаются пола. Подтянуться так, чтобы подбородок был выше перекладины, опуститься до полного выпрямления рук.",
        avg: "Усредненный показатель: 1 раз",
        field: "pullups", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз", default: 1 
    },
    { 
        title: "Наклон вперед из положения стоя на гимнастической скамье (Гибкость)", 
        desc: "Наклон вперед из положения стоя с прямыми ногами на гимнастической скамье. Выполняется с фиксацией 2 секунды.",
        avg: "Усредненный показатель: 8 см",
        field: "flexibility_cm", subfield: "normatives", type: "number_norm", isFloat: false, unit: "см", default: 8 
    },
    { 
        title: "Поднимания туловища из положения лежа на спине (Силовые и выносливость)", 
        desc: "Руки за головой в замок, ноги согнуты под 90°. Максимальное количество касаний локтями бедер за 1 минуту.",
        avg: "Усредненный показатель: 29 раз/мин",
        field: "situps", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз/мин", default: 29 
    },
    { 
        title: "Прыжок в длину с места толчком двумя ногами (Скоростно-силовые)", 
        desc: "Отталкивание двумя ногами от линии. Измерение по перпендикуляру до ближайшего следа касания любой частью тела.",
        avg: "Усредненный показатель: 134 см",
        field: "long_jump_cm", subfield: "normatives", type: "number_norm", isFloat: false, unit: "см", default: 134 
    },
    { 
        title: "Челночный бег 3х10 (Скоростные и координационные)", 
        desc: "Старт у линии, бег 10 м с пересечением линии финиша, разворот и финиш. Точность до 0,01 с.",
        avg: "Усредненный показатель: 9,0 сек",
        field: "shuttle_run_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 9.0 
    },
    { 
        title: "Бег на 30 м (Скоростные способности)", 
        desc: "Выполняется с высокого старта по прямой беговой дорожке с твердым покрытием. Результат фиксируется до 0,01 с.",
        avg: "Усредненный показатель: 6,0 сек",
        field: "run_30m_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 6.0 
    },
    { 
        title: "Сгибание и разгибание рук в упоре лежа на полу (Силовые способности)", 
        desc: "Упор лежа, руки на ширине плеч, локти не более 45°. Касание грудью пола/платформы 5 см, фиксация 1 секунда.",
        avg: "Усредненный показатель: 10 раз",
        field: "pushups", subfield: "normatives", type: "number_norm", isFloat: false, unit: "раз", default: 10 
    },
    { 
        title: "Метание теннисного мяча в цель с 6 метров (Координационные способности)", 
        desc: "Метание мяча 57 г в обруч 90 см на высоте 2 м. Предоставляется 5 попыток, зачитывается число попаданий.",
        avg: "Усредненный показатель: 3 попаданий",
        field: "target_throw", subfield: "normatives", type: "number_norm", isFloat: false, unit: "попаданий", default: 3 
    }
];

const finalQuestions = [
    { title: "Темперамент и поведение ребенка", field: "temperament", type: "cards_options", options: [
        { label: "Сангвиник (живой, подвижный, общительный)", value: "sanguine" },
        { label: "Холерик (быстрый, импульсивный, энергичный)", value: "choleric" },
        { label: "Флегматик (спокойный, хладнокровный, упрямый)", value: "phlegmatic" },
        { label: "Меланхолик (чуткий, ранимый, сдержанный)", value: "melancholic" }
    ]}
];

let activeQuizQuestions = [];

const temperamentRu = {
    sanguine: "Сангвиник",
    choleric: "Холерик",
    phlegmatic: "Флегматик",
    melancholic: "Меланхолик"
};

// ==========================================
// 2. ЗАГРУЗКА ДАННЫХ И ПРОВЕРКА СВЯЗИ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Гарантированно отображаем интерфейс при готовности DOM
    showScreen("welcomeScreen");
    fetchUserData();
    checkApiConnection();
});

function toggleNormsMode() {
    useNormsMode = !useNormsMode;
    const btn = document.getElementById("modeBtn");
    if (btn) {
        if (useNormsMode) {
            btn.classList.add("active");
            btn.textContent = "✓ Выбран режим ввода нормативов ОФП";
        } else {
            btn.classList.remove("active");
            btn.textContent = "📋 Я знаю свои результаты нормативов по физической подготовке";
        }
    }
}

function fetchUserData() {
    if (window.vkBridge && typeof window.vkBridge.send === 'function') {
        window.vkBridge.send('VKWebAppGetUserInfo')
            .then((user) => {
                if (user && user.first_name) {
                    userAnswers.full_name = `${user.first_name} ${user.last_name}`;
                }
            })
            .catch((e) => console.log("[STAS] User info mode:", e.message));
    }
}

async function checkApiConnection() {
    const statusEl = document.getElementById("apiStatus");
    try {
        const res = await fetch(`${API_URL}/health`, { method: "GET" });
        if (res.ok && statusEl) {
            statusEl.textContent = "STAS API: Подключено";
            statusEl.classList.add("connected");
        }
    } catch (e) {
        console.log("[STAS] Health check mode:", e);
    }
}

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

// ==========================================
// 3. ЛОГИКА КВИЗА
// ==========================================
function startQuiz() {
    if (useNormsMode) {
        activeQuizQuestions = [...baseQuestions, ...normativesQuestions, ...finalQuestions];
    } else {
        activeQuizQuestions = [...baseQuestions, ...physicalQuestions, ...finalQuestions];
    }
    currentQuizStep = 0;
    showScreen("quizScreen");
    renderQuestion();
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
    if (q.type === "date_text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" inputmode="numeric" placeholder="${q.placeholder || 'ДД.ММ.ГГГГ'}" maxlength="10" value="${currentValue || ''}" oninput="formatDateInput(this)">`;
    } else if (q.type === "text") {
        inputHtml = `<input type="text" id="quizInput" class="quiz-input" placeholder="${q.placeholder || ''}" value="${currentValue || ''}">`;
    } else if (q.type === "number") {
        inputHtml = `<input type="number" id="quizInput" class="quiz-input" step="1" inputmode="numeric" pattern="[0-9]*" placeholder="${q.placeholder || ''}" value="${currentValue || ''}">`;
    } else if (q.type === "number_norm") {
        const stepAttr = q.isFloat ? 'step="0.01"' : 'step="1" inputmode="numeric" pattern="[0-9]*"';
        inputHtml = `
            <div class="normative-card">
                ${q.desc ? `<p class="normative-desc">${q.desc}</p>` : ''}
                ${q.avg ? `<p class="normative-avg">${q.avg}</p>` : ''}
                <div class="normative-input-box">
                    <input type="number" id="quizInput" class="quiz-input" ${stepAttr} placeholder="Результат" value="${currentValue !== undefined ? currentValue : (q.default || '')}">
                    <span class="normative-unit">${q.unit}</span>
                </div>
            </div>
        `;
    } else if (q.type === "gender_cards") {
        const activeSex = userAnswers.sex || "female";
        inputHtml = `
            <div class="cards-select-grid">
                <div class="select-card ${activeSex === 'female' ? 'active' : ''}" onclick="selectCardOption('sex', 'female')">👧 Девочка</div>
                <div class="select-card ${activeSex === 'male' ? 'active' : ''}" onclick="selectCardOption('sex', 'male')">👦 Мальчик</div>
            </div>
            <input type="hidden" id="quizInput" value="${activeSex}">
        `;
    } else if (q.type === "cards_skill") {
        const currentScore = userAnswers.physical[q.field] || 6;
        inputHtml = `<div class="cards-select-grid">` +
            skillOptions.map(opt => `
                <div class="select-card ${currentScore === opt.value ? 'active' : ''}" onclick="selectSkillOption('${q.field}', ${opt.value})">
                    ${opt.label}
                </div>
            `).join('') + `</div><input type="hidden" id="quizInput" value="${currentScore}">`;
    } else if (q.type === "cards_options") {
        const curTemp = userAnswers.temperament || "sanguine";
        inputHtml = `<div class="cards-select-grid">` +
            q.options.map(opt => `
                <div class="select-card ${curTemp === opt.value ? 'active' : ''}" onclick="selectCardOption('${q.field}', '${opt.value}')">
                    ${opt.label}
                </div>
            `).join('') + `</div><input type="hidden" id="quizInput" value="${curTemp}">`;
    }

    container.innerHTML = `
        <h3 class="question-title">${q.title}</h3>
        <div class="input-wrapper">${inputHtml}</div>
        <button type="button" class="btn-primary" style="margin-top:20px;" onclick="nextStep()">Далее ➔</button>
    `;
    
    window.scrollTo(0, 0);
}

function selectCardOption(field, value) {
    userAnswers[field] = value;
    renderQuestion();
}

function selectSkillOption(field, value) {
    userAnswers.physical[field] = value;
    renderQuestion();
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
    const q = activeQuizQuestions[currentQuizStep];
    const input = document.getElementById("quizInput");
    if (input && q) {
        let val = input.value;
        if (q.type === "number" || q.type === "number_norm") {
            let numVal = parseFloat(val) || 0;
            if (!q.isFloat) {
                numVal = Math.round(numVal);
            }
            val = numVal;
        }
        
        if (q.subfield) {
            userAnswers[q.subfield][q.field] = val;
        } else {
            userAnswers[q.field] = val;
        }
    }
}

function nextStep() {
    saveCurrentAnswer();
    if (currentQuizStep < activeQuizQuestions.length - 1) {
        currentQuizStep++;
        renderQuestion();
    } else {
        if (useNormsMode) {
            calculatePhysicalFromNorms();
        }
        showScreen("reactionScreen");
        resetReactionTestUI();
    }
}

function prevStep() {
    saveCurrentAnswer();
    if (currentQuizStep > 0) {
        currentQuizStep--;
        renderQuestion();
    }
}

function calculatePhysicalFromNorms() {
    const n = userAnswers.normatives;

    let pullScore = (n.pullups / 3) * 4; 
    let pushScore = (n.pushups / 15) * 4;
    let situpsScore = (n.situps / 35) * 2;
    let strength = Math.min(10, Math.max(1, Math.round(pullScore + pushScore + situpsScore)));

    let flexibility = Math.min(10, Math.max(1, Math.round((n.flexibility_cm / 12) * 8 + 2)));

    let endurance = Math.min(10, Math.max(1, Math.round((n.situps / 35) * 7 + (n.pushups / 15) * 3)));

    let speed_strength = Math.min(10, Math.max(1, Math.round((n.long_jump_cm / 160) * 8 + 2)));

    let speedVal = 6;
    if (n.run_30m_sec > 0) {
        speedVal = Math.min(10, Math.max(1, Math.round((5.0 / n.run_30m_sec) * 8 + 2)));
    } else if (n.shuttle_run_sec > 0) {
        speedVal = Math.min(10, Math.max(1, Math.round((8.0 / n.shuttle_run_sec) * 8 + 2)));
    }

    let coordTarget = (n.target_throw / 5) * 6;
    let coordShuttle = (8.5 / n.shuttle_run_sec) * 4;
    let coordination = Math.min(10, Math.max(1, Math.round(coordTarget + coordShuttle)));

    userAnswers.physical = {
        speed: speedVal,
        strength: strength,
        coordination: coordination,
        speed_strength: speed_strength,
        flexibility: flexibility,
        endurance: endurance
    };
}

// ==========================================
// 4. ТЕСТ РЕАКЦИИ
// ==========================================
function resetReactionTestUI() {
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

function startReactionTest() {
    if (reactionTimer) clearTimeout(reactionTimer);

    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (btn) btn.style.display = "none";
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
}

function handleReactionClick() {
    if (!reactionActive) return;

    const box = document.getElementById("reactionBox");
    const prompt = document.getElementById("reactionPrompt");
    const btn = document.getElementById("startReactionBtn");

    if (!reactionStartTime) {
        clearTimeout(reactionTimer);
        reactionActive = false;
        box.style.background = "#faad14";
        prompt.textContent = "Слишком рано! Нажмите кнопку снова.";
        if (btn) btn.style.display = "inline-block";
        return;
    }

    const diff = Date.now() - reactionStartTime;
    userAnswers.reaction_ms = diff;
    reactionActive = false;

    box.style.background = "#0077ff";
    prompt.textContent = `Ваше время реакции: ${diff} мс! Отлично!`;

    setTimeout(() => {
        showScreen("tappingScreen");
        resetTappingTestUI();
    }, 1200);
}

// ==========================================
// 5. ТЕППИНГ-ТЕСТ
// ==========================================
function resetTappingTestUI() {
    if (tappingTimer) clearInterval(tappingTimer);
    tapCount = 0;
    tappingTimeLeft = 30;
    tappingActive = false;

    const countEl = document.getElementById("tapCountDisplay");
    const timerEl = document.getElementById("tapTimer");
    const btn = document.getElementById("startTapBtn");
    const promptText = document.getElementById("tapPromptText");

    if (countEl) countEl.textContent = "0";
    if (timerEl) timerEl.textContent = "30";
    if (btn) btn.style.display = "inline-block";
    if (promptText) promptText.textContent = "Нажмите кнопку ниже, затем кликайте сюда!";
}

function startTappingTest() {
    if (tappingTimer) clearInterval(tappingTimer);

    tapCount = 0;
    tappingTimeLeft = 30;
    tappingActive = true;

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
            tappingActive = false;
            finishTappingTest();
        }
    }, 1000);
}

function registerTap(event) {
    if (!tappingActive) return;

    tapCount++;
    const countEl = document.getElementById("tapCountDisplay");
    if (countEl) countEl.textContent = tapCount;

    const tapArea = document.getElementById("tapArea");
    if (tapArea) {
        tapArea.classList.add("tap-active");
        setTimeout(() => tapArea.classList.remove("tap-active"), 80);
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
// 6. РАСЧЕТ И ОТРИСОВКА РЕЗУЛЬТАТОВ
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

    updateSkillBars();

    const displayName = userAnswers.full_name.trim() || "Юный спортсмен";
    if (nameEl) nameEl.textContent = displayName;
    if (subEl) subEl.textContent = `${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;
    if (aiTextEl) aiTextEl.innerHTML = "<p style='color: #0077ff; font-weight: bold;'>Бельчонок СТАС проводит расчёт алгоритма...</p>";

    const payload = {
        full_name: String(displayName),
        age: parseInt(calculateAge(userAnswers.birth_date)),
        sex: String(userAnswers.sex),
        height_cm: parseFloat(userAnswers.height_cm),
        weight_kg: parseFloat(userAnswers.weight_kg),
        father_height_cm: parseFloat(userAnswers.father_height_cm),
        mother_height_cm: parseFloat(userAnswers.mother_height_cm),
        physical: userAnswers.physical,
        normatives: useNormsMode ? userAnswers.normatives : null,
        temperament: String(userAnswers.temperament),
        reaction_ms: parseInt(userAnswers.reaction_ms),
        nerve_type: String(userAnswers.tapping_test.nerve_type)
    };

    try {
        const response = await fetch(`${API_URL}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            aiTextEl.innerHTML = "<div style='color: red; padding: 10px;'>Ошибка связи с сервером.</div>";
        }
    }
}

function updateSkillBars() {
    const p = userAnswers.physical;
    const updateBar = (valId, fillId, val) => {
        const vEl = document.getElementById(valId);
        const fEl = document.getElementById(fillId);
        const percent = Math.round((val / 10) * 100);
        if (vEl) vEl.textContent = `${percent}%`;
        if (fEl) fEl.style.width = `${percent}%`;
    };

    updateBar("barSpeedVal", "barSpeedFill", p.speed);
    updateBar("barStrengthVal", "barStrengthFill", p.strength);
    updateBar("barCoordVal", "barCoordFill", p.coordination);
    updateBar("barSpeedStrengthVal", "barSpeedStrengthFill", p.speed_strength);
    updateBar("barFlexVal", "barFlexFill", p.flexibility);
    updateBar("barEnduranceVal", "barEnduranceFill", p.endurance);
}

function renderDashboard(data) {
    const gridEl = document.getElementById("recommendedGrid");
    const otherGridEl = document.getElementById("otherRecommendedGrid");
    const targetHeightEl = document.getElementById("resTargetHeightVal");
    const heightEl = document.getElementById("resHeightVal");
    const weightEl = document.getElementById("resWeightVal");
    const bmiEl = document.getElementById("resBmiVal");
    const reactionEl = document.getElementById("resReactionVal");
    const tempEl = document.getElementById("resTemperamentVal");
    const tapEl = document.getElementById("resTappingVal");

    const heightM = userAnswers.height_cm / 100;
    const bmi = (userAnswers.weight_kg / (heightM * heightM)).toFixed(1);

    if (heightEl) heightEl.textContent = `${userAnswers.height_cm} см`;
    if (weightEl) weightEl.textContent = `${userAnswers.weight_kg} кг`;
    if (bmiEl) bmiEl.textContent = `${bmi} кг/м²`;
    if (reactionEl) reactionEl.textContent = `${userAnswers.reaction_ms} мс`;
    if (tempEl) tempEl.textContent = temperamentRu[userAnswers.temperament] || userAnswers.temperament;
    if (tapEl) tapEl.textContent = userAnswers.tapping_test.nerve_type;

    if (targetHeightEl && data.predicted_adult_height) {
        targetHeightEl.textContent = `${data.predicted_adult_height} см`;
    }

    if (gridEl && data.top_sports) {
        gridEl.innerHTML = "";
        data.top_sports.forEach((item, index) => {
            let strokeColor = "#0077ff";
            if (item.status_note.includes("НП1")) strokeColor = "#10b981";
            if (item.status_note.includes("Ранний возраст")) strokeColor = "#f59e0b";

            const card = document.createElement("div");
            card.className = "recommendation-card";
            card.style.borderLeftColor = strokeColor;
            card.innerHTML = `
                <div class="card-left">
                    <div class="circle-chart">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <path class="circle" stroke="${strokeColor}" stroke-dasharray="${item.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <text x="18" y="20.35" class="percentage">${item.score}%</text>
                        </svg>
                    </div>
                </div>
                <div class="card-right">
                    <h4 class="rec-title">#${index + 1} ${item.sport_name}</h4>
                    <p class="rec-org"><strong>Организация:</strong> ${item.org}</p>
                    <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                </div>
            `;
            gridEl.appendChild(card);
        });
    }

    if (otherGridEl && data.other_top_sports) {
        otherGridEl.innerHTML = "";
        data.other_top_sports.forEach((item, index) => {
            const strokeColor = "#7c3aed";

            const card = document.createElement("div");
            card.className = "recommendation-card other-card";
            card.style.borderLeftColor = strokeColor;
            card.innerHTML = `
                <div class="card-left">
                    <div class="circle-chart">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <path class="circle" stroke="${strokeColor}" stroke-dasharray="${item.score}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                            <text x="18" y="20.35" class="percentage">${item.score}%</text>
                        </svg>
                    </div>
                </div>
                <div class="card-right">
                    <h4 class="rec-title">#${index + 1} ${item.sport_name}</h4>
                    <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                </div>
            `;
            otherGridEl.appendChild(card);
        });
    }
}

function restartQuiz() {
    showScreen("welcomeScreen");
}