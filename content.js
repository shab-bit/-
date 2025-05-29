(async() => {
  // فقط در سایت‌های مجاز اجرا شود
  const { allowedSites } = await chrome.storage.local.get(['allowedSites']);
  if (!allowedSites || !allowedSites.some(site => window.location.href.startsWith(site))) return;

  document.addEventListener('mouseup', async() => {
    const rawSelection = window.getSelection().toString().trim();
    if (!rawSelection) return;

    const selection = rawSelection.replace(/تکلیف/g, '').trim();
    if (!selection) return;

    const labelElement = document.querySelector('h1.h2.mb-0');
    const label = labelElement ? labelElement.innerText.trim() : 'بدون برچسب';

    // اگر تاریخ تو متن هست، ذخیره کن و کار تمام
    let formattedDate = 'تاریخ یافت نشد';
    const deadlineMatch = selection.match(/مهلت:\s*[^،]*،\s*(\d{1,2})\s+(\S+)\s+(\d{4})،\s*(\d{1,2}):(\d{2})\s*(صبح|عصر)/);

    if (deadlineMatch) {
      const day = parseInt(deadlineMatch[1]);
      const monthName = deadlineMatch[2];
      const year = parseInt(deadlineMatch[3]);
      let hour = parseInt(deadlineMatch[4]);
      const minute = deadlineMatch[5].padStart(2, '0');
      const period = deadlineMatch[6];

      if (period === 'عصر' && hour < 12) hour += 12;
      if (period === 'صبح' && hour === 12) hour = 0;

      const faMonths = {
        'فروردین': '1', 'اردیبهشت': '2', 'خرداد': '3',
        'تیر': '4', 'مرداد': '5', 'شهریور': '6',
        'مهر': '7', 'آبان': '8', 'آذر': '9',
        'دی': '10', 'بهمن': '11', 'اسفند': '12'
      };

      const month = faMonths[monthName] || '0';
      const paddedMonth = month.padStart(2, '0');
      const paddedDay = day.toString().padStart(2, '0');
      const paddedHour = hour.toString().padStart(2, '0');

      formattedDate = `${year}/${paddedMonth}/${paddedDay} | ${paddedHour}:${minute}`;
      
      saveNote(selection, label, formattedDate);
      return;
    }

    // اگر تاریخ نبود، پنجره انتخاب تاریخ رو باز کن
    showSimpleJalaliDateTimePicker(selection, label);

    window.getSelection()?.removeAllRanges(); // حذف انتخاب
  });

  function saveNote(text, label, date) {
    chrome.storage.local.get(['notes'], (result) => {
      const existingNotes = result.notes || [];
      const isDuplicate = existingNotes.some(note =>
        note.text === text && note.label === label && note.date === date
      );
      if (isDuplicate){
        window.getSelection()?.removeAllRanges(); // حذف انتخاب ;
        return;
      }

      existingNotes.push({ text, label, date });
      chrome.storage.local.set({ notes: existingNotes }, () => {
        showToast('✔ یادداشت ذخیره شد', '#28a745');
      });
    });

    window.getSelection()?.removeAllRanges(); // حذف انتخاب
  }

  function showSimpleJalaliDateTimePicker(text, label) {
    if (document.getElementById('jalali-date-picker-overlay')) {
      // اگر پنجره قبلی هنوز بازه از ایجاد دوباره جلوگیری کن
      return;
    }

    // ایجاد overlay
    const overlay = document.createElement('div');
    overlay.id = 'jalali-date-picker-overlay';
    overlay.style = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.3); display: flex; justify-content: center; align-items: center;
      z-index: 99999; direction: rtl; font-family: Tahoma, sans-serif;
    `;

    // ساخت جعبه انتخاب تاریخ و ساعت
    const box = document.createElement('div');
    box.style = `
      background: white; padding: 20px 25px; border-radius: 10px;
      box-shadow: 0 0 10px rgba(0,0,0,0.25); width: 300px;
    `;

    box.innerHTML = `
  <style>
    .jalali-picker input {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      width: 70px;
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 6px;
      background-color: #f9f9f9;
      box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
      direction: rtl;
    }

    .jalali-picker input::-webkit-outer-spin-button,
    .jalali-picker input::-webkit-inner-spin-button {
      opacity: 1;
      margin-left: 5px;
    }

    .jalali-picker h3 {
      margin: 0 0 15px 0;
      font-size: 18px;
    }

    .jalali-picker .row {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 15px;
    }

    .jalali-picker button {
      padding: 8px 22px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
      transition: background 0.3s;
    }

    .jalali-picker #btn-ok {
      background: #28a745;
      color: white;
    }

    .jalali-picker #btn-ok:hover {
      background: #218838;
    }

    .jalali-picker #btn-cancel {
      background: #e0e0e0;
      color: #333;
    }

    .jalali-picker #btn-cancel:hover {
      background: #d0d0d0;
    }
  </style>

  <div class="jalali-picker">
    <h3>انتخاب تاریخ شمسی و ساعت</h3>

    <div class="row">
      <input id="jalali-day" type="number" placeholder="روز" min="1" max="31">
      <input id="jalali-month" type="number" placeholder="ماه" min="1" max="12">
      <input id="jalali-year" type="number" placeholder="سال" min="1300" max="1500">
    </div>

    <div class="row">
      <input id="minute" type="number" placeholder="دقیقه" min="0" max="59">
      <span style="align-self: center;">:</span>
      <input id="hour" type="number" placeholder="ساعت" min="0" max="23">
    </div>

    <div style="text-align: center;">
      <button id="btn-ok">تایید</button>
      <button id="btn-cancel">انصراف</button>
    </div>
  </div>
`;


    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // مقداردهی اولیه به امروز شمسی و ساعت کنونی
    const today = new Date();
    function toJalali(gy, gm, gd) {
      const g_d_m = [0,31,59,90,120,151,181,212,243,273,304,334];
      let jy, jm, jd;
      let gy2 = (gm > 2) ? (gy + 1) : gy;
      let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
      jy = -1595 + (33 * Math.floor(days / 12053));
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
    const [jy, jm, jd] = toJalali(today.getFullYear(), today.getMonth()+1, today.getDate());

    document.getElementById('jalali-year').value = jy;
    document.getElementById('jalali-month').value = jm;
    document.getElementById('jalali-day').value = jd;
    document.getElementById('hour').value = today.getHours();
    document.getElementById('minute').value = today.getMinutes();

    const removeOverlay = () => {
      const ov = document.getElementById('jalali-date-picker-overlay');
      if (ov) ov.remove();
    };

    document.getElementById('btn-ok').onclick = () => {
      const y = document.getElementById('jalali-year').value.trim();
      const m = document.getElementById('jalali-month').value.trim();
      const d = document.getElementById('jalali-day').value.trim();
      let h = document.getElementById('hour').value.trim();
      let min = document.getElementById('minute').value.trim();

      if (!y || y < 1300 || y > 1500) {
        alert('سال را درست وارد کنید (بین ۱۳۰۰ تا ۱۵۰۰)');
        return;
      }
      if (!m || m < 1 || m > 12) {
        alert('ماه را بین 1 تا 12 وارد کنید');
        return;
      }
      if (!d || d < 1 || d > 31) {
        alert('روز را بین 1 تا 31 وارد کنید');
        return;
      }
      if (!h || h < 0 || h > 23) {
        alert('ساعت را بین 0 تا 23 وارد کنید');
        return;
      }
      if (!min || min < 0 || min > 59) {
        alert('دقیقه را بین 0 تا 59 وارد کنید');
        return;
      }

      h = h.padStart ? h.padStart(2, '0') : ('0' + h).slice(-2);
      min = min.padStart ? min.padStart(2, '0') : ('0' + min).slice(-2);
      const formatted = `${y}/${m.padStart(2,'0')}/${d.padStart(2,'0')} | ${h}:${min}`;

      saveNote(text, label, formatted);
      removeOverlay();
    };

    document.getElementById('btn-cancel').onclick = () => {
      removeOverlay();
    };
  }

  function showToast(message, background = '#28a745') {
    const toast = document.createElement('div');
    toast.innerText = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      right: '100px',
      background,
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '6px',
      zIndex: 10000,
      fontSize: '14px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
      opacity: 1,
      transition: 'opacity 1s ease-out'
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', 1500);
    setTimeout(() => toast.remove(), 2500);
  }
})();
