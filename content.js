(async () => {
  // فقط در سایت‌های مجاز اجرا شود
  const { allowedSites } = await chrome.storage.local.get(['allowedSites']);
  if (!allowedSites || !allowedSites.some(site => window.location.href.startsWith(site))) return;

  document.addEventListener('mouseup', async () => {
    const rawSelection = window.getSelection().toString().trim();
    if (!rawSelection) return;

    const selection = rawSelection.replace(/تکلیف/g, '').trim();
    if (!selection) return;

    const labelElement = document.querySelector('h1.h2.mb-0');
    const label = labelElement ? labelElement.innerText.trim() : 'بدون برچسب';

    // --- استخراج تاریخ و ساعت مهلت ---
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
    }

    // --- بررسی تکراری بودن یادداشت ---
    const { notes } = await chrome.storage.local.get(['notes']);
    const existingNotes = notes || [];

    const isDuplicate = existingNotes.some(note =>
      note.text === selection && note.label === label && note.date === formattedDate
    );

    if (isDuplicate) {
      return;
    }

    // --- ذخیره یادداشت جدید ---
    existingNotes.push({ text: selection, label, date: formattedDate });
    await chrome.storage.local.set({ notes: existingNotes });

    showToast('✔ یادداشت ذخیره شد', '#28a745'); // سبز
  });

  // --- تابع نمایش اعلان ---
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
