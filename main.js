const currentRecordListEl = document.getElementById("current-record-list");
const pastRecordListEl = document.getElementById("past-record-list");
const currentRecordsErrorEl = document.getElementById("current-records-error");
const recordsErrorEl = document.getElementById("records-error");

function formatDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    return "알 수 없음";
  }

  return value.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(milliseconds) {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds) || milliseconds < 0) {
    return null;
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}일`);
  if (hours) parts.push(`${hours}시간`);
  if (minutes) parts.push(`${minutes}분`);
  if (!parts.length) parts.push(`${seconds}초`);
  return parts.join(" ");
}

function clearError(element) {
  if (!element) return;
  element.classList.add("hidden");
  element.textContent = "";
}

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("hidden");
}

function createRecordListItem(record, { showFailureReason = true } = {}) {
  const item = document.createElement("li");
  item.className = "record-item";

  const isFailed = Boolean(record.failed);
  const hasEnded = Boolean(record.end);
  const isActive = !isFailed && !hasEnded;

  if (isFailed) {
    item.classList.add("record-failed");
  } else if (isActive) {
    item.classList.add("record-active");
  } else {
    item.classList.add("record-completed");
  }

  const title = document.createElement("h3");
  const titleText = document.createElement("span");
  titleText.textContent = record.title ?? "이름 없는 도전";
  title.appendChild(titleText);

  const statusBadge = document.createElement("span");
  statusBadge.className = "status-badge";
  if (isFailed) {
    statusBadge.textContent = "실패";
    statusBadge.classList.add("status-failed");
  } else if (hasEnded) {
    statusBadge.textContent = "완료";
    statusBadge.classList.add("status-completed");
  } else {
    statusBadge.textContent = "진행 중";
    statusBadge.classList.add("status-active");
  }
  title.appendChild(statusBadge);
  item.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "record-meta";

  if (record.start) {
    const startDate = new Date(record.start);
    if (!Number.isNaN(startDate.valueOf())) {
      const startSpan = document.createElement("span");
      startSpan.textContent = `시작: ${formatDateTime(startDate)}`;
      meta.appendChild(startSpan);
    }
  }

  if (hasEnded) {
    const endDate = new Date(record.end);
    if (!Number.isNaN(endDate.valueOf())) {
      const endSpan = document.createElement("span");
      endSpan.textContent = `완료: ${formatDateTime(endDate)}`;
      meta.appendChild(endSpan);

      if (record.start) {
        const startDate = new Date(record.start);
        if (!Number.isNaN(startDate.valueOf())) {
          const duration = endDate.valueOf() - startDate.valueOf();
          const durationText = formatDuration(duration);
          if (durationText) {
            const durationChip = document.createElement("span");
            durationChip.className = "duration-chip";
            durationChip.textContent = durationText;
            meta.appendChild(durationChip);
          }
        }
      }
    }
  } else if (record.start && isActive) {
    const startDate = new Date(record.start);
    if (!Number.isNaN(startDate.valueOf())) {
      const duration = Date.now() - startDate.valueOf();
      const durationText = formatDuration(duration);
      if (durationText) {
        const durationChip = document.createElement("span");
        durationChip.className = "duration-chip";
        durationChip.textContent = `진행 ${durationText}`;
        meta.appendChild(durationChip);
      }
    }
  }

  if (meta.childElementCount) {
    item.appendChild(meta);
  }

  if (isFailed && showFailureReason) {
    const failureReasonText =
      typeof record.failureReason === "string" ? record.failureReason.trim() : "";
    if (failureReasonText) {
      const failureReason = document.createElement("p");
      failureReason.className = "record-failure-reason";
      failureReason.textContent = `실패 사유: ${failureReasonText}`;
      item.appendChild(failureReason);
    }
  }

  if (record.description) {
    const description = document.createElement("p");
    description.textContent = record.description;
    item.appendChild(description);
  }

  return item;
}

function renderRecordList(targetElement, records, emptyMessage, options = {}) {
  if (!targetElement) return;

  targetElement.innerHTML = "";

  if (!records.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "record-item";
    emptyItem.textContent = emptyMessage;
    targetElement.appendChild(emptyItem);
    return;
  }

  records.forEach((record) => {
    const item = createRecordListItem(record, options);
    targetElement.appendChild(item);
  });
}

async function loadRecords() {
  if (!currentRecordListEl && !pastRecordListEl) {
    return;
  }

  clearError(currentRecordsErrorEl);
  clearError(recordsErrorEl);

  try {
    const response = await fetch("records.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`(${response.status}) ${response.statusText}`);
    }

    const payload = await response.json();
    const records = Array.isArray(payload?.records) ? payload.records : [];
    const visibleRecords = records.filter((record) => !record.hidden && !record.template);

    const currentRecords = visibleRecords.filter((record) => !record.failed);
    const pastRecords = visibleRecords.filter((record) => Boolean(record.failed));

    renderRecordList(
      currentRecordListEl,
      currentRecords,
      "현재 진행 중인 도전이 없어요. records.json 파일에서 새로운 도전을 추가해보세요.",
      { showFailureReason: false }
    );

    renderRecordList(
      pastRecordListEl,
      pastRecords,
      "아직 실패한 도전 기록이 없어요.",
      { showFailureReason: true }
    );
  } catch (error) {
    const message = `기록을 불러오지 못했습니다: ${error.message}`;
    showError(currentRecordsErrorEl, message);
    showError(recordsErrorEl, message);
  }
}

function initialise() {
  loadRecords();
}

initialise();
