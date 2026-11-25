// ===== 지원 현황 보드 =====
// 이 파일은 브라우저 안에서만 움직여요. 입력한 내용은 이 브라우저(localStorage)에만 저장되고,
// 어디로도 전송되지 않아요.

// ----- 1. 설정값 (바꾸고 싶으면 여기서 고쳐요) -----

// 진행 상태 목록. color 는 style.css 의 CSS 변수 이름이에요.
const STATUSES = [
  { name: "지원 예정", color: "--status-plan" },
  { name: "서류 제출", color: "--status-submitted" },
  { name: "서류 합격", color: "--status-document-pass" },
  { name: "면접", color: "--status-interview" },
  { name: "최종 합격", color: "--status-final-pass" },
  { name: "불합격", color: "--status-fail" }
];
const DEFAULT_STATUS = STATUSES[0].name;
const FILTER_ALL = "전체";
const STORAGE_KEY = "applicationBoard.v1";
const URGENT_DAYS = 3; // 마감이 이 날짜 안으로 남으면 빨간색으로 보여요

// ----- 2. 화면 요소 찾기 -----
const companyInput = document.getElementById("companyInput");
const jobInput = document.getElementById("jobInput");
const deadlineInput = document.getElementById("deadlineInput");
const statusSelect = document.getElementById("statusSelect");
const memoInput = document.getElementById("memoInput");
const formMessage = document.getElementById("formMessage");
const addBtn = document.getElementById("addBtn");
const exampleBtn = document.getElementById("exampleBtn");
const summary = document.getElementById("summary");
const filterSelect = document.getElementById("filterSelect");
const boardList = document.getElementById("boardList");
const emptyMessage = document.getElementById("emptyMessage");
const storageWarning = document.getElementById("storageWarning");

// 저장된 회사 목록. 모양: [{ id, company, job, deadline, status, memo }, ...]
let items = [];

// ----- 3. 저장하고 불러오기 -----

// 브라우저에 저장된 목록을 읽어요. 읽을 수 없거나 모양이 이상하면 빈 목록으로 시작해요.
function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved.filter(function (item) {
      return item && typeof item.id === "string" && typeof item.company === "string";
    });
  } catch (e) {
    return [];
  }
}

// 목록을 브라우저에 저장해요. 저장이 막혀 있으면 경고를 보여줘요.
function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    storageWarning.hidden = true;
  } catch (e) {
    storageWarning.hidden = false;
  }
}

// ----- 4. 작은 함수들 -----

// 상태 이름으로 상태 정보를 찾아요 (모르는 이름이면 첫 번째 상태)
function findStatus(name) {
  return STATUSES.find(function (status) { return status.name === name; }) || STATUSES[0];
}

// 오늘 날짜를 "YYYY-MM-DD" 글자로 만들어요 (이 컴퓨터의 시간 기준)
function toDateText(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

// 마감일까지 남은 날짜를 숫자로 돌려줘요. 오늘이면 0, 내일이면 1, 어제면 -1
function daysLeft(deadlineText) {
  const parts = deadlineText.split("-");
  const deadline = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((deadline - todayStart) / (24 * 60 * 60 * 1000));
}

// 마감일 글자와 "빨간색으로 강조할지"를 돌려줘요
function describeDeadline(item) {
  if (!item.deadline) return { text: "마감일 미정", urgent: false };
  let text = "마감 " + item.deadline;
  let urgent = false;

  // 아직 지원 전인 회사만 D-day 를 보여줘요
  if (item.status === DEFAULT_STATUS) {
    const left = daysLeft(item.deadline);
    if (left > 0) text += " (D-" + left + ")";
    if (left === 0) text += " (오늘 마감!)";
    if (left < 0) text += " (" + Math.abs(left) + "일 지남)";
    urgent = left <= URGENT_DAYS;
  }
  return { text: text, urgent: urgent };
}

// 마감일이 빠른 순서로 정렬해요. 마감일이 없는 회사는 맨 뒤로 보내요.
function sortByDeadline(list) {
  return list.slice().sort(function (a, b) {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
}

// 겹치지 않는 번호표를 만들어요
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ----- 5. 화면 그리기 -----

// 상태 선택 목록(<select>)에 선택지를 채워요
function fillStatusOptions(select, selectedName) {
  select.textContent = "";
  STATUSES.forEach(function (status) {
    const option = document.createElement("option");
    option.value = status.name;
    option.textContent = status.name;
    option.selected = status.name === selectedName;
    select.appendChild(option);
  });
}

// "보기" 필터 선택지를 채워요 (전체 + 상태별)
function fillFilterOptions() {
  const current = filterSelect.value || FILTER_ALL;
  filterSelect.textContent = "";
  [FILTER_ALL].concat(STATUSES.map(function (s) { return s.name; })).forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === current;
    filterSelect.appendChild(option);
  });
}

// 상태별 개수 요약을 그려요
function renderSummary() {
  summary.textContent = "";
  STATUSES.forEach(function (status) {
    const count = items.filter(function (item) { return item.status === status.name; }).length;
    const chip = document.createElement("span");
    chip.className = "summary-chip";
    chip.style.background = "var(" + status.color + ")";
    chip.textContent = status.name + " " + count;
    summary.appendChild(chip);
  });
}

// 회사 하나를 그리는 카드를 만들어요
function makeItemCard(item) {
  const card = document.createElement("div");
  card.className = "board-item";
  card.style.borderLeftColor = "var(" + findStatus(item.status).color + ")";

  const top = document.createElement("div");
  top.className = "item-top";
  const titleBox = document.createElement("div");
  const company = document.createElement("p");
  company.className = "item-company";
  company.textContent = item.company;
  const job = document.createElement("p");
  job.className = "item-job";
  job.textContent = item.job || "직무 미입력";
  titleBox.appendChild(company);
  titleBox.appendChild(job);
  top.appendChild(titleBox);
  card.appendChild(top);

  const deadlineInfo = describeDeadline(item);
  const deadline = document.createElement("p");
  deadline.className = "item-deadline" + (deadlineInfo.urgent ? " urgent" : "");
  deadline.textContent = deadlineInfo.text;
  card.appendChild(deadline);

  if (item.memo) {
    const memo = document.createElement("p");
    memo.className = "item-memo";
    memo.textContent = "메모: " + item.memo;
    card.appendChild(memo);
  }

  const bottom = document.createElement("div");
  bottom.className = "item-bottom";

  // 상태를 바꾸면 바로 저장해요
  const select = document.createElement("select");
  select.setAttribute("aria-label", item.company + " 진행 상태");
  fillStatusOptions(select, item.status);
  select.addEventListener("change", function () {
    item.status = select.value;
    saveItems();
    renderBoard();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    if (!window.confirm("'" + item.company + "'을(를) 목록에서 지울까요?")) return;
    items = items.filter(function (other) { return other.id !== item.id; });
    saveItems();
    renderBoard();
  });

  bottom.appendChild(select);
  bottom.appendChild(deleteBtn);
  card.appendChild(bottom);
  return card;
}

// 요약과 목록 전체를 다시 그려요
function renderBoard() {
  renderSummary();
  boardList.textContent = "";

  const filter = filterSelect.value || FILTER_ALL;
  const shown = sortByDeadline(items).filter(function (item) {
    return filter === FILTER_ALL || item.status === filter;
  });
  shown.forEach(function (item) {
    boardList.appendChild(makeItemCard(item));
  });

  if (items.length === 0) {
    emptyMessage.textContent = "아직 추가한 회사가 없어요.";
  } else if (shown.length === 0) {
    emptyMessage.textContent = "이 상태의 회사가 없어요.";
  }
  emptyMessage.hidden = shown.length > 0;
}

// ----- 6. 단추를 눌렀을 때 -----

// "추가하기"
function onAddClick() {
  const company = companyInput.value.trim();
  if (!company) {
    formMessage.textContent = "회사명은 꼭 입력해 주세요.";
    formMessage.hidden = false;
    return;
  }
  formMessage.hidden = true;

  items.push({
    id: makeId(),
    company: company,
    job: jobInput.value.trim(),
    deadline: deadlineInput.value,
    status: statusSelect.value,
    memo: memoInput.value.trim()
  });
  saveItems();

  // 입력 칸을 비워서 다음 회사를 바로 쓸 수 있게 해요
  companyInput.value = "";
  jobInput.value = "";
  deadlineInput.value = "";
  memoInput.value = "";
  statusSelect.value = DEFAULT_STATUS;
  renderBoard();
}

// "예시 채우기": 연습용 값을 입력 칸에 넣어요 (추가는 "추가하기"를 눌러야 해요)
function onExampleClick() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  companyInput.value = "가나다전자";
  jobInput.value = "재무회계";
  deadlineInput.value = toDateText(nextWeek);
  statusSelect.value = DEFAULT_STATUS;
  memoInput.value = "자기소개서 3번 문항 다듬기";
  formMessage.hidden = true;
}

// ----- 7. 시작할 때 연결하기 -----
fillStatusOptions(statusSelect, DEFAULT_STATUS);
fillFilterOptions();
addBtn.addEventListener("click", onAddClick);
exampleBtn.addEventListener("click", onExampleClick);
filterSelect.addEventListener("change", renderBoard);
items = loadItems();
renderBoard();
