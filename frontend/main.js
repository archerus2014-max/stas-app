import bridge from '@vkontakte/vk-bridge';
import html2pdf from 'html2pdf.js';

const API_URL = "https://sportivnyj-agent-archerus.amvera.io";

bridge.send("VKWebAppInit")
    .then(() => bridge.send("VKWebAppHideLoadingScreen"))
    .catch((err) => console.log("VK Bridge Init:", err));

let currentQuizStep = 0;
let reactionStartTime = 0;
let reactionTimer = null;
let reactionActive = false;

let tappingTimer = null;
let tappingTimeLeft = 30;
let tappingActive = false;
let currentSquare = 1;
let squareCounts = [0, 0, 0, 0, 0, 0];

let useNormsMode = false;
let lastAnalysisResult = null;

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
        pullups: 1, flexibility_cm: 8, situps: 29,
        long_jump_cm: 134, shuttle_run_sec: 9.0, run_30m_sec: 6.0,
        pushups: 10, target_throw: 3
    },
    temperament: "sanguine",
    reaction_ms: 300,
    tapping_test: { nerve_type: "Стабильная НС", curve_type: "Ровный тип", count: 150 }
};

const skillOptions = [
    { label: "Ниже среднего / Требует развития", value: 3 },
    { label: "Средний уровень / Как у сверстников", value: 6 },
    { label: "Высокий уровень / Выделяется", value: 8 },
    { label: "Выдающийся результат", value: 10 }
];

const baseQuestions = [
    { title: "ФИО Ребенка", field: "full_name", type: "text", placeholder: "Например: Иванов Иван" },
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
    { title: "Подтягивание из виса (силовые)", avg: "Норма: 1 раз", field: "pullups", subfield: "normatives", type: "number_norm", unit: "раз", default: 1 },
    { title: "Наклон вперед стоя (гибкость)", avg: "Норма: 8 см", field: "flexibility_cm", subfield: "normatives", type: "number_norm", unit: "см", default: 8 },
    { title: "Поднимание туловища за 1 мин (выносливость)", avg: "Норма: 29 раз", field: "situps", subfield: "normatives", type: "number_norm", unit: "раз", default: 29 },
    { title: "Прыжок в длину с места", avg: "Норма: 134 см", field: "long_jump_cm", subfield: "normatives", type: "number_norm", unit: "см", default: 134 },
    { title: "Челночный бег 3х10 м", avg: "Норма: 9.0 сек", field: "shuttle_run_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 9.0 },
    { title: "Бег на 30 м", avg: "Норма: 6.0 сек", field: "run_30m_sec", subfield: "normatives", type: "number_norm", isFloat: true, unit: "сек", default: 6.0 },
    { title: "Отжимания в упоре лежа", avg: "Норма: 10 раз", field: "pushups", subfield: "normatives", type: "number_norm", unit: "раз", default: 10 },
    { title: "Метание мяча в цель (из 5)", avg: "Норма: 3", field: "target_throw", subfield: "normatives", type: "number_norm", unit: "раз", default: 3 }
];

const finalQuestions = [
    { title: "Темперамент и поведение", field: "temperament", type: "cards_options", options: [
        { label: "Сангвиник (живой, общительный)", value: "sanguine" },
        { label: "Холерик (импульсивный, быстрый)", value: "choleric" },
        { label: "Флегматик (спокойный, упорный)", value: "phlegmatic" },
        { label: "Меланхолик (чуткий, осторожный)", value: "melancholic" }
    ]}
];

let activeQuizQuestions = [];

const temperamentRu = {
    sanguine: "Сангвиник",
    choleric: "Холерик",
    phlegmatic: "Флегматик",
    melancholic: "Меланхолик"
};

bridge.send('VKWebAppGetUserInfo')
    .then((user) => {
        if (user && user.first_name) {
            userAnswers.full_name = `${user.last_name || ''} ${user.first_name}`.trim();
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

document.getElementById("modeCard")?.addEventListener("click", () => {
    useNormsMode = !useNormsMode;
    document.getElementById("modeCard").classList.toggle("active", useNormsMode);
});

document.getElementById("startQuizBtn")?.addEventListener("click", () => {
    activeQuizQuestions = useNormsMode 
        ? [...baseQuestions, ...normativesQuestions, ...finalQuestions]
        : [...baseQuestions, ...physicalQuestions, ...finalQuestions];
    currentQuizStep = 0;
    showScreen("quizScreen");
    renderQuestion();
});

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
        inputHtml = `<input type="number" id="quizInput" class="quiz-input" value="${currentValue || ''}">`;
    } else if (q.type === "number_norm") {
        inputHtml = `
            <div class="normative-card">
                ${q.avg ? `<p class="normative-avg">${q.avg}</p>` : ''}
                <div class="normative-input-box">
                    <input type="number" id="quizInput" class="quiz-input" value="${currentValue !== undefined ? currentValue : (q.default || '')}">
                    <span class="normative-unit">${q.unit}</span>
                </div>
            </div>
        `;
    } else if (q.type === "gender_cards") {
        const activeSex = userAnswers.sex || "female";
        inputHtml = `
            <div class="cards-select-grid">
                <div class="select-card ${activeSex === 'female' ? 'active' : ''}" data-val="female">👧 Девочка</div>
                <div class="select-card ${activeSex === 'male' ? 'active' : ''}" data-val="male">👦 Мальчик</div>
            </div>
            <input type="hidden" id="quizInput" value="${activeSex}">
        `;
    } else if (q.type === "cards_skill") {
        const curScore = userAnswers.physical[q.field] || 6;
        inputHtml = `<div class="cards-select-grid">` +
            skillOptions.map(opt => `<div class="select-card ${curScore === opt.value ? 'active' : ''}" data-val="${opt.value}">${opt.label}</div>`).join('') +
            `</div><input type="hidden" id="quizInput" value="${curScore}">`;
    } else if (q.type === "cards_options") {
        const curTemp = userAnswers.temperament || "sanguine";
        inputHtml = `<div class="cards-select-grid">` +
            q.options.map(opt => `<div class="select-card ${curTemp === opt.value ? 'active' : ''}" data-val="${opt.value}">${opt.label}</div>`).join('') +
            `</div><input type="hidden" id="quizInput" value="${curTemp}">`;
    }

    container.innerHTML = `
        <h3 class="question-title">${q.title}</h3>
        <div class="input-wrapper">${inputHtml}</div>
        <button type="button" class="btn-primary" id="nextStepBtn" style="margin-top:16px;">Далее ➔</button>
    `;

    container.querySelectorAll(".select-card").forEach(card => {
        card.addEventListener("click", () => {
            container.querySelectorAll(".select-card").forEach(c => c.classList.remove("active"));
            card.classList.add("active");
            document.getElementById("quizInput").value = card.getAttribute("data-val");
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
        if (useNormsMode) calculatePhysicalFromNorms();
        showScreen("reactionScreen");
        resetReactionUI();
    }
}

document.getElementById("prevBtn")?.addEventListener("click", () => {
    saveCurrentAnswer();
    if (currentQuizStep > 0) {
        currentQuizStep--;
        renderQuestion();
    }
});

function calculatePhysicalFromNorms() {
    const n = userAnswers.normatives;
    const strength = Math.min(10, Math.max(1, Math.round((n.pullups / 3) * 4 + (n.pushups / 15) * 4 + (n.situps / 35) * 2)));
    const flexibility = Math.min(10, Math.max(1, Math.round((n.flexibility_cm / 12) * 8 + 2)));
    const endurance = Math.min(10, Math.max(1, Math.round((n.situps / 35) * 7 + (n.pushups / 15) * 3)));
    const speed_strength = Math.min(10, Math.max(1, Math.round((n.long_jump_cm / 160) * 8 + 2)));
    const speedVal = n.run_30m_sec > 0 ? Math.min(10, Math.max(1, Math.round((5.0 / n.run_30m_sec) * 8 + 2))) : 6;
    const coordination = Math.min(10, Math.max(1, Math.round((n.target_throw / 5) * 6 + (8.5 / n.shuttle_run_sec) * 4)));

    userAnswers.physical = { speed: speedVal, strength, coordination, speed_strength, flexibility, endurance };
}

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
    sendDataToBackend();
}

function calculateAge(birthDateString) {
    if (!birthDateString) return 8;
    const parts = birthDateString.split(".");
    if (parts.length === 3) {
        const bDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        if (!isNaN(bDate.getTime())) {
            const age = new Date().getFullYear() - bDate.getFullYear();
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
    const nameEl = document.getElementById("resChildName");
    const subEl = document.getElementById("resChildAgeSex");
    const aiTextEl = document.getElementById("resAiText");

    const displayName = userAnswers.full_name.trim() || "Юный спортсмен";
    if (nameEl) nameEl.textContent = displayName;
    if (subEl) subEl.textContent = `${userAnswers.height_cm} см | ${userAnswers.weight_kg} кг`;
    if (aiTextEl) aiTextEl.innerHTML = "<p style='color: #0077ff; font-weight: bold;'>Бельчонок СТАС рассчитывает индивидуальный профиль...</p>";

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
        renderDashboard(data);
    } catch (e) {
        if (aiTextEl) aiTextEl.innerHTML = "<p style='color:red;'>Ошибка связи с сервером расчёта.</p>";
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
        </div>
    `;
}

function renderDashboard(data) {
    const gridEl = document.getElementById("recommendedGrid");
    const otherGridEl = document.getElementById("otherRecommendedGrid");

    document.getElementById("resHeightVal").textContent = `${userAnswers.height_cm} см`;
    document.getElementById("resWeightVal").textContent = `${userAnswers.weight_kg} кг`;
    document.getElementById("resBmiVal").textContent = (userAnswers.weight_kg / Math.pow(userAnswers.height_cm / 100, 2)).toFixed(1);
    document.getElementById("resReactionVal").textContent = `${userAnswers.reaction_ms} мс`;
    document.getElementById("resTemperamentVal").textContent = temperamentRu[userAnswers.temperament] || userAnswers.temperament;
    document.getElementById("resTappingVal").textContent = userAnswers.tapping_test.nerve_type;

    if (data.predicted_adult_height) {
        document.getElementById("resTargetHeightVal").textContent = `${data.predicted_adult_height} см`;
    }

    if (gridEl && data.top_sports) {
        gridEl.innerHTML = data.top_sports.map((item, idx) => {
            let strokeColor = "#0077ff";
            if (item.status_note.includes("НП1")) strokeColor = "#10b981";
            if (item.status_note.includes("Ранний возраст")) strokeColor = "#f59e0b";

            return `
                <div class="recommendation-card" style="border-left-color: ${strokeColor};">
                    ${renderCircularGauge(item.score, strokeColor)}
                    <div class="card-right">
                        <h4 class="rec-title">#${idx + 1} ${item.sport_name}</h4>
                        <p class="rec-org"><strong>Организация:</strong> ${item.org}</p>
                        <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    if (otherGridEl && data.other_top_sports) {
        otherGridEl.innerHTML = data.other_top_sports.map((item, idx) => {
            const strokeColor = "#7c3aed";
            return `
                <div class="recommendation-card other-card" style="border-left-color: ${strokeColor};">
                    ${renderCircularGauge(item.score, strokeColor)}
                    <div class="card-right">
                        <h4 class="rec-title">#${idx + 1} ${item.sport_name}</h4>
                        <p class="rec-note"><strong>Статус:</strong> ${item.status_note}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Надежное открытие и сохранение PDF на любых устройствах, включая iOS
async function handlePdfDownload() {
    const pdfBtn = document.getElementById("downloadPdfBtn");
    const originalText = pdfBtn ? pdfBtn.innerText : "📥 PDF-отчет";
    if (pdfBtn) pdfBtn.innerText = "⏳ Формирование...";

    try {
        const heightM = userAnswers.height_cm / 100;
        const bmi = parseFloat((userAnswers.weight_kg / (heightM * heightM)).toFixed(1));
        const cleanAi = lastAnalysisResult?.ai_text ? lastAnalysisResult.ai_text.replace(/\*/g, '') : "Рекомендации сформированы.";

        const pdfPayload = {
            full_name: userAnswers.full_name || "Спортсмен",
            height_cm: parseFloat(userAnswers.height_cm),
            weight_kg: parseFloat(userAnswers.weight_kg),
            bmi: bmi,
            target_height: lastAnalysisResult?.predicted_adult_height || 175.0,
            reaction_ms: parseInt(userAnswers.reaction_ms),
            temperament: temperamentRu[userAnswers.temperament] || userAnswers.temperament,
            nerve_type: userAnswers.tapping_test.nerve_type,
            ai_text: cleanAi,
            skills: userAnswers.physical,
            top_sports: lastAnalysisResult?.top_sports || []
        };

        const res = await fetch(`${API_URL}/api/generate-pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pdfPayload)
        });

        if (res.ok) {
            const data = await res.json();
            const directPdfUrl = data.url;

            // 1. Пробуем скачать через официальный нативный модуль VK Bridge
            try {
                const downloadResult = await bridge.send("VKWebAppDownloadFile", {
                    url: directPdfUrl,
                    filename: `STAS_Report_${userAnswers.full_name || 'Champion'}.pdf`
                });
                if (downloadResult && downloadResult.result) {
                    if (pdfBtn) pdfBtn.innerText = originalText;
                    return;
                }
            } catch (bridgeErr) {
                console.log("VKWebAppDownloadFile не поддержан платформой, открываем URL:", bridgeErr);
            }

            // 2. Для iOS VK App: открытие внешней ссылки с системной кнопкой 'Поделиться' / 'Сохранить в Файлы'
            try {
                await bridge.send("VKWebAppOpenUrl", { url: directPdfUrl });
                if (pdfBtn) pdfBtn.innerText = originalText;
                return;
            } catch (e) {
                // Если запуск идет из стандартного веб-браузера Safari / Chrome
                window.open(directPdfUrl, '_blank');
                if (pdfBtn) pdfBtn.innerText = originalText;
                return;
            }
        }
    } catch (e) {
        console.warn("Ошибка серверного создания PDF:", e);
    }

    // Резервный вызов системной печати/сохранения устройства
    window.print();
    if (pdfBtn) pdfBtn.innerText = originalText;
}

document.getElementById("downloadPdfBtn")?.addEventListener("click", handlePdfDownload);

document.getElementById("restartBtn")?.addEventListener("click", () => {
    showScreen("welcomeScreen");
});