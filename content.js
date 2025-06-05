(async () => {
    const { allowedSites } = await chrome.storage.local.get(["allowedSites"]);
    if (
        !allowedSites ||
        !allowedSites.some((site) => location.href.startsWith(site))
    )
        return;

    const faMonths = {
        فروردین: "01",
        اردیبهشت: "02",
        خرداد: "03",
        تیر: "04",
        مرداد: "05",
        شهریور: "06",
        مهر: "07",
        آبان: "08",
        آذر: "09",
        دی: "10",
        بهمن: "11",
        اسفند: "12",
        Farvardin: "01",
        Ordibehesht: "02",
        Khordad: "03",
        Tir: "04",
        Mordad: "05",
        Shahrivar: "06",
        Mehr: "07",
        Aban: "08",
        Azar: "09",
        Dey: "10",
        Bahman: "11",
        Esfand: "12",
    };

    function cleanText(rawText) {
        return rawText
            .replace(/تکلیف/g, "")
            .replace(/مهلت:.*/g, "")
            .replace(/باز شده:.*/g, "")
            .replace(/Assignment Opened:.*/g, "")
            .replace(/Due:.*/g, "")
            .replace(/[-–—]/g, "")
            .trim();
    }

    function parsePersianDate(text) {
        // حالت فارسی
        const persianMatch = text.match(
            /(\d{1,2})\s+(فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)\s+(\d{4})(?:،\s*(\d{1,2}):(\d{2}))?/
        );
        if (persianMatch) {
            const [, day, monthFa, year, hour = "00", minute = "00"] =
                persianMatch;
            return `${year}/${faMonths[monthFa]}/${day.padStart(
                2,
                "0"
            )} | ${hour.padStart(2, "0")}:${minute}`;
        }

        // حالت انگلیسی با ماه‌های فارسی و ساعت 12 ساعته
        const englishMatch = text.match(
            /Due:\s+\w+,\s+(\d{1,2})\s+(Farvardin|Ordibehesht|Khordad|Tir|Mordad|Shahrivar|Mehr|Aban|Azar|Dey|Bahman|Esfand)\s+(\d{4}),\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i
        );
        if (englishMatch) {
            let [, day, monthEn, year, hour, minute, period] = englishMatch;
            hour = parseInt(hour, 10);
            if (period.toUpperCase() === "PM" && hour !== 12) hour += 12;
            if (period.toUpperCase() === "AM" && hour === 12) hour = 0;
            return `${year}/${faMonths[monthEn]}/${day.padStart(
                2,
                "0"
            )} | ${hour.toString().padStart(2, "0")}:${minute}`;
        }

        return null;
    }

    document.addEventListener("click", (e) => {
        const item = e.target.closest(".activity-item");
        if (!item || e.target.tagName === "A") return;

        const rawName = item.querySelector(".instancename")?.innerText;
        const name = cleanText(rawName);
        if (!name) return;

        const label =
            document.querySelector("h1.h2.mb-0")?.innerText?.trim() ||
            "بدون برچسب";

        const dateElem = [
            ...item.querySelectorAll('[data-region="activity-dates"] div'),
        ].find(
            (div) =>
                div.innerText.includes("مهلت:") ||
                div.innerText.includes("Due:")
        );
        const dateText = dateElem?.innerText;
        const parsedDate = dateText ? parsePersianDate(dateText) : null;

        if (parsedDate) {
            saveNote(name, label, parsedDate);
        } else {
            showDatePicker(name, label);
        }
    });

    document.addEventListener("mouseup", () => {
        const raw = window.getSelection().toString().trim();
        if (!raw) return;

        const text = cleanText(raw);
        const label =
            document.querySelector("h1.h2.mb-0")?.innerText?.trim() ||
            "بدون برچسب";

        const dateMatch = raw.match(/مهلت:.+|Due:.+/);
        const parsedDate = dateMatch ? parsePersianDate(dateMatch[0]) : null;

        if (parsedDate) {
            saveNote(text, label, parsedDate);
        } else {
            showDatePicker(text, label);
        }

        window.getSelection()?.removeAllRanges();
    });

    function saveNote(text, label, date) {
        chrome.storage.local.get(["notes"], ({ notes = [] }) => {
            const exists = notes.some(
                (n) => n.text === text && n.label === label && n.date === date
            );
            if (exists)
                return showToast(
                    "⚠️ این یادداشت قبلاً ثبت شده است.",
                    "#ffc107"
                );
            notes.push({ text, label, date });
            chrome.storage.local.set({ notes }, () =>
                showToast("✔ یادداشت ذخیره شد", "#28a745")
            );
        });
    }

    function showDatePicker(text, label) {
        if (document.getElementById("jalali-date-picker-overlay")) return;

        const $ = (id) => document.getElementById(id);
        const now = new Date();
        const [jy, jm, jd] = toJalali(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate()
        );

        const hh = now.getHours().toString().padStart(2, "0");
        const mm = now.getMinutes().toString().padStart(2, "0");

        const overlay = document.createElement("div");
        overlay.id = "jalali-date-picker-overlay";
        overlay.innerHTML = `
    <style>
      .picker-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        display: flex; justify-content: center; align-items: center;
        z-index: 9999; font-family: tahoma, sans-serif;
        direction: ltr;
      }
      .picker {
        background: white;
        padding: 24px 32px;
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        text-align: center;
        min-width: 280px;
      }
      .picker h3 {
        margin-bottom: 16px;
        font-size: 18px;
        color: #333;
      }
    .picker input {
      width: 70px;
      text-align: center;
      padding: 8px 6px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 16px;
      font-family: Tahoma, sans-serif;
      user-select: text;
    }
      .picker button {
        padding: 10px 18px;
        margin: 10px 6px 0;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        border: none;
        cursor: pointer;
        transition: background-color 0.3s ease;
      }
      .picker button#ok {
        background-color: #28a745;
        color: white;
      }
      .picker button#ok:hover {
        background-color: #218838;
      }
      .picker button#cancel {
        background-color: #dc3545;
        color: white;
      }
      .picker button#cancel:hover {
        background-color: #c82333;
      }
    </style>

    <div class="picker-overlay">
      <div class="picker">
        <h3>تاریخ و ساعت را وارد کنید</h3>
        <div>
          <input id="jy" type="number" min="1300" max="1500" placeholder="سال" value="${jy}">
          <input id="jm" type="number" min="1" max="12" placeholder="ماه" value="${jm}">
          <input id="jd" type="number" min="1" max="31" placeholder="روز" value="${jd}">
        </div>
        <div style="margin-top: 10px;">
          <input id="hh" type="number" min="0" max="23" placeholder="ساعت" value="${hh}">
          <input id="mm" type="number" min="0" max="59" placeholder="دقیقه" value="${mm}">
        </div>
        <div>
          <button id="ok">تایید</button>
          <button id="cancel">انصراف</button>
        </div>
      </div>
    </div>
  `;

        document.body.appendChild(overlay);

        $("ok").onclick = () => {
            const y = $("jy").value.padStart(4, "0");
            const m = $("jm").value.padStart(2, "0");
            const d = $("jd").value.padStart(2, "0");
            const h = $("hh").value.padStart(2, "0");
            const min = $("mm").value.padStart(2, "0");
            saveNote(text, label, `${y}/${m}/${d} | ${h}:${min}`);
            overlay.remove();
        };

        $("cancel").onclick = () => overlay.remove();
    }

    function toJalali(gy, gm, gd) {
        const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
        let jy, jm, jd;
        let gy2 = gm > 2 ? gy + 1 : gy;
        let days =
            355666 +
            365 * gy +
            Math.floor((gy2 + 3) / 4) -
            Math.floor((gy2 + 99) / 100) +
            Math.floor((gy2 + 399) / 400) +
            gd +
            g_d_m[gm - 1];
        jy = -1595 + 33 * Math.floor(days / 12053);
        days %= 12053;
        jy += 4 * Math.floor(days / 1461);
        days %= 1461;
        if (days > 365) {
            jy += Math.floor((days - 1) / 365);
            days = (days - 1) % 365;
        }
        if (days < 186) {
            jm = 1 + Math.floor(days / 31);
            jd = 1 + (days % 31);
        } else {
            jm = 7 + Math.floor((days - 186) / 30);
            jd = 1 + ((days - 186) % 30);
        }
        return [jy, jm, jd];
    }
    const [jy, jm, jd] = toJalali(
        today.getFullYear(),
        today.getMonth() + 1,
        today.getDate()
    );

    document.getElementById("jalali-year").value = jy;
    document.getElementById("jalali-month").value = jm;
    document.getElementById("jalali-day").value = jd;
    document.getElementById("hour").value = today.getHours();
    document.getElementById("minute").value = today.getMinutes();

    const removeOverlay = () => {
        const ov = document.getElementById("jalali-date-picker-overlay");
        if (ov) ov.remove();
    };

    function showToast(message, bg = "#28a745") {
        const toast = document.createElement("div");
        toast.innerText = message;
        Object.assign(toast.style, {
            position: "fixed",
            bottom: "20px",
            right: "100px",
            background: bg,
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            zIndex: 10000,
            fontSize: "14px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            opacity: 1,
            transition: "opacity 1s ease-out",
        });
        document.body.appendChild(toast);
        setTimeout(() => (toast.style.opacity = "0"), 1500);
        setTimeout(() => toast.remove(), 2500);
    }
})();
