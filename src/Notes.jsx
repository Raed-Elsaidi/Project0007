
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import notesImage01 from '../assets/notes_image_01.jpg';
import notesImage02 from '../assets/notes_image_02.jpg';
import notesImage03 from '../assets/notes_image_03.jpg';
import notesImage04 from '../assets/notes_image_04.jpg';

// V26: notebook page images are imported as external assets to keep the JSX lightweight.
const SOUND_PATH = '/sound/03_notebook_alarm.mp3';
const PAGE_TURN_SOUND_PATH = 'data:audio/mpeg;base64,SUQzBAAAAAABCVRYWFgAAAASAAADbWFqb3JfYnJhbmQAaXNvbQBUWFhYAAAAEwAAA21pbm9yX3ZlcnNpb24ANTEyAFRYWFgAAAAkAAADY29tcGF0aWJsZV9icmFuZHMAaXNvbWlzbzJhdmMxbXA0MQBUU1NFAAAADgAAA0xhdmY2MS43LjEwMwAAAAAAAAAAAAAA//twwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAABGAABW8AAHCg4OEhUVGRwgICQnJysuLjI2OTk9QEBESEhLT1JSVlpaXWFhZGhsbG9zc3Z6en6BhYWJjIyQk5OXm56eoqWlqa2tsLS3t7u/v8LGxsnN0dHU2Njb39/j5urq7fHx9fj4/P8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAKsAAAAAAAAVvCOrwkzAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7cMQAA8AAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3LEbQPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7cMRtg8AAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVTEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+3LEbQPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQUkZdoLEXAXcBzLsGArRO3ApJk522WIzhsJawhCAnqDoB0JatRmsPROkETQENNcQAQGBYCFjIjrczjRuCESIAGTwcMGjDCenIiYZjEDz6tJxBRiSFANKiUgMAMyLZiIx1YRxGAPa1+LhYRak4hegzCGVgbabhaBCQBAGIACGYyolGQxYWLbTUAK01gg4WImauoxEUhDcFNxSxMIUlgcSOoyAYjaJ7gKCgiDispjGnkABIITaVWF+lDRIZfwvYaDLcS3B0EQzGFayfAFieZluiYpsQn6lsJEBKwyYP/7cMRtg8AAAaQAAAAgAAA0gAAABIgByIgKuVYASq6X5HnyCoS35CE0nSTVvW+W4U4YnlNu+8D2hUIOGy+FJeGkYyIHcAMQicbkQMQXpOAHTQbN5yoB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';

const EMBEDDED_NOTE_IMAGES = {
  cover1: notesImage01,
  cover2: notesImage02,
  page3: notesImage03,
  page4: notesImage04,
};

// Notebook images are imported from ./assets.

function NotebookImage({ kind, alt, style, ...props }) {
  const src = EMBEDDED_NOTE_IMAGES[kind] || '';
  if (!src) return <div style={{...style, display:'flex', alignItems:'center', justifyContent:'center', background:'#fff3fa', color:'#8a5b78', fontWeight:800}}>صورة الصفحة غير موجودة</div>;
  return <img {...props} src={src} alt={alt} style={style} />;
}

const PAGE_THEMES = [
  { bg: 'linear-gradient(145deg,#0f4c81,#1769aa)', border: '#38bdf8', accent: '#d9f7ff' },
  { bg: 'linear-gradient(145deg,#3f4c6b,#606c88)', border: '#cbd5e1', accent: '#ffffff' },
  { bg: 'linear-gradient(145deg,#273c75,#487eb0)', border: '#93c5fd', accent: '#eff6ff' },
  { bg: 'linear-gradient(145deg,#6a1b9a,#8e44ad)', border: '#e9d5ff', accent: '#ffffff' },
  { bg: 'linear-gradient(145deg,#9a3412,#c2410c)', border: '#fed7aa', accent: '#fff7ed' },
  { bg: 'linear-gradient(145deg,#166534,#15803d)', border: '#86efac', accent: '#f0fdf4' },
  { bg: 'linear-gradient(145deg,#9d174d,#be185d)', border: '#fbcfe8', accent: '#fff1f2' },
  { bg: 'linear-gradient(145deg,#0e7490,#0891b2)', border: '#a5f3fc', accent: '#ecfeff' },
];

const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫡','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💗','💓','💞','💕','💖','💘','💝','💟','❣️','💔','❤️\u200d🔥','💯','💥','💫','💦','💨','🕊️','⭐','🌟','✨','⚡','🔥','🌈','☀️','🌙','🌸','🌷','🌹','🌺','🌻','🌼','🌿','🍀','🌱','🌴','🍎','🍓','🍉','☕','🍵','🎂','🍰','👍','👎','👏','🙌','🫶','🙏','💪','🤝','👋','🤞','✌️','🤟','👌','👉','👈','☝️','✍️','💅','🎉','🎊','🎈','🎁','🏆','🥇','🎯','🚀','💡','📚','📖','📝','✏️','🖊️','🖍️','📌','📎','📒','📓','📔','📕','📗','📘','📙','🎓','🩺','🔬','🧪','🧠','❤️\u200d🩹','⏰','🔔','🔕','✅','❌','⚠️','❗','❓','💬','🔒','🔑','🏠','📅','📊','💻','📱','🖥️','🎵','🎶','🎨','✈️','🌍','☁️','🌤️','🌧️','☔','❄️','☃️','🌊','🦋','🐝'];

const FOOTER_MESSAGES = [
  '﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾',
  'قال رسول الله ﷺ: «مَن سلك طريقًا يلتمس فيه علمًا، سهّل الله له به طريقًا إلى الجنة»',
  '﴿ إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ ﴾',
  'العلمُ نور، والاجتهادُ مفتاحُ النجاح.',
  '﴿ وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ﴾',
  'خطوةٌ صغيرة كل يوم تصنع إنجازًا كبيرًا.',
  'قال رسول الله ﷺ: «خيركم من تعلم القرآن وعلمه»',
  'لا تؤجل عمل اليوم، فالتقدم يبدأ بخطوة.',
];


const AR_WEEKDAYS = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const formatNoteDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  return {
    dayName: AR_WEEKDAYS[d.getDay()],
    dateText: `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    shortDateText: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
    isoDate: d.toISOString().slice(0, 10),
  };
};

const getDisplayTitle = (p, index) => {
  if (index % 2 === 1) return 'خطتي لهذا الأسبوع';
  if (p?.title?.trim()) return p.title.trim();
  return `ملاحظة ${index + 1}`;
};

const parseWeeklyContent = (content = '') => {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__weekly === true) {
      return { goals: parsed.goals || '', tasks: parsed.tasks || '', notes: parsed.notes || '', quick: parsed.quick || '', quote: parsed.quote || '' };
    }
  } catch {}
  return { goals: '', tasks: content || '', notes: '', quick: '', quote: '' };
};

const QUOTES = [
  "﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾",
  "﴿ فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾",
  "﴿ وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ﴾",
  "﴿ إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ ﴾",
  "﴿ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ﴾",
  "قال رسول الله ﷺ: «إنما الأعمال بالنيات»",
  "قال رسول الله ﷺ: «خيركم من تعلم القرآن وعلمه»",
  "العلم نور، والاجتهاد طريق النجاح.",
  "ومن جدّ وجد، ومن زرع حصد.",
  "لكل مجتهد نصيب، ولكل خطوة أثر.",
  "لا تؤجل عمل اليوم؛ فالتقدم يبدأ بخطوة. ✨",
  "كل صباح فرصة جديدة لتبدأ من جديد. 🌷",
  "اجعل هدفك واضحًا، وخطوتك ثابتة، وقلبك مطمئنًا.",
  "Believe in yourself and keep going. 💫",
  "Small steps every day lead to big results. ✨",
  "You can do it — one page, one goal, one step at a time. 💗",
  "Progress, not perfection. 🌟",
  "Your effort today builds your tomorrow. 🌱",
  "خطوتك الصغيرة اليوم يصنع فرقًا كبيرًا غدًا.",
  "خطوتك الصغيرة اليوم يقرّبك من هدفك خطوة أخرى.",
  "خطوتك الصغيرة اليوم يستحق أن تفتخر به.",
  "خطوتك الصغيرة اليوم هو بداية جميلة لإنجاز أكبر.",
  "خطوتك الصغيرة اليوم يعلّمك شيئًا لن تنساه.",
  "خطوتك الصغيرة اليوم يجعل الطريق أوضح أمامك.",
  "خطوتك الصغيرة اليوم يبني مستقبلك بهدوء.",
  "خطوتك الصغيرة اليوم يحوّل الطموح إلى عمل.",
  "خطوتك الصغيرة اليوم يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "خطوتك الصغيرة اليوم يمنح يومك معنى جديدًا.",
  "اجتهادك في الدراسة يصنع فرقًا كبيرًا غدًا.",
  "اجتهادك في الدراسة يقرّبك من هدفك خطوة أخرى.",
  "اجتهادك في الدراسة يستحق أن تفتخر به.",
  "اجتهادك في الدراسة هو بداية جميلة لإنجاز أكبر.",
  "اجتهادك في الدراسة يعلّمك شيئًا لن تنساه.",
  "اجتهادك في الدراسة يجعل الطريق أوضح أمامك.",
  "اجتهادك في الدراسة يبني مستقبلك بهدوء.",
  "اجتهادك في الدراسة يحوّل الطموح إلى عمل.",
  "اجتهادك في الدراسة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "اجتهادك في الدراسة يمنح يومك معنى جديدًا.",
  "قراءتك لصفحة جديدة يصنع فرقًا كبيرًا غدًا.",
  "قراءتك لصفحة جديدة يقرّبك من هدفك خطوة أخرى.",
  "قراءتك لصفحة جديدة يستحق أن تفتخر به.",
  "قراءتك لصفحة جديدة هو بداية جميلة لإنجاز أكبر.",
  "قراءتك لصفحة جديدة يعلّمك شيئًا لن تنساه.",
  "قراءتك لصفحة جديدة يجعل الطريق أوضح أمامك.",
  "قراءتك لصفحة جديدة يبني مستقبلك بهدوء.",
  "قراءتك لصفحة جديدة يحوّل الطموح إلى عمل.",
  "قراءتك لصفحة جديدة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قراءتك لصفحة جديدة يمنح يومك معنى جديدًا.",
  "مراجعتك الهادئة يصنع فرقًا كبيرًا غدًا.",
  "مراجعتك الهادئة يقرّبك من هدفك خطوة أخرى.",
  "مراجعتك الهادئة يستحق أن تفتخر به.",
  "مراجعتك الهادئة هو بداية جميلة لإنجاز أكبر.",
  "مراجعتك الهادئة يعلّمك شيئًا لن تنساه.",
  "مراجعتك الهادئة يجعل الطريق أوضح أمامك.",
  "مراجعتك الهادئة يبني مستقبلك بهدوء.",
  "مراجعتك الهادئة يحوّل الطموح إلى عمل.",
  "مراجعتك الهادئة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "مراجعتك الهادئة يمنح يومك معنى جديدًا.",
  "تنظيم وقتك يصنع فرقًا كبيرًا غدًا.",
  "تنظيم وقتك يقرّبك من هدفك خطوة أخرى.",
  "تنظيم وقتك يستحق أن تفتخر به.",
  "تنظيم وقتك هو بداية جميلة لإنجاز أكبر.",
  "تنظيم وقتك يعلّمك شيئًا لن تنساه.",
  "تنظيم وقتك يجعل الطريق أوضح أمامك.",
  "تنظيم وقتك يبني مستقبلك بهدوء.",
  "تنظيم وقتك يحوّل الطموح إلى عمل.",
  "تنظيم وقتك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "تنظيم وقتك يمنح يومك معنى جديدًا.",
  "إصرارك على التعلم يصنع فرقًا كبيرًا غدًا.",
  "إصرارك على التعلم يقرّبك من هدفك خطوة أخرى.",
  "إصرارك على التعلم يستحق أن تفتخر به.",
  "إصرارك على التعلم هو بداية جميلة لإنجاز أكبر.",
  "إصرارك على التعلم يعلّمك شيئًا لن تنساه.",
  "إصرارك على التعلم يجعل الطريق أوضح أمامك.",
  "إصرارك على التعلم يبني مستقبلك بهدوء.",
  "إصرارك على التعلم يحوّل الطموح إلى عمل.",
  "إصرارك على التعلم يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "إصرارك على التعلم يمنح يومك معنى جديدًا.",
  "ثقتك بقدرتك يصنع فرقًا كبيرًا غدًا.",
  "ثقتك بقدرتك يقرّبك من هدفك خطوة أخرى.",
  "ثقتك بقدرتك يستحق أن تفتخر به.",
  "ثقتك بقدرتك هو بداية جميلة لإنجاز أكبر.",
  "ثقتك بقدرتك يعلّمك شيئًا لن تنساه.",
  "ثقتك بقدرتك يجعل الطريق أوضح أمامك.",
  "ثقتك بقدرتك يبني مستقبلك بهدوء.",
  "ثقتك بقدرتك يحوّل الطموح إلى عمل.",
  "ثقتك بقدرتك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "ثقتك بقدرتك يمنح يومك معنى جديدًا.",
  "صبرك على الطريق يصنع فرقًا كبيرًا غدًا.",
  "صبرك على الطريق يقرّبك من هدفك خطوة أخرى.",
  "صبرك على الطريق يستحق أن تفتخر به.",
  "صبرك على الطريق هو بداية جميلة لإنجاز أكبر.",
  "صبرك على الطريق يعلّمك شيئًا لن تنساه.",
  "صبرك على الطريق يجعل الطريق أوضح أمامك.",
  "صبرك على الطريق يبني مستقبلك بهدوء.",
  "صبرك على الطريق يحوّل الطموح إلى عمل.",
  "صبرك على الطريق يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "صبرك على الطريق يمنح يومك معنى جديدًا.",
  "حرصك على فهم التفاصيل يصنع فرقًا كبيرًا غدًا.",
  "حرصك على فهم التفاصيل يقرّبك من هدفك خطوة أخرى.",
  "حرصك على فهم التفاصيل يستحق أن تفتخر به.",
  "حرصك على فهم التفاصيل هو بداية جميلة لإنجاز أكبر.",
  "حرصك على فهم التفاصيل يعلّمك شيئًا لن تنساه.",
  "حرصك على فهم التفاصيل يجعل الطريق أوضح أمامك.",
  "حرصك على فهم التفاصيل يبني مستقبلك بهدوء.",
  "حرصك على فهم التفاصيل يحوّل الطموح إلى عمل.",
  "حرصك على فهم التفاصيل يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "حرصك على فهم التفاصيل يمنح يومك معنى جديدًا.",
  "محاولتك من جديد يصنع فرقًا كبيرًا غدًا.",
  "محاولتك من جديد يقرّبك من هدفك خطوة أخرى.",
  "محاولتك من جديد يستحق أن تفتخر به.",
  "محاولتك من جديد هو بداية جميلة لإنجاز أكبر.",
  "محاولتك من جديد يعلّمك شيئًا لن تنساه.",
  "محاولتك من جديد يجعل الطريق أوضح أمامك.",
  "محاولتك من جديد يبني مستقبلك بهدوء.",
  "محاولتك من جديد يحوّل الطموح إلى عمل.",
  "محاولتك من جديد يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "محاولتك من جديد يمنح يومك معنى جديدًا.",
  "كل ساعة تركّز فيها يصنع فرقًا كبيرًا غدًا.",
  "كل ساعة تركّز فيها يقرّبك من هدفك خطوة أخرى.",
  "كل ساعة تركّز فيها يستحق أن تفتخر به.",
  "كل ساعة تركّز فيها هو بداية جميلة لإنجاز أكبر.",
  "كل ساعة تركّز فيها يعلّمك شيئًا لن تنساه.",
  "كل ساعة تركّز فيها يجعل الطريق أوضح أمامك.",
  "كل ساعة تركّز فيها يبني مستقبلك بهدوء.",
  "كل ساعة تركّز فيها يحوّل الطموح إلى عمل.",
  "كل ساعة تركّز فيها يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل ساعة تركّز فيها يمنح يومك معنى جديدًا.",
  "كل سؤال تتعلم منه يصنع فرقًا كبيرًا غدًا.",
  "كل سؤال تتعلم منه يقرّبك من هدفك خطوة أخرى.",
  "كل سؤال تتعلم منه يستحق أن تفتخر به.",
  "كل سؤال تتعلم منه هو بداية جميلة لإنجاز أكبر.",
  "كل سؤال تتعلم منه يعلّمك شيئًا لن تنساه.",
  "كل سؤال تتعلم منه يجعل الطريق أوضح أمامك.",
  "كل سؤال تتعلم منه يبني مستقبلك بهدوء.",
  "كل سؤال تتعلم منه يحوّل الطموح إلى عمل.",
  "كل سؤال تتعلم منه يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل سؤال تتعلم منه يمنح يومك معنى جديدًا.",
  "كل فكرة تكتبها يصنع فرقًا كبيرًا غدًا.",
  "كل فكرة تكتبها يقرّبك من هدفك خطوة أخرى.",
  "كل فكرة تكتبها يستحق أن تفتخر به.",
  "كل فكرة تكتبها هو بداية جميلة لإنجاز أكبر.",
  "كل فكرة تكتبها يعلّمك شيئًا لن تنساه.",
  "كل فكرة تكتبها يجعل الطريق أوضح أمامك.",
  "كل فكرة تكتبها يبني مستقبلك بهدوء.",
  "كل فكرة تكتبها يحوّل الطموح إلى عمل.",
  "كل فكرة تكتبها يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل فكرة تكتبها يمنح يومك معنى جديدًا.",
  "كل معلومة تثبتها يصنع فرقًا كبيرًا غدًا.",
  "كل معلومة تثبتها يقرّبك من هدفك خطوة أخرى.",
  "كل معلومة تثبتها يستحق أن تفتخر به.",
  "كل معلومة تثبتها هو بداية جميلة لإنجاز أكبر.",
  "كل معلومة تثبتها يعلّمك شيئًا لن تنساه.",
  "كل معلومة تثبتها يجعل الطريق أوضح أمامك.",
  "كل معلومة تثبتها يبني مستقبلك بهدوء.",
  "كل معلومة تثبتها يحوّل الطموح إلى عمل.",
  "كل معلومة تثبتها يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل معلومة تثبتها يمنح يومك معنى جديدًا.",
  "كل هدف تحدده يصنع فرقًا كبيرًا غدًا.",
  "كل هدف تحدده يقرّبك من هدفك خطوة أخرى.",
  "كل هدف تحدده يستحق أن تفتخر به.",
  "كل هدف تحدده هو بداية جميلة لإنجاز أكبر.",
  "كل هدف تحدده يعلّمك شيئًا لن تنساه.",
  "كل هدف تحدده يجعل الطريق أوضح أمامك.",
  "كل هدف تحدده يبني مستقبلك بهدوء.",
  "كل هدف تحدده يحوّل الطموح إلى عمل.",
  "كل هدف تحدده يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل هدف تحدده يمنح يومك معنى جديدًا.",
  "كل عادة جيدة تبنيها يصنع فرقًا كبيرًا غدًا.",
  "كل عادة جيدة تبنيها يقرّبك من هدفك خطوة أخرى.",
  "كل عادة جيدة تبنيها يستحق أن تفتخر به.",
  "كل عادة جيدة تبنيها هو بداية جميلة لإنجاز أكبر.",
  "كل عادة جيدة تبنيها يعلّمك شيئًا لن تنساه.",
  "كل عادة جيدة تبنيها يجعل الطريق أوضح أمامك.",
  "كل عادة جيدة تبنيها يبني مستقبلك بهدوء.",
  "كل عادة جيدة تبنيها يحوّل الطموح إلى عمل.",
  "كل عادة جيدة تبنيها يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل عادة جيدة تبنيها يمنح يومك معنى جديدًا.",
  "كل صباح تبدأه بنية طيبة يصنع فرقًا كبيرًا غدًا.",
  "كل صباح تبدأه بنية طيبة يقرّبك من هدفك خطوة أخرى.",
  "كل صباح تبدأه بنية طيبة يستحق أن تفتخر به.",
  "كل صباح تبدأه بنية طيبة هو بداية جميلة لإنجاز أكبر.",
  "كل صباح تبدأه بنية طيبة يعلّمك شيئًا لن تنساه.",
  "كل صباح تبدأه بنية طيبة يجعل الطريق أوضح أمامك.",
  "كل صباح تبدأه بنية طيبة يبني مستقبلك بهدوء.",
  "كل صباح تبدأه بنية طيبة يحوّل الطموح إلى عمل.",
  "كل صباح تبدأه بنية طيبة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل صباح تبدأه بنية طيبة يمنح يومك معنى جديدًا.",
  "كل مرة تختار فيها الاستمرار يصنع فرقًا كبيرًا غدًا.",
  "كل مرة تختار فيها الاستمرار يقرّبك من هدفك خطوة أخرى.",
  "كل مرة تختار فيها الاستمرار يستحق أن تفتخر به.",
  "كل مرة تختار فيها الاستمرار هو بداية جميلة لإنجاز أكبر.",
  "كل مرة تختار فيها الاستمرار يعلّمك شيئًا لن تنساه.",
  "كل مرة تختار فيها الاستمرار يجعل الطريق أوضح أمامك.",
  "كل مرة تختار فيها الاستمرار يبني مستقبلك بهدوء.",
  "كل مرة تختار فيها الاستمرار يحوّل الطموح إلى عمل.",
  "كل مرة تختار فيها الاستمرار يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل مرة تختار فيها الاستمرار يمنح يومك معنى جديدًا.",
  "كل مرة تتجاوز فيها خوفك يصنع فرقًا كبيرًا غدًا.",
  "كل مرة تتجاوز فيها خوفك يقرّبك من هدفك خطوة أخرى.",
  "كل مرة تتجاوز فيها خوفك يستحق أن تفتخر به.",
  "كل مرة تتجاوز فيها خوفك هو بداية جميلة لإنجاز أكبر.",
  "كل مرة تتجاوز فيها خوفك يعلّمك شيئًا لن تنساه.",
  "كل مرة تتجاوز فيها خوفك يجعل الطريق أوضح أمامك.",
  "كل مرة تتجاوز فيها خوفك يبني مستقبلك بهدوء.",
  "كل مرة تتجاوز فيها خوفك يحوّل الطموح إلى عمل.",
  "كل مرة تتجاوز فيها خوفك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل مرة تتجاوز فيها خوفك يمنح يومك معنى جديدًا.",
  "كل دقيقة تستثمرها في نفسك يصنع فرقًا كبيرًا غدًا.",
  "كل دقيقة تستثمرها في نفسك يقرّبك من هدفك خطوة أخرى.",
  "كل دقيقة تستثمرها في نفسك يستحق أن تفتخر به.",
  "كل دقيقة تستثمرها في نفسك هو بداية جميلة لإنجاز أكبر.",
  "كل دقيقة تستثمرها في نفسك يعلّمك شيئًا لن تنساه.",
  "كل دقيقة تستثمرها في نفسك يجعل الطريق أوضح أمامك.",
  "كل دقيقة تستثمرها في نفسك يبني مستقبلك بهدوء.",
  "كل دقيقة تستثمرها في نفسك يحوّل الطموح إلى عمل.",
  "كل دقيقة تستثمرها في نفسك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "كل دقيقة تستثمرها في نفسك يمنح يومك معنى جديدًا.",
  "قلبك المتفائل يصنع فرقًا كبيرًا غدًا.",
  "قلبك المتفائل يقرّبك من هدفك خطوة أخرى.",
  "قلبك المتفائل يستحق أن تفتخر به.",
  "قلبك المتفائل هو بداية جميلة لإنجاز أكبر.",
  "قلبك المتفائل يعلّمك شيئًا لن تنساه.",
  "قلبك المتفائل يجعل الطريق أوضح أمامك.",
  "قلبك المتفائل يبني مستقبلك بهدوء.",
  "قلبك المتفائل يحوّل الطموح إلى عمل.",
  "قلبك المتفائل يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قلبك المتفائل يمنح يومك معنى جديدًا.",
  "عقلك المتعلم يصنع فرقًا كبيرًا غدًا.",
  "عقلك المتعلم يقرّبك من هدفك خطوة أخرى.",
  "عقلك المتعلم يستحق أن تفتخر به.",
  "عقلك المتعلم هو بداية جميلة لإنجاز أكبر.",
  "عقلك المتعلم يعلّمك شيئًا لن تنساه.",
  "عقلك المتعلم يجعل الطريق أوضح أمامك.",
  "عقلك المتعلم يبني مستقبلك بهدوء.",
  "عقلك المتعلم يحوّل الطموح إلى عمل.",
  "عقلك المتعلم يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "عقلك المتعلم يمنح يومك معنى جديدًا.",
  "روحك المجتهدة يصنع فرقًا كبيرًا غدًا.",
  "روحك المجتهدة يقرّبك من هدفك خطوة أخرى.",
  "روحك المجتهدة يستحق أن تفتخر به.",
  "روحك المجتهدة هو بداية جميلة لإنجاز أكبر.",
  "روحك المجتهدة يعلّمك شيئًا لن تنساه.",
  "روحك المجتهدة يجعل الطريق أوضح أمامك.",
  "روحك المجتهدة يبني مستقبلك بهدوء.",
  "روحك المجتهدة يحوّل الطموح إلى عمل.",
  "روحك المجتهدة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "روحك المجتهدة يمنح يومك معنى جديدًا.",
  "رغبتك في التطور يصنع فرقًا كبيرًا غدًا.",
  "رغبتك في التطور يقرّبك من هدفك خطوة أخرى.",
  "رغبتك في التطور يستحق أن تفتخر به.",
  "رغبتك في التطور هو بداية جميلة لإنجاز أكبر.",
  "رغبتك في التطور يعلّمك شيئًا لن تنساه.",
  "رغبتك في التطور يجعل الطريق أوضح أمامك.",
  "رغبتك في التطور يبني مستقبلك بهدوء.",
  "رغبتك في التطور يحوّل الطموح إلى عمل.",
  "رغبتك في التطور يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "رغبتك في التطور يمنح يومك معنى جديدًا.",
  "شغفك بالمعرفة يصنع فرقًا كبيرًا غدًا.",
  "شغفك بالمعرفة يقرّبك من هدفك خطوة أخرى.",
  "شغفك بالمعرفة يستحق أن تفتخر به.",
  "شغفك بالمعرفة هو بداية جميلة لإنجاز أكبر.",
  "شغفك بالمعرفة يعلّمك شيئًا لن تنساه.",
  "شغفك بالمعرفة يجعل الطريق أوضح أمامك.",
  "شغفك بالمعرفة يبني مستقبلك بهدوء.",
  "شغفك بالمعرفة يحوّل الطموح إلى عمل.",
  "شغفك بالمعرفة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "شغفك بالمعرفة يمنح يومك معنى جديدًا.",
  "هدوءك وقت الضغط يصنع فرقًا كبيرًا غدًا.",
  "هدوءك وقت الضغط يقرّبك من هدفك خطوة أخرى.",
  "هدوءك وقت الضغط يستحق أن تفتخر به.",
  "هدوءك وقت الضغط هو بداية جميلة لإنجاز أكبر.",
  "هدوءك وقت الضغط يعلّمك شيئًا لن تنساه.",
  "هدوءك وقت الضغط يجعل الطريق أوضح أمامك.",
  "هدوءك وقت الضغط يبني مستقبلك بهدوء.",
  "هدوءك وقت الضغط يحوّل الطموح إلى عمل.",
  "هدوءك وقت الضغط يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "هدوءك وقت الضغط يمنح يومك معنى جديدًا.",
  "استمرارك رغم التعب يصنع فرقًا كبيرًا غدًا.",
  "استمرارك رغم التعب يقرّبك من هدفك خطوة أخرى.",
  "استمرارك رغم التعب يستحق أن تفتخر به.",
  "استمرارك رغم التعب هو بداية جميلة لإنجاز أكبر.",
  "استمرارك رغم التعب يعلّمك شيئًا لن تنساه.",
  "استمرارك رغم التعب يجعل الطريق أوضح أمامك.",
  "استمرارك رغم التعب يبني مستقبلك بهدوء.",
  "استمرارك رغم التعب يحوّل الطموح إلى عمل.",
  "استمرارك رغم التعب يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "استمرارك رغم التعب يمنح يومك معنى جديدًا.",
  "التزامك بخطتك يصنع فرقًا كبيرًا غدًا.",
  "التزامك بخطتك يقرّبك من هدفك خطوة أخرى.",
  "التزامك بخطتك يستحق أن تفتخر به.",
  "التزامك بخطتك هو بداية جميلة لإنجاز أكبر.",
  "التزامك بخطتك يعلّمك شيئًا لن تنساه.",
  "التزامك بخطتك يجعل الطريق أوضح أمامك.",
  "التزامك بخطتك يبني مستقبلك بهدوء.",
  "التزامك بخطتك يحوّل الطموح إلى عمل.",
  "التزامك بخطتك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "التزامك بخطتك يمنح يومك معنى جديدًا.",
  "اهتمامك بالتفاصيل يصنع فرقًا كبيرًا غدًا.",
  "اهتمامك بالتفاصيل يقرّبك من هدفك خطوة أخرى.",
  "اهتمامك بالتفاصيل يستحق أن تفتخر به.",
  "اهتمامك بالتفاصيل هو بداية جميلة لإنجاز أكبر.",
  "اهتمامك بالتفاصيل يعلّمك شيئًا لن تنساه.",
  "اهتمامك بالتفاصيل يجعل الطريق أوضح أمامك.",
  "اهتمامك بالتفاصيل يبني مستقبلك بهدوء.",
  "اهتمامك بالتفاصيل يحوّل الطموح إلى عمل.",
  "اهتمامك بالتفاصيل يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "اهتمامك بالتفاصيل يمنح يومك معنى جديدًا.",
  "تركيزك على الأولويات يصنع فرقًا كبيرًا غدًا.",
  "تركيزك على الأولويات يقرّبك من هدفك خطوة أخرى.",
  "تركيزك على الأولويات يستحق أن تفتخر به.",
  "تركيزك على الأولويات هو بداية جميلة لإنجاز أكبر.",
  "تركيزك على الأولويات يعلّمك شيئًا لن تنساه.",
  "تركيزك على الأولويات يجعل الطريق أوضح أمامك.",
  "تركيزك على الأولويات يبني مستقبلك بهدوء.",
  "تركيزك على الأولويات يحوّل الطموح إلى عمل.",
  "تركيزك على الأولويات يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "تركيزك على الأولويات يمنح يومك معنى جديدًا.",
  "اختيارك أن تبدأ يصنع فرقًا كبيرًا غدًا.",
  "اختيارك أن تبدأ يقرّبك من هدفك خطوة أخرى.",
  "اختيارك أن تبدأ يستحق أن تفتخر به.",
  "اختيارك أن تبدأ هو بداية جميلة لإنجاز أكبر.",
  "اختيارك أن تبدأ يعلّمك شيئًا لن تنساه.",
  "اختيارك أن تبدأ يجعل الطريق أوضح أمامك.",
  "اختيارك أن تبدأ يبني مستقبلك بهدوء.",
  "اختيارك أن تبدأ يحوّل الطموح إلى عمل.",
  "اختيارك أن تبدأ يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "اختيارك أن تبدأ يمنح يومك معنى جديدًا.",
  "قدرتك على التعلم من الخطأ يصنع فرقًا كبيرًا غدًا.",
  "قدرتك على التعلم من الخطأ يقرّبك من هدفك خطوة أخرى.",
  "قدرتك على التعلم من الخطأ يستحق أن تفتخر به.",
  "قدرتك على التعلم من الخطأ هو بداية جميلة لإنجاز أكبر.",
  "قدرتك على التعلم من الخطأ يعلّمك شيئًا لن تنساه.",
  "قدرتك على التعلم من الخطأ يجعل الطريق أوضح أمامك.",
  "قدرتك على التعلم من الخطأ يبني مستقبلك بهدوء.",
  "قدرتك على التعلم من الخطأ يحوّل الطموح إلى عمل.",
  "قدرتك على التعلم من الخطأ يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قدرتك على التعلم من الخطأ يمنح يومك معنى جديدًا.",
  "قدرتك على ترتيب أفكارك يصنع فرقًا كبيرًا غدًا.",
  "قدرتك على ترتيب أفكارك يقرّبك من هدفك خطوة أخرى.",
  "قدرتك على ترتيب أفكارك يستحق أن تفتخر به.",
  "قدرتك على ترتيب أفكارك هو بداية جميلة لإنجاز أكبر.",
  "قدرتك على ترتيب أفكارك يعلّمك شيئًا لن تنساه.",
  "قدرتك على ترتيب أفكارك يجعل الطريق أوضح أمامك.",
  "قدرتك على ترتيب أفكارك يبني مستقبلك بهدوء.",
  "قدرتك على ترتيب أفكارك يحوّل الطموح إلى عمل.",
  "قدرتك على ترتيب أفكارك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قدرتك على ترتيب أفكارك يمنح يومك معنى جديدًا.",
  "قدرتك على المحاولة يصنع فرقًا كبيرًا غدًا.",
  "قدرتك على المحاولة يقرّبك من هدفك خطوة أخرى.",
  "قدرتك على المحاولة يستحق أن تفتخر به.",
  "قدرتك على المحاولة هو بداية جميلة لإنجاز أكبر.",
  "قدرتك على المحاولة يعلّمك شيئًا لن تنساه.",
  "قدرتك على المحاولة يجعل الطريق أوضح أمامك.",
  "قدرتك على المحاولة يبني مستقبلك بهدوء.",
  "قدرتك على المحاولة يحوّل الطموح إلى عمل.",
  "قدرتك على المحاولة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قدرتك على المحاولة يمنح يومك معنى جديدًا.",
  "أملك في الغد يصنع فرقًا كبيرًا غدًا.",
  "أملك في الغد يقرّبك من هدفك خطوة أخرى.",
  "أملك في الغد يستحق أن تفتخر به.",
  "أملك في الغد هو بداية جميلة لإنجاز أكبر.",
  "أملك في الغد يعلّمك شيئًا لن تنساه.",
  "أملك في الغد يجعل الطريق أوضح أمامك.",
  "أملك في الغد يبني مستقبلك بهدوء.",
  "أملك في الغد يحوّل الطموح إلى عمل.",
  "أملك في الغد يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "أملك في الغد يمنح يومك معنى جديدًا.",
  "إيمانك بأن البداية ممكنة يصنع فرقًا كبيرًا غدًا.",
  "إيمانك بأن البداية ممكنة يقرّبك من هدفك خطوة أخرى.",
  "إيمانك بأن البداية ممكنة يستحق أن تفتخر به.",
  "إيمانك بأن البداية ممكنة هو بداية جميلة لإنجاز أكبر.",
  "إيمانك بأن البداية ممكنة يعلّمك شيئًا لن تنساه.",
  "إيمانك بأن البداية ممكنة يجعل الطريق أوضح أمامك.",
  "إيمانك بأن البداية ممكنة يبني مستقبلك بهدوء.",
  "إيمانك بأن البداية ممكنة يحوّل الطموح إلى عمل.",
  "إيمانك بأن البداية ممكنة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "إيمانك بأن البداية ممكنة يمنح يومك معنى جديدًا.",
  "سعيك نحو الأفضل يصنع فرقًا كبيرًا غدًا.",
  "سعيك نحو الأفضل يقرّبك من هدفك خطوة أخرى.",
  "سعيك نحو الأفضل يستحق أن تفتخر به.",
  "سعيك نحو الأفضل هو بداية جميلة لإنجاز أكبر.",
  "سعيك نحو الأفضل يعلّمك شيئًا لن تنساه.",
  "سعيك نحو الأفضل يجعل الطريق أوضح أمامك.",
  "سعيك نحو الأفضل يبني مستقبلك بهدوء.",
  "سعيك نحو الأفضل يحوّل الطموح إلى عمل.",
  "سعيك نحو الأفضل يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "سعيك نحو الأفضل يمنح يومك معنى جديدًا.",
  "عملك المتدرج يصنع فرقًا كبيرًا غدًا.",
  "عملك المتدرج يقرّبك من هدفك خطوة أخرى.",
  "عملك المتدرج يستحق أن تفتخر به.",
  "عملك المتدرج هو بداية جميلة لإنجاز أكبر.",
  "عملك المتدرج يعلّمك شيئًا لن تنساه.",
  "عملك المتدرج يجعل الطريق أوضح أمامك.",
  "عملك المتدرج يبني مستقبلك بهدوء.",
  "عملك المتدرج يحوّل الطموح إلى عمل.",
  "عملك المتدرج يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "عملك المتدرج يمنح يومك معنى جديدًا.",
  "تقدمك الهادئ يصنع فرقًا كبيرًا غدًا.",
  "تقدمك الهادئ يقرّبك من هدفك خطوة أخرى.",
  "تقدمك الهادئ يستحق أن تفتخر به.",
  "تقدمك الهادئ هو بداية جميلة لإنجاز أكبر.",
  "تقدمك الهادئ يعلّمك شيئًا لن تنساه.",
  "تقدمك الهادئ يجعل الطريق أوضح أمامك.",
  "تقدمك الهادئ يبني مستقبلك بهدوء.",
  "تقدمك الهادئ يحوّل الطموح إلى عمل.",
  "تقدمك الهادئ يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "تقدمك الهادئ يمنح يومك معنى جديدًا.",
  "دفتر ملاحظاتك يصنع فرقًا كبيرًا غدًا.",
  "دفتر ملاحظاتك يقرّبك من هدفك خطوة أخرى.",
  "دفتر ملاحظاتك يستحق أن تفتخر به.",
  "دفتر ملاحظاتك هو بداية جميلة لإنجاز أكبر.",
  "دفتر ملاحظاتك يعلّمك شيئًا لن تنساه.",
  "دفتر ملاحظاتك يجعل الطريق أوضح أمامك.",
  "دفتر ملاحظاتك يبني مستقبلك بهدوء.",
  "دفتر ملاحظاتك يحوّل الطموح إلى عمل.",
  "دفتر ملاحظاتك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "دفتر ملاحظاتك يمنح يومك معنى جديدًا.",
  "خطة أسبوعك يصنع فرقًا كبيرًا غدًا.",
  "خطة أسبوعك يقرّبك من هدفك خطوة أخرى.",
  "خطة أسبوعك يستحق أن تفتخر به.",
  "خطة أسبوعك هو بداية جميلة لإنجاز أكبر.",
  "خطة أسبوعك يعلّمك شيئًا لن تنساه.",
  "خطة أسبوعك يجعل الطريق أوضح أمامك.",
  "خطة أسبوعك يبني مستقبلك بهدوء.",
  "خطة أسبوعك يحوّل الطموح إلى عمل.",
  "خطة أسبوعك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "خطة أسبوعك يمنح يومك معنى جديدًا.",
  "هدفك القادم يصنع فرقًا كبيرًا غدًا.",
  "هدفك القادم يقرّبك من هدفك خطوة أخرى.",
  "هدفك القادم يستحق أن تفتخر به.",
  "هدفك القادم هو بداية جميلة لإنجاز أكبر.",
  "هدفك القادم يعلّمك شيئًا لن تنساه.",
  "هدفك القادم يجعل الطريق أوضح أمامك.",
  "هدفك القادم يبني مستقبلك بهدوء.",
  "هدفك القادم يحوّل الطموح إلى عمل.",
  "هدفك القادم يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "هدفك القادم يمنح يومك معنى جديدًا.",
  "مراجعتك اليوم يصنع فرقًا كبيرًا غدًا.",
  "مراجعتك اليوم يقرّبك من هدفك خطوة أخرى.",
  "مراجعتك اليوم يستحق أن تفتخر به.",
  "مراجعتك اليوم هو بداية جميلة لإنجاز أكبر.",
  "مراجعتك اليوم يعلّمك شيئًا لن تنساه.",
  "مراجعتك اليوم يجعل الطريق أوضح أمامك.",
  "مراجعتك اليوم يبني مستقبلك بهدوء.",
  "مراجعتك اليوم يحوّل الطموح إلى عمل.",
  "مراجعتك اليوم يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "مراجعتك اليوم يمنح يومك معنى جديدًا.",
  "وقتك الثمين يصنع فرقًا كبيرًا غدًا.",
  "وقتك الثمين يقرّبك من هدفك خطوة أخرى.",
  "وقتك الثمين يستحق أن تفتخر به.",
  "وقتك الثمين هو بداية جميلة لإنجاز أكبر.",
  "وقتك الثمين يعلّمك شيئًا لن تنساه.",
  "وقتك الثمين يجعل الطريق أوضح أمامك.",
  "وقتك الثمين يبني مستقبلك بهدوء.",
  "وقتك الثمين يحوّل الطموح إلى عمل.",
  "وقتك الثمين يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "وقتك الثمين يمنح يومك معنى جديدًا.",
  "علمك الذي ينمو يصنع فرقًا كبيرًا غدًا.",
  "علمك الذي ينمو يقرّبك من هدفك خطوة أخرى.",
  "علمك الذي ينمو يستحق أن تفتخر به.",
  "علمك الذي ينمو هو بداية جميلة لإنجاز أكبر.",
  "علمك الذي ينمو يعلّمك شيئًا لن تنساه.",
  "علمك الذي ينمو يجعل الطريق أوضح أمامك.",
  "علمك الذي ينمو يبني مستقبلك بهدوء.",
  "علمك الذي ينمو يحوّل الطموح إلى عمل.",
  "علمك الذي ينمو يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "علمك الذي ينمو يمنح يومك معنى جديدًا.",
  "فضولك الجميل يصنع فرقًا كبيرًا غدًا.",
  "فضولك الجميل يقرّبك من هدفك خطوة أخرى.",
  "فضولك الجميل يستحق أن تفتخر به.",
  "فضولك الجميل هو بداية جميلة لإنجاز أكبر.",
  "فضولك الجميل يعلّمك شيئًا لن تنساه.",
  "فضولك الجميل يجعل الطريق أوضح أمامك.",
  "فضولك الجميل يبني مستقبلك بهدوء.",
  "فضولك الجميل يحوّل الطموح إلى عمل.",
  "فضولك الجميل يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "فضولك الجميل يمنح يومك معنى جديدًا.",
  "سؤالك الذكي يصنع فرقًا كبيرًا غدًا.",
  "سؤالك الذكي يقرّبك من هدفك خطوة أخرى.",
  "سؤالك الذكي يستحق أن تفتخر به.",
  "سؤالك الذكي هو بداية جميلة لإنجاز أكبر.",
  "سؤالك الذكي يعلّمك شيئًا لن تنساه.",
  "سؤالك الذكي يجعل الطريق أوضح أمامك.",
  "سؤالك الذكي يبني مستقبلك بهدوء.",
  "سؤالك الذكي يحوّل الطموح إلى عمل.",
  "سؤالك الذكي يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "سؤالك الذكي يمنح يومك معنى جديدًا.",
  "إجابتك التي تعلمت منها يصنع فرقًا كبيرًا غدًا.",
  "إجابتك التي تعلمت منها يقرّبك من هدفك خطوة أخرى.",
  "إجابتك التي تعلمت منها يستحق أن تفتخر به.",
  "إجابتك التي تعلمت منها هو بداية جميلة لإنجاز أكبر.",
  "إجابتك التي تعلمت منها يعلّمك شيئًا لن تنساه.",
  "إجابتك التي تعلمت منها يجعل الطريق أوضح أمامك.",
  "إجابتك التي تعلمت منها يبني مستقبلك بهدوء.",
  "إجابتك التي تعلمت منها يحوّل الطموح إلى عمل.",
  "إجابتك التي تعلمت منها يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "إجابتك التي تعلمت منها يمنح يومك معنى جديدًا.",
  "تجربتك الجديدة يصنع فرقًا كبيرًا غدًا.",
  "تجربتك الجديدة يقرّبك من هدفك خطوة أخرى.",
  "تجربتك الجديدة يستحق أن تفتخر به.",
  "تجربتك الجديدة هو بداية جميلة لإنجاز أكبر.",
  "تجربتك الجديدة يعلّمك شيئًا لن تنساه.",
  "تجربتك الجديدة يجعل الطريق أوضح أمامك.",
  "تجربتك الجديدة يبني مستقبلك بهدوء.",
  "تجربتك الجديدة يحوّل الطموح إلى عمل.",
  "تجربتك الجديدة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "تجربتك الجديدة يمنح يومك معنى جديدًا.",
  "قرارك بالاستمرار يصنع فرقًا كبيرًا غدًا.",
  "قرارك بالاستمرار يقرّبك من هدفك خطوة أخرى.",
  "قرارك بالاستمرار يستحق أن تفتخر به.",
  "قرارك بالاستمرار هو بداية جميلة لإنجاز أكبر.",
  "قرارك بالاستمرار يعلّمك شيئًا لن تنساه.",
  "قرارك بالاستمرار يجعل الطريق أوضح أمامك.",
  "قرارك بالاستمرار يبني مستقبلك بهدوء.",
  "قرارك بالاستمرار يحوّل الطموح إلى عمل.",
  "قرارك بالاستمرار يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قرارك بالاستمرار يمنح يومك معنى جديدًا.",
  "ابتسامتك بعد الإنجاز يصنع فرقًا كبيرًا غدًا.",
  "ابتسامتك بعد الإنجاز يقرّبك من هدفك خطوة أخرى.",
  "ابتسامتك بعد الإنجاز يستحق أن تفتخر به.",
  "ابتسامتك بعد الإنجاز هو بداية جميلة لإنجاز أكبر.",
  "ابتسامتك بعد الإنجاز يعلّمك شيئًا لن تنساه.",
  "ابتسامتك بعد الإنجاز يجعل الطريق أوضح أمامك.",
  "ابتسامتك بعد الإنجاز يبني مستقبلك بهدوء.",
  "ابتسامتك بعد الإنجاز يحوّل الطموح إلى عمل.",
  "ابتسامتك بعد الإنجاز يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "ابتسامتك بعد الإنجاز يمنح يومك معنى جديدًا.",
  "هدوءك بعد ترتيب المهام يصنع فرقًا كبيرًا غدًا.",
  "هدوءك بعد ترتيب المهام يقرّبك من هدفك خطوة أخرى.",
  "هدوءك بعد ترتيب المهام يستحق أن تفتخر به.",
  "هدوءك بعد ترتيب المهام هو بداية جميلة لإنجاز أكبر.",
  "هدوءك بعد ترتيب المهام يعلّمك شيئًا لن تنساه.",
  "هدوءك بعد ترتيب المهام يجعل الطريق أوضح أمامك.",
  "هدوءك بعد ترتيب المهام يبني مستقبلك بهدوء.",
  "هدوءك بعد ترتيب المهام يحوّل الطموح إلى عمل.",
  "هدوءك بعد ترتيب المهام يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "هدوءك بعد ترتيب المهام يمنح يومك معنى جديدًا.",
  "خطتك الصغيرة يصنع فرقًا كبيرًا غدًا.",
  "خطتك الصغيرة يقرّبك من هدفك خطوة أخرى.",
  "خطتك الصغيرة يستحق أن تفتخر به.",
  "خطتك الصغيرة هو بداية جميلة لإنجاز أكبر.",
  "خطتك الصغيرة يعلّمك شيئًا لن تنساه.",
  "خطتك الصغيرة يجعل الطريق أوضح أمامك.",
  "خطتك الصغيرة يبني مستقبلك بهدوء.",
  "خطتك الصغيرة يحوّل الطموح إلى عمل.",
  "خطتك الصغيرة يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "خطتك الصغيرة يمنح يومك معنى جديدًا.",
  "إنجازك ولو كان بسيطًا يصنع فرقًا كبيرًا غدًا.",
  "إنجازك ولو كان بسيطًا يقرّبك من هدفك خطوة أخرى.",
  "إنجازك ولو كان بسيطًا يستحق أن تفتخر به.",
  "إنجازك ولو كان بسيطًا هو بداية جميلة لإنجاز أكبر.",
  "إنجازك ولو كان بسيطًا يعلّمك شيئًا لن تنساه.",
  "إنجازك ولو كان بسيطًا يجعل الطريق أوضح أمامك.",
  "إنجازك ولو كان بسيطًا يبني مستقبلك بهدوء.",
  "إنجازك ولو كان بسيطًا يحوّل الطموح إلى عمل.",
  "إنجازك ولو كان بسيطًا يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "إنجازك ولو كان بسيطًا يمنح يومك معنى جديدًا.",
  "تقدمك ولو كان بطيئًا يصنع فرقًا كبيرًا غدًا.",
  "تقدمك ولو كان بطيئًا يقرّبك من هدفك خطوة أخرى.",
  "تقدمك ولو كان بطيئًا يستحق أن تفتخر به.",
  "تقدمك ولو كان بطيئًا هو بداية جميلة لإنجاز أكبر.",
  "تقدمك ولو كان بطيئًا يعلّمك شيئًا لن تنساه.",
  "تقدمك ولو كان بطيئًا يجعل الطريق أوضح أمامك.",
  "تقدمك ولو كان بطيئًا يبني مستقبلك بهدوء.",
  "تقدمك ولو كان بطيئًا يحوّل الطموح إلى عمل.",
  "تقدمك ولو كان بطيئًا يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "تقدمك ولو كان بطيئًا يمنح يومك معنى جديدًا.",
  "قدرتك على البدء من الصفر يصنع فرقًا كبيرًا غدًا.",
  "قدرتك على البدء من الصفر يقرّبك من هدفك خطوة أخرى.",
  "قدرتك على البدء من الصفر يستحق أن تفتخر به.",
  "قدرتك على البدء من الصفر هو بداية جميلة لإنجاز أكبر.",
  "قدرتك على البدء من الصفر يعلّمك شيئًا لن تنساه.",
  "قدرتك على البدء من الصفر يجعل الطريق أوضح أمامك.",
  "قدرتك على البدء من الصفر يبني مستقبلك بهدوء.",
  "قدرتك على البدء من الصفر يحوّل الطموح إلى عمل.",
  "قدرتك على البدء من الصفر يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "قدرتك على البدء من الصفر يمنح يومك معنى جديدًا.",
  "رغبتك في تحسين نفسك يصنع فرقًا كبيرًا غدًا.",
  "رغبتك في تحسين نفسك يقرّبك من هدفك خطوة أخرى.",
  "رغبتك في تحسين نفسك يستحق أن تفتخر به.",
  "رغبتك في تحسين نفسك هو بداية جميلة لإنجاز أكبر.",
  "رغبتك في تحسين نفسك يعلّمك شيئًا لن تنساه.",
  "رغبتك في تحسين نفسك يجعل الطريق أوضح أمامك.",
  "رغبتك في تحسين نفسك يبني مستقبلك بهدوء.",
  "رغبتك في تحسين نفسك يحوّل الطموح إلى عمل.",
  "رغبتك في تحسين نفسك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "رغبتك في تحسين نفسك يمنح يومك معنى جديدًا.",
  "حرصك على مساعدة نفسك يصنع فرقًا كبيرًا غدًا.",
  "حرصك على مساعدة نفسك يقرّبك من هدفك خطوة أخرى.",
  "حرصك على مساعدة نفسك يستحق أن تفتخر به.",
  "حرصك على مساعدة نفسك هو بداية جميلة لإنجاز أكبر.",
  "حرصك على مساعدة نفسك يعلّمك شيئًا لن تنساه.",
  "حرصك على مساعدة نفسك يجعل الطريق أوضح أمامك.",
  "حرصك على مساعدة نفسك يبني مستقبلك بهدوء.",
  "حرصك على مساعدة نفسك يحوّل الطموح إلى عمل.",
  "حرصك على مساعدة نفسك يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "حرصك على مساعدة نفسك يمنح يومك معنى جديدًا.",
  "ثباتك أمام التحديات يصنع فرقًا كبيرًا غدًا.",
  "ثباتك أمام التحديات يقرّبك من هدفك خطوة أخرى.",
  "ثباتك أمام التحديات يستحق أن تفتخر به.",
  "ثباتك أمام التحديات هو بداية جميلة لإنجاز أكبر.",
  "ثباتك أمام التحديات يعلّمك شيئًا لن تنساه.",
  "ثباتك أمام التحديات يجعل الطريق أوضح أمامك.",
  "ثباتك أمام التحديات يبني مستقبلك بهدوء.",
  "ثباتك أمام التحديات يحوّل الطموح إلى عمل.",
  "ثباتك أمام التحديات يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "ثباتك أمام التحديات يمنح يومك معنى جديدًا.",
  "نظرتك الإيجابية يصنع فرقًا كبيرًا غدًا.",
  "نظرتك الإيجابية يقرّبك من هدفك خطوة أخرى.",
  "نظرتك الإيجابية يستحق أن تفتخر به.",
  "نظرتك الإيجابية هو بداية جميلة لإنجاز أكبر.",
  "نظرتك الإيجابية يعلّمك شيئًا لن تنساه.",
  "نظرتك الإيجابية يجعل الطريق أوضح أمامك.",
  "نظرتك الإيجابية يبني مستقبلك بهدوء.",
  "نظرتك الإيجابية يحوّل الطموح إلى عمل.",
  "نظرتك الإيجابية يذكّرك أن التقدم لا يحتاج إلى الكمال.",
  "نظرتك الإيجابية يمنح يومك معنى جديدًا.",
  "Your small step today can become tomorrow's breakthrough.",
  "Your small step today moves you closer to your goal.",
  "Your small step today is worth celebrating.",
  "Your small step today builds a stronger future.",
  "Your small step today turns effort into progress.",
  "Your small step today teaches you something valuable.",
  "Your small step today makes the next step easier.",
  "Your small step today proves that progress is possible.",
  "Your small step today creates momentum.",
  "Your small step today is one more brick in the future you want.",
  "Your focused study session can become tomorrow's breakthrough.",
  "Your focused study session moves you closer to your goal.",
  "Your focused study session is worth celebrating.",
  "Your focused study session builds a stronger future.",
  "Your focused study session turns effort into progress.",
  "Your focused study session teaches you something valuable.",
  "Your focused study session makes the next step easier.",
  "Your focused study session proves that progress is possible.",
  "Your focused study session creates momentum.",
  "Your focused study session is one more brick in the future you want.",
  "Your decision to begin can become tomorrow's breakthrough.",
  "Your decision to begin moves you closer to your goal.",
  "Your decision to begin is worth celebrating.",
  "Your decision to begin builds a stronger future.",
  "Your decision to begin turns effort into progress.",
  "Your decision to begin teaches you something valuable.",
  "Your decision to begin makes the next step easier.",
  "Your decision to begin proves that progress is possible.",
  "Your decision to begin creates momentum.",
  "Your decision to begin is one more brick in the future you want.",
  "Your patience with yourself can become tomorrow's breakthrough.",
  "Your patience with yourself moves you closer to your goal.",
  "Your patience with yourself is worth celebrating.",
  "Your patience with yourself builds a stronger future.",
  "Your patience with yourself turns effort into progress.",
  "Your patience with yourself teaches you something valuable.",
  "Your patience with yourself makes the next step easier.",
  "Your patience with yourself proves that progress is possible.",
  "Your patience with yourself creates momentum.",
  "Your patience with yourself is one more brick in the future you want.",
  "Your curiosity can become tomorrow's breakthrough.",
  "Your curiosity moves you closer to your goal.",
  "Your curiosity is worth celebrating.",
  "Your curiosity builds a stronger future.",
  "Your curiosity turns effort into progress.",
  "Your curiosity teaches you something valuable.",
  "Your curiosity makes the next step easier.",
  "Your curiosity proves that progress is possible.",
  "Your curiosity creates momentum.",
  "Your curiosity is one more brick in the future you want.",
  "Your steady effort can become tomorrow's breakthrough.",
  "Your steady effort moves you closer to your goal.",
  "Your steady effort is worth celebrating.",
  "Your steady effort builds a stronger future.",
  "Your steady effort turns effort into progress.",
  "Your steady effort teaches you something valuable.",
  "Your steady effort makes the next step easier.",
  "Your steady effort proves that progress is possible.",
  "Your steady effort creates momentum.",
  "Your steady effort is one more brick in the future you want.",
  "Your courage to try again can become tomorrow's breakthrough.",
  "Your courage to try again moves you closer to your goal.",
  "Your courage to try again is worth celebrating.",
  "Your courage to try again builds a stronger future.",
  "Your courage to try again turns effort into progress.",
  "Your courage to try again teaches you something valuable.",
  "Your courage to try again makes the next step easier.",
  "Your courage to try again proves that progress is possible.",
  "Your courage to try again creates momentum.",
  "Your courage to try again is one more brick in the future you want.",
  "Your organized plan can become tomorrow's breakthrough.",
  "Your organized plan moves you closer to your goal.",
  "Your organized plan is worth celebrating.",
  "Your organized plan builds a stronger future.",
  "Your organized plan turns effort into progress.",
  "Your organized plan teaches you something valuable.",
  "Your organized plan makes the next step easier.",
  "Your organized plan proves that progress is possible.",
  "Your organized plan creates momentum.",
  "Your organized plan is one more brick in the future you want.",
  "Your calm focus can become tomorrow's breakthrough.",
  "Your calm focus moves you closer to your goal.",
  "Your calm focus is worth celebrating.",
  "Your calm focus builds a stronger future.",
  "Your calm focus turns effort into progress.",
  "Your calm focus teaches you something valuable.",
  "Your calm focus makes the next step easier.",
  "Your calm focus proves that progress is possible.",
  "Your calm focus creates momentum.",
  "Your calm focus is one more brick in the future you want.",
  "Your willingness to learn can become tomorrow's breakthrough.",
  "Your willingness to learn moves you closer to your goal.",
  "Your willingness to learn is worth celebrating.",
  "Your willingness to learn builds a stronger future.",
  "Your willingness to learn turns effort into progress.",
  "Your willingness to learn teaches you something valuable.",
  "Your willingness to learn makes the next step easier.",
  "Your willingness to learn proves that progress is possible.",
  "Your willingness to learn creates momentum.",
  "Your willingness to learn is one more brick in the future you want.",
  "Your progress today can become tomorrow's breakthrough.",
  "Your progress today moves you closer to your goal.",
  "Your progress today is worth celebrating.",
  "Your progress today builds a stronger future.",
  "Your progress today turns effort into progress.",
  "Your progress today teaches you something valuable.",
  "Your progress today makes the next step easier.",
  "Your progress today proves that progress is possible.",
  "Your progress today creates momentum.",
  "Your progress today is one more brick in the future you want.",
  "Your discipline can become tomorrow's breakthrough.",
  "Your discipline moves you closer to your goal.",
  "Your discipline is worth celebrating.",
  "Your discipline builds a stronger future.",
  "Your discipline turns effort into progress.",
  "Your discipline teaches you something valuable.",
  "Your discipline makes the next step easier.",
  "Your discipline proves that progress is possible.",
  "Your discipline creates momentum.",
  "Your discipline is one more brick in the future you want.",
  "Your positive mindset can become tomorrow's breakthrough.",
  "Your positive mindset moves you closer to your goal.",
  "Your positive mindset is worth celebrating.",
  "Your positive mindset builds a stronger future.",
  "Your positive mindset turns effort into progress.",
  "Your positive mindset teaches you something valuable.",
  "Your positive mindset makes the next step easier.",
  "Your positive mindset proves that progress is possible.",
  "Your positive mindset creates momentum.",
  "Your positive mindset is one more brick in the future you want.",
  "Your next page can become tomorrow's breakthrough.",
  "Your next page moves you closer to your goal.",
  "Your next page is worth celebrating.",
  "Your next page builds a stronger future.",
  "Your next page turns effort into progress.",
  "Your next page teaches you something valuable.",
  "Your next page makes the next step easier.",
  "Your next page proves that progress is possible.",
  "Your next page creates momentum.",
  "Your next page is one more brick in the future you want.",
  "Your next question can become tomorrow's breakthrough.",
  "Your next question moves you closer to your goal.",
  "Your next question is worth celebrating.",
  "Your next question builds a stronger future.",
  "Your next question turns effort into progress.",
  "Your next question teaches you something valuable.",
  "Your next question makes the next step easier.",
  "Your next question proves that progress is possible.",
  "Your next question creates momentum.",
  "Your next question is one more brick in the future you want.",
  "Your next good habit can become tomorrow's breakthrough.",
  "Your next good habit moves you closer to your goal.",
  "Your next good habit is worth celebrating.",
  "Your next good habit builds a stronger future.",
  "Your next good habit turns effort into progress.",
  "Your next good habit teaches you something valuable.",
  "Your next good habit makes the next step easier.",
  "Your next good habit proves that progress is possible.",
  "Your next good habit creates momentum.",
  "Your next good habit is one more brick in the future you want.",
  "Your time invested wisely can become tomorrow's breakthrough.",
  "Your time invested wisely moves you closer to your goal.",
  "Your time invested wisely is worth celebrating.",
  "Your time invested wisely builds a stronger future.",
  "Your time invested wisely turns effort into progress.",
  "Your time invested wisely teaches you something valuable.",
  "Your time invested wisely makes the next step easier.",
  "Your time invested wisely proves that progress is possible.",
  "Your time invested wisely creates momentum.",
  "Your time invested wisely is one more brick in the future you want.",
  "Your belief in growth can become tomorrow's breakthrough.",
  "Your belief in growth moves you closer to your goal.",
  "Your belief in growth is worth celebrating.",
  "Your belief in growth builds a stronger future.",
  "Your belief in growth turns effort into progress.",
  "Your belief in growth teaches you something valuable.",
  "Your belief in growth makes the next step easier.",
  "Your belief in growth proves that progress is possible.",
  "Your belief in growth creates momentum.",
  "Your belief in growth is one more brick in the future you want.",
  "Your consistent practice can become tomorrow's breakthrough.",
  "Your consistent practice moves you closer to your goal.",
  "Your consistent practice is worth celebrating.",
  "Your consistent practice builds a stronger future.",
  "Your consistent practice turns effort into progress.",
  "Your consistent practice teaches you something valuable.",
  "Your consistent practice makes the next step easier.",
  "Your consistent practice proves that progress is possible.",
  "Your consistent practice creates momentum.",
  "Your consistent practice is one more brick in the future you want.",
  "Your quiet determination can become tomorrow's breakthrough.",
  "Your quiet determination moves you closer to your goal.",
  "Your quiet determination is worth celebrating.",
  "Your quiet determination builds a stronger future.",
  "Your quiet determination turns effort into progress.",
  "Your quiet determination teaches you something valuable.",
  "Your quiet determination makes the next step easier.",
  "Your quiet determination proves that progress is possible.",
  "Your quiet determination creates momentum.",
  "Your quiet determination is one more brick in the future you want."
];
const quoteForPage = (seed) => {
  const str = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return QUOTES[Math.abs(hash) % QUOTES.length];
};

const serializeWeeklyContent = ({ goals = '', tasks = '', notes = '', quick = '', quote = '' }) =>
  JSON.stringify({ __weekly: true, goals, tasks, notes, quick, quote });

export default function Notes({ currentEmployeeId }) {
  const [pages, setPages] = useState([]);
  const [isCoverFlipping, setIsCoverFlipping] = useState(false);
  const [isPageFlipping, setIsPageFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState('next');
  const [flipKind, setFlipKind] = useState('page4');
  const [isNewPageFlipping, setIsNewPageFlipping] = useState(false);
  const [active, setActive] = useState(-1); // -1 = الغلاف, -2 = الفهرس, >=0 = ملاحظات
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [popup, setPopup] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const activeFieldRef = useRef(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem('notes_notifications_enabled') === 'true'; } catch { return false; }
  });
  // Each plans page gets one random phrase the first time that page is opened.
  // It stays stable while revisiting the same page, and a newly created page gets a new phrase.
  const [pagePhrases, setPagePhrases] = useState({});
  const audioRef = useRef(null);
  const pageFlipAudioRef = useRef(null);
  const editorRef = useRef(null);
  const fired = useRef(new Set());

  const load = async () => {
    if (!currentEmployeeId) { setPages([]); setActive(-1); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('employee_notes')
      .select('id,title,content,reminder_at,reminder_text,page_order,created_at')
      .eq('employee_id', currentEmployeeId)
      .order('page_order', { ascending: true }).order('id', { ascending: true });
    if (error) { console.error(error); setPages([]); }
    else setPages((data || []).map(p => ({...p, reminder_at: p.reminder_at ? String(p.reminder_at).slice(0,16) : ''})));
    setActive(-1); setLoading(false);
  };

  useEffect(() => { load(); }, [currentEmployeeId]);

  const page = active >= 0 ? pages[active] : null;
  const pageRightIndex = active >= 0 && active + 1 < pages.length ? active + 1 : null;
  const pageRight = pageRightIndex !== null ? pages[pageRightIndex] : null;
  const pageTheme = active >= 0 ? PAGE_THEMES[active % PAGE_THEMES.length] : null;
  

  useEffect(() => {
    if (!page?.id) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase.from('employee_notes').update({
        title: page.title, content: page.content,
        reminder_at: page.reminder_at || null,
        reminder_text: page.reminder_text || null,
        updated_at: new Date().toISOString()
      }).eq('id', page.id).eq('employee_id', currentEmployeeId);
      setSaving(false); if (error) console.error(error);
    }, 700);
    return () => clearTimeout(t);
  }, [page?.id, page?.title, page?.content, page?.reminder_at, page?.reminder_text, currentEmployeeId]);

  useEffect(() => {
    if (!pageRight?.id) return;
    const t = setTimeout(async () => {
      const { error } = await supabase.from('employee_notes').update({
        title: pageRight.title, content: pageRight.content,
        reminder_at: pageRight.reminder_at || null,
        reminder_text: pageRight.reminder_text || null,
        updated_at: new Date().toISOString()
      }).eq('id', pageRight.id).eq('employee_id', currentEmployeeId);
      if (error) console.error(error);
    }, 700);
    return () => clearTimeout(t);
  }, [pageRight?.id, pageRight?.title, pageRight?.content, pageRight?.reminder_at, pageRight?.reminder_text, currentEmployeeId]);

  const updateAt = (index, field, value) =>
    setPages(old => old.map((p,i) => i === index ? {...p,[field]:value} : p));
  const update = (field, value) => updateAt(active, field, value);

  const addPage = async () => {
    if (!currentEmployeeId || isNewPageFlipping) return;

    const now = new Date();
    const maxOrder = pages.length
      ? Math.max(...pages.map(p => Number(p.page_order) || 0))
      : 0;

    // Keep the note/plan pairing intact. If an older dataset has an odd
    // number of rows, complete the missing plan first, then create the new note.
    const rows = [];
    let order = maxOrder + 1;

    if (pages.length % 2 === 1) {
      rows.push({
        employee_id: currentEmployeeId,
        title: 'خطتي لهذا الأسبوع',
        content: serializeWeeklyContent({ quote: quoteForPage(`${currentEmployeeId}-repair-${order}`) }),
        page_order: order,
        created_at: now.toISOString()
      });
      order += 1;
    }

    const noteTitle = `ملاحظة ${Math.floor(pages.length / 2) + 1}`;
    const noteOrder = order;
    const planOrder = order + 1;

    rows.push({
      employee_id: currentEmployeeId,
      title: noteTitle,
      content: '',
      page_order: noteOrder,
      created_at: now.toISOString()
    });
    rows.push({
      employee_id: currentEmployeeId,
      title: 'خطتي لهذا الأسبوع',
      content: serializeWeeklyContent({
        quote: quoteForPage(`${currentEmployeeId}-${planOrder}-${now.toISOString()}`)
      }),
      page_order: planOrder,
      created_at: now.toISOString()
    });

    const { data, error } = await supabase
      .from('employee_notes')
      .insert(rows)
      .select('id,title,content,reminder_at,reminder_text,page_order,created_at');

    if (error) {
      console.error(error);
      return;
    }

    const inserted = (data || []).map(p => ({
      ...p,
      reminder_at: p.reminder_at ? String(p.reminder_at).slice(0, 16) : ''
    }));
    const nextPages = [...pages, ...inserted].sort((a, b) => {
      const ao = Number(a.page_order) || 0;
      const bo = Number(b.page_order) || 0;
      return ao - bo;
    });

    setPages(nextPages);

    // The new note is always an even index after the pair is completed.
    const newNoteIndex = nextPages.findIndex(
      p => Number(p.page_order) === noteOrder
    );

    setIsNewPageFlipping(true);
    window.setTimeout(() => {
      setActive(newNoteIndex >= 0 ? newNoteIndex : Math.max(0, nextPages.length - 2));
      setIsNewPageFlipping(false);
    }, 850);
  };

  const flipTo = (targetIndex, kind, direction = 'next') => {
    if (isPageFlipping) return;
    if (targetIndex >= 0 && targetIndex >= pages.length) return;

    // بدّل الصفحة تحت الورقة فورًا، ثم دع ورقة الصفحة الحالية تنقلب فوقها.
    // بهذه الطريقة يظهر الوجه الجديد خلف الورقة أثناء القلب بدل أن يظهر فجأة بعد انتهاء الحركة.
    setFlipKind(kind || 'page4');
    setFlipDirection(direction);
    setIsPageFlipping(true);
    setActive(targetIndex);

    // تشغيل صوت قلب الصفحة المرفق من المستخدم. المتصفح يسمح به لأنه ناتج عن نقرة المستخدم.
    try {
      if (!pageFlipAudioRef.current) {
        pageFlipAudioRef.current = new Audio(PAGE_TURN_SOUND_PATH);
        pageFlipAudioRef.current.preload = 'auto';
        pageFlipAudioRef.current.volume = 0.72;
      }
      pageFlipAudioRef.current.currentTime = 0;
      pageFlipAudioRef.current.playbackRate = 1.08;
      pageFlipAudioRef.current.play().catch(() => {});
    } catch (e) {}

    window.setTimeout(() => {
      setIsPageFlipping(false);
    }, 1280);
  };

  const flipFromPage2 = async () => {
    if (!pages.length) {
      await addPage();
      return;
    }
    flipTo(0, 'cover2', 'next');
  };

  // Explicit page-surface navigation requested by the user:
  // الفهرس -> التالي | ملاحظاتي -> التالي | خططي -> السابق
  const openNextFromIndex = () => {
    if (pages.length) flipTo(0, 'cover1', 'next');
    else addPage();
  };

  const openNextFromNotes = () => {
    if (spreadStart + 2 < pages.length) {
      flipTo(spreadStart + 2, 'page3', 'next');
    }
  };

  const openPreviousFromPlans = () => {
    if (spreadStart > 0) {
      flipTo(Math.max(0, spreadStart - 2), 'page4', 'prev');
    }
  };

  // Click navigation on the page surface: interactive controls keep their normal behavior.
  const handlePageSurfaceClick = (e, action) => {
    if (e.target.closest('button, input, textarea, select, a')) return;
    action();
  };

  const requestDeletePage = () => {
    if (!page?.id) return;
    setDeleteConfirm({ id: page.id, title: page.title || 'هذه الصفحة' });
  };

  const confirmDeletePage = async () => {
    if (!deleteConfirm?.id) return;
    const deletingId = deleteConfirm.id;
    const { error } = await supabase.from('employee_notes').delete().eq('id', deletingId).eq('employee_id', currentEmployeeId);
    if (error) { console.error(error); return; }
    const deletedIndex = pages.findIndex(p => p.id === deletingId);
    const next = pages.filter(p => p.id !== deletingId);
    setPages(next);
    setDeleteConfirm(null);
    if (!next.length) {
      setActive(-1);
    } else {
      setActive(Math.min(Math.max(deletedIndex, 0), next.length - 1));
    }
  };

  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try { localStorage.setItem('notes_notifications_enabled', 'false'); } catch {}
      return;
    }

    if (!('Notification' in window)) {
      alert('المتصفح لا يدعم التنبيهات.');
      return;
    }

    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      setNotificationsEnabled(true);
      try { localStorage.setItem('notes_notifications_enabled', 'true'); } catch {}
      try {
        if (!audioRef.current) audioRef.current = new Audio(SOUND_PATH);
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 0.55;
        audioRef.current.play().catch(() => {});
      } catch (_) {}
    } else {
      setNotificationsEnabled(false);
      try { localStorage.setItem('notes_notifications_enabled', 'false'); } catch {}
      alert('لم يتم السماح بتنبيهات المتصفح.');
    }
  };

  const rememberField = (el, meta) => {
    if (!el) return;
    activeFieldRef.current = { el, ...meta };
  };

  const insertEmoji = (emoji) => {
    const target = activeFieldRef.current;
    const el = target?.el;

    // Insert into whichever text field was last focused.
    if (el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text','search','url','tel','email'].includes(el.type)))) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const current = el.value || '';
      const nextValue = current.slice(0, start) + emoji + current.slice(end);

      if (target.pageIndex != null && target.field) {
        if (target.serializeWeeklyField) {
          const weekly = parseWeeklyContent(pages[target.pageIndex]?.content || '');
          weekly[target.field] = nextValue;
          updateAt(target.pageIndex, 'content', serializeWeeklyContent(weekly));
        } else {
          updateAt(target.pageIndex, target.field, nextValue);
        }
      }

      requestAnimationFrame(() => {
        try {
          el.focus();
          const pos = start + emoji.length;
          el.setSelectionRange(pos, pos);
        } catch {}
      });
      return;
    }

    // Safe fallback for the notes body.
    const current = notePage?.content || '';
    updateAt(noteIndex, 'content', `${current}${emoji}`);
  };

  useEffect(() => {
    const check = () => {
      if (!notificationsEnabled) return;
      const now = Date.now();
      for (const note of pages) {
        if (!note?.id || !note.reminder_at) continue;
        const when = new Date(note.reminder_at).getTime();
        const key = `${note.id}-${note.reminder_at}`;
        if (fired.current.has(key) || Number.isNaN(when) || now < when) continue;
        fired.current.add(key);
        const reminderTitle = note.title || 'تذكير';
        const reminderText = note.reminder_text || 'حان موعد التذكير';
        setPopup({title: reminderTitle, text: reminderText});
        try {
          if (!audioRef.current) audioRef.current = new Audio(SOUND_PATH);
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 0.55;
          audioRef.current.play().catch(() => {});
        } catch (_) {}
        if ('Notification' in window && Notification.permission === 'granted') {
          try { new Notification(reminderTitle, { body: reminderText }); } catch (_) {}
        }
      }
    };
    const id = setInterval(check, 15000);
    check();
    return () => clearInterval(id);
  }, [pages, notificationsEnabled]);

  const isFirstSpread = active < 0;
  const spreadStart = active >= 0 ? (active % 2 === 0 ? active : Math.max(0, active - 1)) : null;
  const noteIndex = spreadStart !== null ? spreadStart : -1;
  const planIndex = spreadStart !== null && spreadStart + 1 < pages.length ? spreadStart + 1 : null;
  const notePage = noteIndex >= 0 ? pages[noteIndex] : null;
  const planPage = planIndex !== null ? pages[planIndex] : null;
  const currentPageNumber = spreadStart !== null ? spreadStart + 3 : 1;

  useEffect(() => {
    if (!planPage?.id || planIndex === null) return;

    const weekly = parseWeeklyContent(planPage.content || '');
    if (weekly.quote) {
      setPagePhrases(prev => prev[planPage.id] === weekly.quote
        ? prev
        : {...prev, [planPage.id]: weekly.quote});
      return;
    }

    const quote = quoteForPage(planPage.id);
    setPagePhrases(prev => ({...prev, [planPage.id]: quote}));

    // Persist exactly one phrase for this plan page so it stays the same
    // when the user leaves and returns to the note.
    updateAt(planIndex, 'content', serializeWeeklyContent({...weekly, quote}));
  }, [planPage?.id]);

  const button = (children, onClick, disabled=false, extra={}) => {
    const { tooltip, ...buttonExtra } = extra || {};
    const buttonEl = (
      <button
        type="button"
        disabled={disabled}
        onPointerDown={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onClick?.(e); }}
        onMouseEnter={e => {
          if (!disabled) {
            e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
            e.currentTarget.style.boxShadow = '0 9px 0 rgba(49,46,129,.45), 0 15px 24px rgba(49,46,129,.30), inset 0 2px 4px rgba(255,255,255,.92)';
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 5px 0 rgba(55,64,95,.22), 0 8px 14px rgba(55,64,95,.18), inset 0 1px 2px rgba(255,255,255,.95)';
        }}
        onMouseDownCapture={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(2px) scale(1.02)'; }}
        onMouseUp={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)'; }}
        style={{...s.btn,...buttonExtra,width:44,minWidth:44,maxWidth:44,height:44,minHeight:44,maxHeight:44,padding:'0 8px',borderRadius:12,border:'1px solid rgba(255,255,255,.78)',background:'linear-gradient(145deg,#dbeafe 0%,#a78bfa 48%,#6366f1 100%)',boxShadow:'0 6px 0 rgba(49,46,129,.45), 0 10px 18px rgba(49,46,129,.28), inset 0 2px 3px rgba(255,255,255,.85)',transition:'transform .16s ease, box-shadow .16s ease, filter .16s ease',transform:'translateY(0) translateZ(0)',display:'inline-flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',opacity:disabled ? 0.45 : 1}}
        aria-label={buttonExtra['aria-label']}
        title={buttonExtra.title}
      >{children}</button>
    );
    if (!tooltip) return buttonEl;
    return <span className="page3ButtonTooltipWrap">{buttonEl}<span className="page3ButtonTooltip">{tooltip}</span></span>;
  };

  return <div dir="rtl" style={{...s.app, minHeight:'100vh'}}>
    <style>{`

      .page3ButtonTooltipWrap{
        position:relative;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .page3ButtonTooltip{
        position:absolute;
        left:50%;
        bottom:calc(100% + 9px);
        transform:translateX(-50%) translateY(4px);
        min-width:max-content;
        max-width:180px;
        padding:5px 9px;
        border-radius:9px;
        background:rgba(35,31,62,.96);
        color:#fff;
        font-size:11px;
        font-weight:900;
        line-height:1.25;
        white-space:nowrap;
        text-align:center;
        box-shadow:0 7px 16px rgba(35,31,62,.28);
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        z-index:100;
        transition:opacity .16s ease, transform .16s ease, visibility .16s ease;
      }
      .page3ButtonTooltipWrap:hover .page3ButtonTooltip{
        opacity:1;
        visibility:visible;
        transform:translateX(-50%) translateY(0);
      }
      .page3NavShape .page3ButtonTooltipWrap button{
        font-size:20px !important;
        line-height:1 !important;
        cursor:pointer;
      }

      .notes-transparent-editor,
      .notes-transparent-editor:focus,
      .notes-transparent-editor:hover {
        background: transparent !important;
        background-color: transparent !important;
        border: 0 !important;
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none !important;
        appearance: none !important;
      }
      .notes-transparent-editor::placeholder {
        background: transparent !important;
        color: #8a7b8b !important;
        opacity: 1 !important;
      }
      .notes-transparent-editor {
        pointer-events: auto !important;
        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: text !important;
        z-index: 30 !important;
      }
    
      .spreadPages button{
        width:44px !important;
        min-width:44px !important;
        max-width:44px !important;
        height:44px !important;
        min-height:44px !important;
        max-height:44px !important;
        border-radius:12px !important;
        box-sizing:border-box !important;
        transition:transform .16s ease, box-shadow .16s ease, filter .16s ease !important;
      }
      .spreadPages button:hover:not(:disabled){
        transform:translateY(-3px) scale(1.08) !important;
        filter:brightness(1.03);
      }
      .spreadPages button:active:not(:disabled){
        transform:translateY(2px) scale(1.02) !important;
      }
      .new-plan-empty-state,
      .empty-plan-state,
      .plan-empty-state,
      .create-plan-empty-state {
        display: none !important;
      }
      @keyframes page4LampBlink {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: .35; transform: scale(.88); }
      }
      .page4PhraseLampBlink {
        animation: page4LampBlink 1.15s ease-in-out infinite;
        transform-origin: center;
        pointer-events: none;
      }
      `}
    </style>
    <style>{NOTE_PAGE_ANIMATION_STYLES}</style>

    <div style={s.header}>
      <div>
        <h2 style={s.h}>📝 ملاحظات الموظف</h2>
        <small>
          {isFirstSpread ? 'الصفحتان 1–2 — دفتر الملاحظات + الفهرس' :
           `الصفحتان ${currentPageNumber}–${planPage ? currentPageNumber + 1 : currentPageNumber} — خططي + ملاحظاتي`}
        </small>
      </div>
    </div>

    {loading ? <div style={s.empty}>جاري التحميل...</div> : (
      <div style={singlePageStyles.screen}>
        {isFirstSpread ? (
          <div style={singlePageStyles.spread}>
            {/* اليمين: دفتر الملاحظات */}
            <div style={singlePageStyles.spreadHalf}>
              <NotebookImage
                kind="cover1"
                alt="دفتر الملاحظات"
                style={singlePageStyles.spreadImage}
              />
              <button type="button" aria-label="قلب إلى الصفحات التالية" title="قلب الصفحة"
                onClick={() => pages.length ? flipTo(0, 'cover1', 'next') : addPage()}
                className="cornerFlipTab cornerFlipNext" style={{...singlePageStyles.pageFlipTab, right:8, bottom:4, transform:'none'}} />
            </div>

            {/* اليسار: الفهرس — بدون صفحة بيضاء تغطي الصورة */}
            <div
              style={{...singlePageStyles.spreadHalf, cursor:'pointer'}}
              onClick={(e) => handlePageSurfaceClick(e, openNextFromIndex)}
              title="اضغط للانتقال إلى الصفحة التالية"
            >
              <NotebookImage
                kind="cover2"
                alt="الفهرس"
                style={singlePageStyles.spreadImage}
              />
              <div style={singlePageStyles.transparentIndexOverlay}>
                <div
                  style={{
                    ...s.transparentIndexList,
                    position:'absolute',
                    left:'10%',
                    right:'10%',
                    top:'4cm',
                    transform:'none',
                    height:'10cm',
                    overflowY:'auto'
                  }}
                  className="index-scroll-list"
                >
                  {pages.length ? pages.map((p, i) => {
                    const date = formatNoteDate(p.created_at || new Date());
                    return <button
                      key={p.id}
                      type="button"
                      onClick={() => setActive(i % 2 === 0 ? i : Math.max(0, i - 1))}
                      style={s.transparentIndexItem}
                    >
                      <span style={s.transparentIndexNumber}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={s.transparentIndexMain}>
                        <b style={s.transparentIndexMain_bold}>{getDisplayTitle(p, i)}</b>
                      </span>
                      <span style={s.transparentIndexDate}>{formatNoteDate(p.created_at || new Date()).shortDateText}</span>
                    </button>;
                  }) : null}
                </div>
              </div>
              <button type="button" aria-label="الرجوع" title="الرجوع" disabled
                className="cornerFlipTab cornerFlipPrev" style={{...singlePageStyles.pageFlipTab, left:8, bottom:4, opacity:.38, cursor:'default', transform:'scaleX(-1)'}} />
            </div>
          </div>
        ) : (
          <div style={singlePageStyles.spread}>
            {/* اليمين: خططي */}
            <div
              style={{...singlePageStyles.spreadHalf, cursor: spreadStart > 0 ? 'pointer' : 'default'}}
              onClick={(e) => handlePageSurfaceClick(e, openPreviousFromPlans)}
              title={spreadStart > 0 ? 'اضغط للرجوع إلى الصفحة السابقة' : 'هذه أول صفحة'}
            >
              <NotebookImage
                kind="page4"
                alt="خططي"
                style={singlePageStyles.spreadImage}
              />
              {planPage ? <div style={singlePageStyles.spreadOverlay}>
                {(() => {
                  const weekly = parseWeeklyContent(planPage.content || '');
                  return <>
                    <textarea
                      value={weekly.goals}
                      onFocus={e => rememberField(e.currentTarget, {pageIndex: planIndex, field: 'goals', serializeWeeklyField: true})}
                      onChange={e => updateAt(planIndex, 'content', serializeWeeklyContent({...weekly, goals:e.target.value}))}
                      placeholder="اكتب أهدافك هنا ..."
                      spellCheck={false}
                      style={s.weeklyGoalsText}
                    />
                    <textarea
                      value={weekly.tasks}
                      onFocus={e => rememberField(e.currentTarget, {pageIndex: planIndex, field: 'tasks', serializeWeeklyField: true})}
                      onChange={e => updateAt(planIndex, 'content', serializeWeeklyContent({...weekly, tasks:e.target.value}))}
                      placeholder="اكتب مهامك هنا ..."
                      spellCheck={false}
                      style={s.weeklyTasksText}
                    />
                    <div style={s.page4Reminder}>
                      <div style={s.page4ReminderRow}>
                        <label style={s.page4ReminderLabel}>التاريخ</label>
                        <input
                          type="date"
                          value={planPage.reminder_at ? String(planPage.reminder_at).slice(0,10) : ''}
                          onChange={e => {
                            const old = planPage.reminder_at || '';
                            const time = old.includes('T') ? old.slice(11,16) : '09:00';
                            updateAt(planIndex, 'reminder_at', e.target.value ? `${e.target.value}T${time}` : '');
                          }}
                          aria-label="تاريخ التذكير"
                          lang="en-US"
                          dir="ltr"
                          inputMode="numeric"
                          style={s.page4ReminderDate}
                        />
                      </div>
                      <div style={s.page4ReminderRow}>
                        <label style={s.page4ReminderLabel}>الوقت</label>
                        <input
                          type="time"
                          value={planPage.reminder_at ? String(planPage.reminder_at).slice(11,16) : ''}
                          onChange={e => {
                            const date = planPage.reminder_at ? String(planPage.reminder_at).slice(0,10) : formatNoteDate(new Date()).isoDate;
                            updateAt(planIndex, 'reminder_at', e.target.value ? `${date}T${e.target.value}` : '');
                          }}
                          aria-label="وقت التذكير"
                          lang="en-US"
                          dir="ltr"
                          inputMode="numeric"
                          style={s.page4ReminderTime}
                        />
                      </div>
                      <input
                        value={planPage.reminder_text || ''}
                        onFocus={e => rememberField(e.currentTarget, {pageIndex: planIndex, field: 'reminder_text'})}
                        onChange={e => updateAt(planIndex, 'reminder_text', e.target.value)}
                        placeholder="نص التذكير .."
                        aria-label="نص التذكير"
                        style={s.page4ReminderText}
                      />
                      <div style={s.page4ReminderToggleRow}>
                        <span style={s.page4ReminderToggleLabel}>لتفعيل التنبيه</span>
                        <button
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); toggleNotifications(); }}
                          aria-pressed={notificationsEnabled}
                          aria-label={notificationsEnabled ? 'إيقاف التنبيه' : 'تفعيل التنبيه'}
                          title={notificationsEnabled ? 'إيقاف التنبيه' : 'تفعيل التنبيه'}
                          style={{...s.page4ReminderSwitch, background:notificationsEnabled ? 'linear-gradient(135deg,#ff9ac0,#e84393)' : s.page4ReminderSwitch.background}}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              ...s.page4ReminderSwitchThumb,
                              transform: notificationsEnabled ? 'translateX(18px)' : 'translateX(0)'
                            }}
                          />
                        </button>
                      </div>
                    </div>
                    <div style={s.page4PhraseShape} aria-label="عبارة تحفيزية أو آية أو حديث أو حكمة">
                      <div className="page4BottomWave" aria-hidden="true"></div>
                      <div
                        className="page4PhraseLampBlink"
                        aria-hidden="true"
                        style={{
                          position:'absolute',
                          left:'calc(2% + 1cm)',
                          top:'-29%',
                          zIndex:10001,
                          background:'transparent',
                          boxShadow:'none',
                          border:0,
                          opacity:1,
                          fontSize:'clamp(18px,2.2vw,32px)',
                          lineHeight:1,
                          filter:'drop-shadow(0 3px 5px rgba(245,158,11,.28))'
                        }}
                      >💡</div>
                      <div style={s.page4PhraseText}>
                        {pagePhrases[planPage.id] || '﴿ وَقُلْ رَبِّ زِدْنِي عِلْمًا ﴾'}
                      </div>
                    </div>
                  </>;
                })()}
              </div> : null}
              <button type="button" aria-label="الرجوع للصفحة السابقة من خططي" title="الصفحة السابقة"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); if (spreadStart > 0) flipTo(Math.max(0, spreadStart - 2), 'page4', 'prev'); }}
                disabled={spreadStart <= 0}
                className="cornerFlipTab cornerFlipPrev plansPrevTriangle"
                style={{...singlePageStyles.pageFlipTab, right:10, bottom:6, width:44, height:44, opacity:spreadStart > 0 ? .9 : .24, transform:'none'}} />
            </div>

            {/* اليسار: ملاحظاتي */}
            <div
              style={{...singlePageStyles.spreadHalf, cursor:'default'}}
            >
              <NotebookImage
                kind="page3"
                alt="ملاحظاتي"
                style={singlePageStyles.spreadImage}
              />
              {notePage ? <div style={singlePageStyles.spreadOverlay}>
                <div style={s.page3MetaRow}>
                  <div style={s.page3PinkWaveLeft} aria-hidden="true" />
                  <div style={s.page3PinkWaveRight} aria-hidden="true" />
                  <div style={s.page3MetaTopLine}>
                    <div style={s.page3MetaCell}>
                      <span style={s.page3MetaLabel}>التاريخ:</span>
                      <span style={s.page3MetaValue}>{formatNoteDate(notePage?.created_at || new Date()).shortDateText}</span>
                    </div>
                    <div style={s.page3MetaCell}>
                      <span style={s.page3MetaLabel}>اليوم:</span>
                      <span style={s.page3MetaValue}>{formatNoteDate(notePage?.created_at || new Date()).dayName}</span>
                    </div>
                  </div>
                  <div style={s.page3MetaTitleLine}>
                    <span style={s.page3MetaLabel}>العنوان:</span>
                    <div style={s.page3TitleStack}>
                      <input
                        value={notePage.title || ''}
                        onFocus={e => rememberField(e.currentTarget, {pageIndex: noteIndex, field: 'title'})}
                        onChange={e => updateAt(noteIndex, 'title', e.target.value)}
                        placeholder=""
                        spellCheck={false}
                        style={s.page3TitleField}
                        aria-label="عنوان الملاحظة"
                      />
                      <div style={s.page3TitleDottedLine} aria-hidden="true" />
                    </div>
                  </div>
                </div>
                <textarea
                  ref={editorRef}
                  value={notePage.content || ''}
                  onFocus={e => rememberField(e.currentTarget, {pageIndex: noteIndex, field: 'content'})}
                  onChange={e => updateAt(noteIndex, 'content', e.target.value)}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  placeholder="اكتب ملاحظاتك هنا ..."
                  spellCheck={false}
                  className="notes-transparent-editor"
                  style={{
                    position:'absolute',
                    top:'calc(18.2% + 0.7cm + 13% + 10px)',
                    left:'16%',
                    width:'68%',
                    height:'38%',
                    resize:'none',
                    boxSizing:'border-box',
                    padding:'8px 18px',
                    margin:0,
                    border:0,
                    outline:0,
                    background:'transparent',
                    color:'#26364d',
                    fontSize:'clamp(12px,1.05vw,18px)',
                    lineHeight:'clamp(25px,2.55vw,40px)',
                    textAlign:'right',
                    direction:'rtl',
                    fontFamily:'inherit',
                    fontWeight:400,
                    pointerEvents:'auto',
                    zIndex:40,
                    cursor:'text',
                    userSelect:'text',
                    WebkitUserSelect:'text',
                    overflowY:'auto',
                    whiteSpace:'pre-wrap'
                  }}
                  aria-label="كتابة الملاحظات"
                />
                <div style={{...s.page3NavShape, bottom:'-1.2%', height:54, gap:8}}>
                  {button('➡️', () => {
                    if (spreadStart + 2 < pages.length) flipTo(spreadStart + 2, 'page3', 'next');
                  }, spreadStart + 2 >= pages.length, {...s.designNextBtn, title:'التالي', 'aria-label':'التالي', tooltip:'الانتقال إلى الصفحة التالية'})}
                  {button('🗑️', requestDeletePage, !notePage, {...s.delete, title:'حذف', 'aria-label':'حذف الصفحة', tooltip:'حذف هذه الصفحة'})}
                  {button('➕', addPage, false, {...s.toolbarAdd, title:'إضافة', 'aria-label':'إضافة صفحة', tooltip:'إضافة صفحة ملاحظات جديدة'})}
                  {button('🏠', () => setActive(-1), false, {...s.home, title:'Home — الفهرس', 'aria-label':'الفهرس', tooltip:'العودة إلى الفهرس الرئيسي'})}
                  {button('😂', () => setEmojiOpen(v => !v), false, {...s.symbolBtn, title:'إيموجي', 'aria-label':'إيموجي', tooltip:'إضافة رمز تعبيري للملاحظة'})}
                  {button('⬅️', () => {
                    if (spreadStart > 0) flipTo(Math.max(0, spreadStart - 2), 'page4', 'prev');
                  }, spreadStart <= 0, {...s.designNavBtn, title:'السابق', 'aria-label':'السابق', tooltip:'الانتقال إلى الصفحة السابقة'})}
                </div>

              </div> : null}
              <button type="button" aria-label="الانتقال للصفحة التالية من ملاحظاتي" title="الصفحة التالية"
                onClick={(e) => { e.stopPropagation(); if (spreadStart + 2 < pages.length) flipTo(spreadStart + 2, 'page3', 'next'); }}
                disabled={spreadStart + 2 >= pages.length}
                className="cornerFlipTab cornerFlipNext notesBottomNextTriangle"
                style={{...singlePageStyles.pageFlipTab, left:8, bottom:6, width:44, height:44, opacity:spreadStart + 2 < pages.length ? .9 : .28, transform:'scaleX(-1)'}} />
            </div>
          </div>
        )}

        {isPageFlipping && (
          <div className="bookFlipStage" aria-hidden="true">
            <div className={`bookFlipSheet ${flipDirection === 'next' ? 'next' : 'prev'}`}>
              <div className="bookFlipFace front">
                <img
                  src={EMBEDDED_NOTE_IMAGES[flipKind] || EMBEDDED_NOTE_IMAGES.page4 || EMBEDDED_NOTE_IMAGES.cover1}
                  alt=""
                  draggable="false"
                />
              </div>
              <div className="bookFlipFace back">
                <img
                  src={EMBEDDED_NOTE_IMAGES[flipKind] || EMBEDDED_NOTE_IMAGES.page4 || EMBEDDED_NOTE_IMAGES.cover1}
                  alt=""
                  draggable="false"
                />
              </div>
              <div className="bookFlipCurl" />
              <div className="bookFlipEdgeShadow" />
            </div>
          </div>
        )}



        {emojiOpen && !isFirstSpread && notePage && (
          <div style={{...s.emojiPanel, position:'absolute', left:'50%', transform:'translateX(-50%)', bottom:72, width:'min(520px,90vw)', pointerEvents:'auto', zIndex:60}}>
            <div style={s.emojiTitle}>اختر رمزًا لإضافته إلى الملاحظة</div>
            <div style={s.emojiGrid}>
              {EMOJIS.map((emoji, i) =>
                <button key={`${emoji}-${i}`} type="button" onClick={() => insertEmoji(emoji)} style={s.emoji}>{emoji}</button>
              )}
            </div>
          </div>
        )}
      </div>
    )}

    {deleteConfirm && <div style={s.overlay}>
      <div style={s.deleteModal}>
        <div style={s.deleteIcon}>✕</div>
        <h2 style={{margin:'8px 0 6px'}}>تأكيد حذف الصفحة</h2>
        <p style={{margin:'0 0 20px',lineHeight:1.9}}>هل أنتِ متأكدة من حذف<br/><b>«{deleteConfirm.title}»</b>؟</p>
        <div style={s.deleteActions}>
          <button type="button" onClick={()=>setDeleteConfirm(null)} style={s.cancelDelete}>إلغاء</button>
          <button type="button" onClick={confirmDeletePage} style={s.confirmDelete}>نعم، احذف</button>
        </div>
      </div>
    </div>}

    {popup && <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{fontSize:44}}>🔔</div>
        <h2>{popup.title}</h2>
        <p>{popup.text}</p>
        <button onClick={()=>setPopup(null)} style={s.close}>إغلاق التنبيه</button>
      </div>
    </div>}
  </div>;
}

const singlePageStyles = {
  screen:{
    width:'97%', height:'calc(100vh - 145px)', minHeight:500, margin:'0 auto',
    position:'relative', overflow:'hidden', boxSizing:'border-box',
    borderRadius:22, border:'2px solid rgba(255,255,255,.9)',
    boxShadow:'0 16px 45px rgba(86,53,84,.18)',
    background:'linear-gradient(135deg,#fff5fb,#eef7ff)'
  },
  spread:{
    position:'absolute', left:'1%', top:'2%', width:'98%', height:'94%', display:'grid', gridTemplateColumns:'1fr 1fr',
    direction:'rtl', gap:0, padding:0, boxSizing:'border-box',
    alignItems:'stretch', justifyItems:'stretch', overflow:'hidden',
    perspective:'1800px', transformStyle:'preserve-3d'
  },
  spreadHalf:{
    position:'relative', width:'100%', height:'100%', minWidth:0, minHeight:0,
    overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
    boxSizing:'border-box', background:'#f8e7f1', borderRadius:0
  },
  spreadImage:{
    position:'absolute', left:0, top:0, width:'100%', height:'100%',
    objectFit:'fill', objectPosition:'center', display:'block',
    userSelect:'none'
  },
  pageFlipTab:{position:'absolute', width:58, height:58, border:0, padding:0, zIndex:35,
    background:'linear-gradient(135deg,transparent 0 48%,rgba(255,255,255,.92) 49% 52%,rgba(224,93,157,.62) 53% 100%)',
    clipPath:'polygon(100% 0,100% 100%,0 100%)', borderRadius:'0 0 0 18px',
    cursor:'pointer', boxShadow:'-10px -8px 24px rgba(75,45,75,.12)', opacity:.22,
    transformStyle:'preserve-3d', perspective:'900px', transformOrigin:'100% 100%',
    transition:'transform .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease, box-shadow .22s ease'},
  flipOverlay:{position:'absolute', inset:0, zIndex:80, pointerEvents:'none', perspective:2200, perspectiveOrigin:'50% 50%', overflow:'hidden', transformStyle:'preserve-3d'},
  flipSheet:{position:'absolute', top:0, bottom:0, width:'50%', objectFit:'fill', objectPosition:'center', display:'block',
    backfaceVisibility:'hidden', transformStyle:'preserve-3d', willChange:'transform,filter', boxShadow:'0 22px 55px rgba(0,0,0,.42)', borderRadius:18, transformOrigin:'center center'},
  transparentIndexOverlay:{position:'absolute',inset:0,zIndex:6,pointerEvents:'none'},
  transparentIndexList:{position:'absolute',left:'10%',right:'10%',top:'4cm',height:'10cm',display:'flex',flexDirection:'column',justifyContent:'flex-start',gap:0,pointerEvents:'auto',overflowY:'auto',overflowX:'hidden',padding:'0',boxSizing:'border-box',scrollbarWidth:'thin'},
  spreadOverlay:{position:'absolute', inset:0, pointerEvents:'auto'},
  spreadBadge:{
    position:'absolute', top:12, right:14, zIndex:8, padding:'7px 12px',
    borderRadius:999, background:'#ffffff', color:'#17345e',
    fontWeight:900, fontSize:'clamp(10px,.8vw,14px)', boxShadow:'0 6px 16px rgba(70,40,80,.12)',
    pointerEvents:'none'
  },
  spreadIndexPanel:{
    position:'absolute', inset:'5%', zIndex:4, display:'flex', flexDirection:'column',
    padding:'14px 16px', boxSizing:'border-box', background:'transparent',
    border:0, borderRadius:0,
    boxShadow:'0 12px 35px rgba(80,50,90,.16)', backdropFilter:'none', overflow:'hidden'
  },
  emptyHalf:{
    position:'absolute', inset:'12%', zIndex:5, display:'flex', alignItems:'center',
    justifyContent:'center', textAlign:'center', padding:20, borderRadius:20,
    background:'#ffffff', color:'#17345e', fontWeight:900, lineHeight:2
  },
  page:{
    position:'absolute', inset:0, overflow:'hidden',
    display:'flex', alignItems:'center', justifyContent:'center'
  },
  image:{
    position:'absolute', inset:'-4%', width:'108%', height:'108%',
    objectFit:'contain', objectPosition:'center', display:'block', transform:'scale(1.02)'
  },
  indexPanel:{
    position:'absolute', right:'4%', top:'4%', width:'min(72%,980px)',
    height:'92%', boxSizing:'border-box', background:'rgba(255,255,255,.82)',
    borderRadius:26, padding:'22px 28px', display:'flex',
    flexDirection:'column', overflow:'hidden',
    boxShadow:'0 18px 55px rgba(70,40,80,.18)', backdropFilter:'none'
  },
  coverHint:{
    position:'absolute', left:'50%', bottom:22, transform:'translateX(-50%)',
    display:'flex', gap:8, zIndex:10
  },
  softButton:{
    border:0, borderRadius:999, padding:'10px 18px',
    background:'#ffffff', color:'#17345e',
    fontFamily:'inherit', fontWeight:900, cursor:'pointer',
    boxShadow:'0 6px 18px rgba(70,40,80,.16)'
  },
  noteOverlay:{position:'absolute', inset:0, zIndex:5, pointerEvents:'none'},
  planOverlay:{position:'absolute', inset:0, zIndex:5, pointerEvents:'none'},
    singleNoteText:{
      position:'absolute', top:'43%', left:'10%', width:'80%', height:'38%',
      resize:'none', border:0, outline:0, background:'transparent', backgroundColor:'transparent',
      color:'#26364d', fontSize:'clamp(12px,1.05vw,18px)',
      lineHeight:'clamp(25px,2.55vw,40px)',
      textAlign:'right', fontFamily:'inherit', direction:'rtl',
      padding:'6px 10px', margin:0, boxSizing:'border-box', pointerEvents:'auto',
      overflowY:'auto', zIndex:30, borderRadius:0, boxShadow:'none',
      appearance:'none', WebkitAppearance:'none',
      whiteSpace:'pre-wrap', cursor:'text', userSelect:'text',
      WebkitUserSelect:'text'
    },
  controls:{
    position:'absolute', left:'50%', transform:'translateX(-50%)',
    bottom:10, zIndex:40, display:'flex', justifyContent:'center',
    alignItems:'center', gap:7, padding:'7px 14px', boxSizing:'border-box',
    background:'#fff0f7', border:'2px solid rgba(255,255,255,.98)',
    borderRadius:999, boxShadow:'0 7px 22px rgba(60,40,80,.16)',
    backdropFilter:'blur(8px)', maxWidth:'calc(100% - 28px)'
  }
};

const s={
app:{width:'100%',minHeight:'100vh',padding:'14px 18px 22px',boxSizing:'border-box',background:'linear-gradient(135deg,#f7d9e8,#d9e9ff)',color:'#17233f',fontFamily:'Noto Kufi Arabic,Arial,sans-serif',overflowX:'hidden'},
appCover:{padding:'14px 18px 22px',background:'linear-gradient(135deg,#f7d9e8,#d9e9ff)'},appNotebook:{padding:'14px 18px 22px',margin:0,minHeight:'100vh',width:'100%',background:'linear-gradient(135deg,#f8e7f1,#eaf3ff)',overflowX:'hidden'},header:{position:'relative',zIndex:50,width:'100%',minHeight:62,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'10px 14px',marginBottom:12,boxSizing:'border-box',borderRadius:18,background:'rgba(255,255,255,.78)',border:'1px solid rgba(255,255,255,.92)',boxShadow:'0 8px 25px rgba(66,48,90,.12)',backdropFilter:'blur(8px)'},h:{margin:0},actions:{pointerEvents:'auto',display:'flex',gap:6,flexWrap:'nowrap',alignItems:'center'},btn:{border:'1px solid rgba(23,35,63,.12)',borderRadius:12,padding:'9px 13px',color:'#17233f',background:'rgba(255,255,255,.72)',cursor:'pointer',fontFamily:'inherit',boxShadow:'0 5px 15px rgba(66,48,90,.10)'},notify:{background:'linear-gradient(135deg,#ffd166,#f59e0b)',border:0,fontWeight:800},notifyOn:{background:'linear-gradient(135deg,#ff7aa8,#e84393)',border:0,fontWeight:800,color:'#fff'},emojiBtn:{background:'linear-gradient(135deg,#c7a7ff,#8b5cf6)',border:0,fontWeight:800,color:'#fff'},add:{background:'linear-gradient(135deg,#ff8fb3,#ff5f9e)',border:0,fontWeight:800,color:'#fff'},delete:{background:'linear-gradient(135deg,#ef709d,#c92a62)',border:0,fontWeight:800,color:'#fff',width:26,height:26,minWidth:26,padding:0,fontSize:12,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center'},pageDateHeader:{display:'flex',justifyContent:'center',alignItems:'center',gap:12,flexWrap:'wrap',margin:'4px auto 14px',padding:'8px 16px',width:'fit-content',borderRadius:999,background:'rgba(255,255,255,.62)',border:'1px solid rgba(255,255,255,.8)',color:'#23395d',fontSize:15,fontWeight:800,boxShadow:'0 5px 18px rgba(66,48,90,.10)'},
serialBadge:{width:'fit-content',margin:'0 auto 8px',padding:'6px 13px',borderRadius:999,background:'#ffffff',border:'1px solid #ffffff',fontSize:13,fontWeight:900,color:'#e84393',boxShadow:'0 5px 16px rgba(66,48,90,.08)'},home:{background:'linear-gradient(135deg,#9bd7ff,#5aa9ff)',border:0,fontWeight:900,color:'#fff',width:42,height:42,minWidth:42,padding:0,fontSize:20,borderRadius:'50%',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 7px 16px rgba(90,169,255,.24)'},toolbarAdd:{background:'linear-gradient(135deg,#ff9ac0,#ff5f9e)',border:0,fontWeight:900,color:'#fff'},
cover:{width:'100%',height:'calc(100vh - 105px)',minHeight:540,margin:0,padding:0,borderRadius:22,background:'#f7d9e8',border:'2px solid rgba(255,255,255,.9)',boxShadow:'0 16px 45px rgba(86,53,84,.18)',position:'relative',overflow:'hidden'},coverArtwork:{position:'relative',width:'100%',height:'100vh',minHeight:560,overflow:'hidden',display:'flex',alignItems:'stretch',justifyContent:'stretch'},coverImage:{display:'block',width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',borderRadius:0,boxShadow:'none',transform:'perspective(1400px) rotateY(0deg)',transformOrigin:'right center',transition:'transform 650ms cubic-bezier(.2,.75,.25,1)'},coverImageFlipping:{transform:'perspective(1400px) rotateY(-90deg)'},coverFlipShade:{position:'absolute',inset:0,background:'rgba(255,255,255,.16)',pointerEvents:'none',transition:'opacity 300ms ease'},
page2Screen:{position:'relative',width:'100%',height:'calc(100vh - 105px)',minHeight:540,overflow:'hidden',background:'#f8e7f1',boxSizing:'border-box',borderRadius:22,border:'2px solid rgba(255,255,255,.9)',boxShadow:'0 16px 45px rgba(86,53,84,.18)'},indexPanel:{width:'min(72%,980px)',height:'calc(100% - 44px)',boxSizing:'border-box',background:'rgba(255,255,255,.82)',borderRadius:26,padding:'22px 28px',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 18px 55px rgba(70,40,80,.18)',position:'absolute',right:'4%',top:22,zIndex:3,backdropFilter:'none'},transparentIndexItem:{width:'100%',minHeight:'1cm',height:'1cm',display:'grid',gridTemplateColumns:'22% 53% 25%',alignItems:'center',gap:0,textAlign:'right',padding:'0 2px',boxSizing:'border-box',border:0,background:'transparent',color:'#17345e',cursor:'pointer',fontFamily:'inherit',pointerEvents:'auto',direction:'rtl',overflow:'hidden'},transparentIndexNumber:{fontVariantNumeric:'tabular-nums',direction:'ltr',width:'100%',height:'100%',justifySelf:'stretch',display:'flex',alignItems:'center',position:'relative',left:'-1cm',justifyContent:'center',background:'transparent',color:'#b51f62',fontSize:'clamp(9px,.68vw,12px)',fontWeight:1000,lineHeight:1.1,textAlign:'center'},transparentIndexMain:{position:'relative',left:'-1cm',display:'flex',flexDirection:'column',gap:0,minWidth:0,width:'100%',height:'100%',alignItems:'stretch',justifyContent:'center',textAlign:'right',overflow:'hidden',whiteSpace:'nowrap',paddingRight:'4px',boxSizing:'border-box'},transparentIndexMain_bold:{width:'100%',display:'block',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},transparentIndexDate:{position:'relative',right:'-0.5cm',fontVariantNumeric:'tabular-nums',direction:'ltr',width:'100%',fontSize:'clamp(7.5px,.58vw,11px)',fontWeight:700,whiteSpace:'nowrap',textAlign:'left',lineHeight:1.1,overflow:'hidden',textOverflow:'ellipsis',paddingLeft:'4px',boxSizing:'border-box'},indexHeaderRow:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:15,marginBottom:16},indexTitle:{fontSize:'clamp(30px,4vw,52px)',fontWeight:1000,color:'#183f78',lineHeight:1.1},indexSubtitle:{marginTop:7,fontSize:13,fontWeight:800,color:'#7b5b78'},indexAdd:{width:58,height:58,borderRadius:'50%',border:'3px solid #fff',background:'linear-gradient(135deg,#ff86b5,#e84393)',color:'#fff',fontSize:34,cursor:'pointer',boxShadow:'0 10px 25px rgba(232,67,147,.28)'},indexScroll:{flex:1,overflowY:'auto',padding:'4px 8px 10px 4px',scrollbarWidth:'auto'},indexItem:{width:'100%',display:'flex',alignItems:'center',gap:14,textAlign:'right',padding:'14px 16px',marginBottom:10,borderRadius:18,border:'1px solid rgba(80,100,140,.12)',background:'rgba(255,255,255,.82)',color:'#17345e',cursor:'pointer',boxShadow:'0 5px 16px rgba(80,70,110,.08)',fontFamily:'inherit'},indexNumber:{flex:'0 0 46px',height:46,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#ffd1e3,#ff8fba)',color:'#b51f62',fontSize:16,fontWeight:1000},indexItemMain:{display:'flex',flexDirection:'column',gap:5,flex:1,minWidth:0},indexItemMain_bold:{fontWeight:900},indexItemMain_small:{fontSize:11,opacity:.6},indexArrow:{fontSize:30,fontWeight:900,color:'#e84393',lineHeight:1},indexEmpty:{padding:'50px 20px',textAlign:'center',fontWeight:900,color:'#5b4b67',lineHeight:2},indexFooter:{marginTop:10,padding:'14px 18px',borderRadius:18,textAlign:'center',fontWeight:900,fontSize:16,color:'#17345e',background:'rgba(255,213,229,.72)'},
indexBackgroundWrap:{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'flex-start',padding:'0 0 0 2%',boxSizing:'border-box',overflow:'hidden'},page2Image:{width:'auto',height:'100%',maxWidth:'100%',display:'block',transition:'filter .2s ease',objectFit:'contain'},page2ImageLeaving:{filter:'brightness(.82)'},page2Overlay:{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,105,160,.04))'},designPageScreen:{width:'100vw',height:'100vh',minHeight:'100vh',position:'relative',overflow:'hidden',background:'linear-gradient(135deg,#f7d9e8,#d9e9ff)',display:'flex',alignItems:'center',justifyContent:'center'},coverSpread:{position:'relative',width:'100%',height:'calc(100vh - 105px)',minHeight:540,display:'flex',flexDirection:'row',direction:'ltr',gap:0,background:'#f7d9e8',overflow:'hidden',zIndex:1},coverHalf:{flex:'1 1 50%',width:'50%',height:'100%',minWidth:0,position:'relative',overflow:'hidden',boxSizing:'border-box'},coverHalfImage:{position:'absolute',inset:0,width:'100%',height:'100%',display:'block',objectFit:'cover',objectPosition:'center',background:'#f8e7f1'},coverIndexHalf:{position:'relative',width:'100%',height:'100%',overflow:'hidden'},coverIndexShade:{position:'absolute',inset:0,background:'rgba(255,255,255,.42)',zIndex:1},coverIndexPanel:{position:'absolute',inset:'5% 5%',zIndex:2,display:'flex',flexDirection:'column',padding:'18px 20px',boxSizing:'border-box',background:'rgba(255,250,253,.88)',border:'2px solid rgba(255,255,255,.95)',borderRadius:24,boxShadow:'0 12px 35px rgba(80,50,90,.16)',backdropFilter:'none',overflow:'hidden'},coverIndexTitle:{fontSize:'clamp(26px,3vw,42px)',fontWeight:1000,color:'#183f78',lineHeight:1.1},coverSeam:{position:'absolute',top:0,bottom:0,left:'50%',width:14,transform:'translateX(-50%)',background:'linear-gradient(90deg,rgba(255,255,255,.0),rgba(83,44,75,.20),rgba(255,255,255,.0))',zIndex:5,pointerEvents:'none'},designPageImage:{display:'block',width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',background:'#f8e7f1'},designPageControls:{position:'absolute',left:'50%',transform:'translateX(-50%)',bottom:'max(12px,env(safe-area-inset-bottom))',zIndex:12,display:'flex',justifyContent:'center',alignItems:'center',gap:8,flexWrap:'nowrap',pointerEvents:'auto',padding:'7px 10px',boxSizing:'border-box',background:'#ffffff',border:'1px solid #ffffff',borderRadius:999,boxShadow:'0 8px 25px rgba(60,40,80,.16)',backdropFilter:'blur(8px)'},spreadEditor:{position:'relative',width:'100%',height:'calc(100vh - 105px)',minHeight:540,overflow:'hidden',background:'#f8e7f1',boxSizing:'border-box',borderRadius:22,border:'2px solid rgba(255,255,255,.9)',boxShadow:'0 16px 45px rgba(86,53,84,.18)',display:'flex',alignItems:'center',justifyContent:'center'},
spreadPages:{position:'relative',display:'flex',flexDirection:'row',direction:'ltr',gap:0,overflow:'hidden',width:'98%',height:'90%',background:'#fff7fb',alignItems:'stretch',justifyContent:'center',borderRadius:30,boxShadow:'0 14px 36px rgba(86,53,84,.14)'},
spreadPage:{flex:'0 1 50%',width:'50%',height:'100%',minWidth:0,minHeight:0,position:'relative',overflow:'hidden',boxSizing:'border-box',background:'#fff7fb',borderTop:'3px solid rgba(255,255,255,.92)',borderBottom:'3px solid rgba(255,255,255,.92)'},
spreadImage:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block',userSelect:'none',background:'#f8e7f1'},
spreadOverlay:{position:'absolute',inset:0,zIndex:4,pointerEvents:'auto',overflow:'hidden',isolation:'isolate'},
page3DateCleanup:{position:'absolute',top:'20.5%',left:'53%',width:'36%',height:'6.4%',background:'#fffaf7',borderRadius:6,pointerEvents:'none'},page3DateField:{position:'absolute',top:'20.8%',left:'56%',width:'31%',height:'4.6%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'clamp(9px,.95vw,15px)',fontWeight:900,color:'#17345e',direction:'rtl',whiteSpace:'nowrap',pointerEvents:'none'},page3DayField:{position:'absolute',top:'20.8%',left:'34%',width:'22%',height:'4.6%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'clamp(9px,.95vw,15px)',fontWeight:900,color:'#17345e',direction:'rtl',whiteSpace:'nowrap',pointerEvents:'none'},page3MetaRow:{position:'absolute',top:'calc(18.2% + 0.7cm)',left:'16%',width:'68%',height:'13%',zIndex:20,pointerEvents:'auto',direction:'rtl',padding:'5px 18px',boxSizing:'border-box',background:'linear-gradient(180deg,rgba(250,244,248,.92),rgba(239,226,235,.88))',border:'1px solid rgba(118,82,112,.34)',borderRadius:10,boxShadow:'inset 0 3px 7px rgba(91,58,83,.20), inset 0 -2px 3px rgba(255,255,255,.95), 0 2px 7px rgba(70,40,80,.08)',display:'flex',flexDirection:'column',gap:'2px',overflow:'visible'},page3PinkWaveLeft:{position:'absolute',left:'-7px',top:'12%',width:'14px',height:'76%',borderLeft:'4px solid rgba(235,126,177,.82)',borderRadius:'50%',transform:'rotate(2deg)',boxShadow:'0 0 0 2px rgba(255,190,218,.18), 0 0 7px rgba(235,126,177,.18)',pointerEvents:'none',zIndex:2},page3PinkWaveRight:{position:'absolute',right:'-7px',top:'12%',width:'14px',height:'76%',borderRight:'4px solid rgba(235,126,177,.82)',borderRadius:'50%',transform:'rotate(-2deg)',boxShadow:'0 0 0 2px rgba(255,190,218,.18), 0 0 7px rgba(235,126,177,.18)',pointerEvents:'none',zIndex:2},page3MetaTopLine:{height:'50%',display:'flex',alignItems:'center',justifyContent:'center',gap:'34px',direction:'rtl'},page3MetaTitleLine:{height:'50%',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',direction:'rtl'},page3MetaCell:{minWidth:0,height:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:'5px',fontSize:'clamp(10px,.86vw,14px)',fontWeight:900,color:'#17345e',whiteSpace:'nowrap',textAlign:'center',overflow:'visible'},page3MetaLabel:{fontWeight:1000,color:'#7b4967',background:'transparent',padding:0,borderRadius:0,textShadow:'1px 1px 0 rgba(255,255,255,.9), -1px -1px 0 rgba(92,57,83,.12)'},page3MetaValue:{fontWeight:1000,color:'#17345e',background:'transparent',padding:0,borderRadius:0,display:'inline-block',whiteSpace:'nowrap',textShadow:'1px 1px 0 rgba(255,255,255,.95), -1px -1px 0 rgba(70,40,80,.16)'},page3TitleField:{width:'110px',minWidth:'110px',maxWidth:'150px',height:'70%',border:0,outline:0,background:'transparent',borderRadius:0,textAlign:'right',fontSize:'clamp(10px,.9vw,14px)',fontWeight:1000,color:'#17345e',fontFamily:'inherit',direction:'rtl',pointerEvents:'auto',boxSizing:'border-box',padding:0,textShadow:'1px 1px 0 rgba(255,255,255,.95), -1px -1px 0 rgba(70,40,80,.16)'},page3TitleStack:{display:'flex',flexDirection:'column',alignItems:'flex-end',justifyContent:'center',width:'150px',height:'100%',gap:'1px'},page3TitleDottedLine:{width:'100%',borderBottom:'2px dotted rgba(123,73,103,.62)',height:'1px',pointerEvents:'none'},page3Number:{position:'absolute',top:'8.5%',right:'8%',fontSize:'clamp(10px,1vw,15px)',fontWeight:900,color:'#17345e',opacity:.78,direction:'ltr'},spreadText:{position:'absolute',top:'35.5%',left:'15%',width:'70%',height:'49%',resize:'none',border:0,outline:0,background:'transparent',color:'#26364d',fontSize:'clamp(12px,1.05vw,18px)',lineHeight:2.05,textAlign:'right',fontFamily:'inherit',direction:'rtl',padding:'0 8px',boxSizing:'border-box',pointerEvents:'auto',overflowY:'auto',zIndex:6},weeklyGoalsText:{position:'absolute',top:'30.7%',left:'54%',width:'37%',height:'22%',resize:'none',border:0,outline:0,background:'transparent',color:'#26364d',fontSize:'clamp(10px,1vw,16px)',lineHeight:1.9,textAlign:'right',fontFamily:'inherit',direction:'rtl',padding:'0 4px',boxSizing:'border-box',pointerEvents:'auto',overflow:'hidden',zIndex:6},weeklyTasksText:{position:'absolute',top:'30.7%',left:'10%',width:'37%',height:'49%',resize:'none',border:0,outline:0,background:'transparent',color:'#26364d',fontSize:'clamp(10px,1vw,16px)',lineHeight:1.9,textAlign:'right',fontFamily:'inherit',direction:'rtl',padding:'0 4px',boxSizing:'border-box',pointerEvents:'auto',overflow:'hidden',zIndex:6},weeklyNotesText:{position:'absolute',top:'56%',right:'7%',width:'37%',height:'22%',resize:'none',border:0,outline:0,background:'transparent',color:'#26364d',fontSize:'clamp(9px,.95vw,15px)',lineHeight:1.8,textAlign:'right',fontFamily:'inherit',direction:'rtl',padding:'2px 5px',boxSizing:'border-box',pointerEvents:'auto',overflowY:'auto',zIndex:7},page4PhraseShape:{position:'absolute',top:'72.5%',left:'50%',width:'47%',height:'15.5%',zIndex:8,background:'transparent',border:0,boxShadow:'none',pointerEvents:'auto',overflow:'visible',clipPath:'none'},page4PhraseText:{position:'absolute',inset:'0',width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',color:'#17345e',fontSize:'clamp(11px,.98vw,17px)',lineHeight:1.35,textAlign:'center',fontFamily:'inherit',fontWeight:900,direction:'rtl',padding:'2px 22px',boxSizing:'border-box',pointerEvents:'none',overflow:'visible',wordBreak:'normal',overflowWrap:'break-word',zIndex:10},page4Reminder:{position:'absolute',top:'calc(60% + 1cm)',left:'calc(9% + .5cm)',right:'auto',width:'40%',height:'27%',display:'flex',flexDirection:'column',gap:6,alignItems:'stretch',justifyContent:'flex-start',zIndex:9,pointerEvents:'auto',direction:'rtl',background:'transparent',boxSizing:'border-box',padding:'2px 0'},page4ReminderTitle:{display:'none'},page4ReminderRow:{display:'grid',gridTemplateColumns:'25% 75%',alignItems:'center',gap:1,width:'100%',height:'24%',minHeight:22,overflow:'visible',position:'relative',boxSizing:'border-box'},page4ReminderLabel:{fontSize:'clamp(8px,.68vw,11px)',fontWeight:900,color:'#5b4d72',whiteSpace:'nowrap',position:'relative',left:'0.2cm',transform:'none',textAlign:'right',zIndex:2,paddingRight:2,boxSizing:'border-box'},page4ReminderDate:{width:'100%',height:'100%',minWidth:0,border:0,borderRadius:8,background:'rgba(255,255,255,.18)',color:'#17345e',fontFamily:'inherit',fontSize:'clamp(8px,.68vw,11px)',fontWeight:800,padding:'3px 5px',boxSizing:'border-box',outline:'none',position:'relative',left:'1.35cm',transform:'none',zIndex:3,overflow:'hidden',direction:'ltr',textAlign:'left',fontVariantNumeric:'tabular-nums'},page4ReminderTime:{width:'100%',height:'100%',minWidth:0,border:0,borderRadius:8,background:'rgba(255,255,255,.18)',color:'#17345e',fontFamily:'inherit',fontSize:'clamp(8px,.68vw,11px)',fontWeight:800,padding:'3px 5px',boxSizing:'border-box',outline:'none',position:'relative',left:'1.35cm',transform:'none',zIndex:3,overflow:'hidden',direction:'ltr',textAlign:'left',fontVariantNumeric:'tabular-nums'},page4ReminderText:{width:'calc(100% - .35cm)',height:'23%',minHeight:24,border:0,borderBottom:'1px dashed rgba(91,77,114,.30)',borderRadius:7,background:'rgba(255,255,255,.12)',color:'#17345e',fontFamily:'inherit',fontSize:'clamp(8px,.68vw,11px)',fontWeight:800,padding:'4px 7px',boxSizing:'border-box',textAlign:'right',outline:'none',position:'relative',left:'-0.5cm',transform:'none',direction:'rtl'},page4ReminderToggleRow:{display:'flex',alignItems:'center',justifyContent:'center',gap:7,width:'100%',marginTop:2,direction:'rtl',position:'relative',left:'.5cm'},page4ReminderToggleLabel:{fontSize:'clamp(7px,.62vw,10px)',fontWeight:900,color:'#5b4d72',whiteSpace:'nowrap'},page4ReminderSwitch:{position:'relative',width:42,height:24,minWidth:42,padding:2,border:0,borderRadius:999,cursor:'pointer',background:'linear-gradient(135deg,#cbd5e1,#94a3b8)',boxShadow:'inset 0 2px 4px rgba(55,64,95,.22),0 3px 8px rgba(55,64,95,.16)',transition:'background .2s ease, box-shadow .2s ease'},page4ReminderSwitchThumb:{display:'block',width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 2px 5px rgba(55,64,95,.25)',transition:'transform .22s cubic-bezier(.2,.8,.2,1)'},
emptySpread:{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'clamp(18px,2vw,28px)',fontWeight:900,color:'#6b4c72',background:'linear-gradient(135deg,#fff5fb,#eef7ff)',direction:'rtl'},
spreadControls:{position:'absolute',left:'50%',transform:'translateX(-50%)',bottom:'10px',zIndex:40,display:'flex',justifyContent:'center',alignItems:'center',gap:7,flexWrap:'nowrap',pointerEvents:'auto',padding:'7px 14px',boxSizing:'border-box',background:'#fff0f7',border:'2px solid rgba(255,255,255,.98)',borderRadius:'999px',boxShadow:'0 7px 22px rgba(60,40,80,.16)',backdropFilter:'blur(8px)',maxWidth:'calc(100% - 28px)'},page3NavShape:{position:'absolute',left:'50%',bottom:'-1.2%',transform:'translateX(-50%)',width:'42%',minWidth:'250px',height:'48px',display:'flex',flexDirection:'row',direction:'ltr',alignItems:'center',justifyContent:'center',gap:6,padding:'3px 8px',boxSizing:'border-box',zIndex:12,clipPath:'polygon(6% 0,94% 0,100% 50%,94% 100%,6% 100%,0 50%)',background:'linear-gradient(135deg,rgba(255,247,251,.96),rgba(224,244,255,.96))',border:'1px solid rgba(255,255,255,.98)',boxShadow:'0 5px 16px rgba(60,40,80,.14)',pointerEvents:'auto'},symbolBtn:{width:22,height:22,minWidth:22,padding:0,border:0,borderRadius:'50%',background:'linear-gradient(135deg,#8fd9f3,#d78be8)',color:'#fff',fontSize:10,fontWeight:900,cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 8px rgba(90,60,120,.18)',fontFamily:'inherit'},
designEditor:{width:'50vw',height:'100vh',minHeight:'100vh',position:'relative',overflow:'hidden',background:'#f8e7f1',boxSizing:'border-box'},designEditorImage:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',display:'block',background:'#f8e7f1'},designEditorOverlay:{position:'absolute',inset:0,zIndex:4,pointerEvents:'none',overflow:'hidden'},designEditorDate:{position:'absolute',top:'25%',left:'9%',right:'9%',textAlign:'center',fontSize:'clamp(11px,1.05vw,18px)',fontWeight:900,color:'#17345e',textShadow:'0 1px 4px rgba(255,255,255,.9)'},designEditorTitle:{position:'absolute',top:'16%',left:'24%',right:'24%',border:0,outline:0,background:'rgba(255,255,255,.48)',borderRadius:16,padding:'8px 14px',textAlign:'center',fontFamily:'inherit',fontSize:'clamp(18px,2.5vw,34px)',fontWeight:900,color:'#17345e',pointerEvents:'auto'},designEditorText3:{position:'absolute',top:'33%',left:'10%',width:'45%',height:'43%',resize:'none',border:0,outline:0,background:'rgba(255,255,255,.10)',borderRadius:18,padding:'12px 18px',fontFamily:'inherit',fontSize:'clamp(14px,1.4vw,22px)',lineHeight:2.05,color:'#17345e',textAlign:'right',pointerEvents:'auto'},designEditorText4:{position:'absolute',top:'30%',left:'53%',width:'42%',height:'40%',resize:'none',border:0,outline:0,background:'rgba(255,255,255,.10)',borderRadius:18,padding:'12px 18px',fontFamily:'inherit',fontSize:'clamp(14px,1.35vw,21px)',lineHeight:2,color:'#17345e',textAlign:'right',pointerEvents:'auto'},designNavBtn:{background:'linear-gradient(135deg,#f7a8ca,#df5d9d)',border:'1px solid rgba(255,255,255,.95)',fontWeight:1000,color:'#fff',width:24,height:24,padding:0,fontSize:13,borderRadius:'50%',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 8px rgba(223,93,157,.16)'},designNextBtn:{background:'linear-gradient(135deg,#9edfff,#55b7ee)',border:'1px solid rgba(255,255,255,.95)',fontWeight:1000,color:'#fff',width:24,height:24,padding:0,fontSize:13,borderRadius:'50%',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 8px rgba(85,183,238,.16)'},home:{background:'linear-gradient(135deg,#b7eaff,#6ec9f2)',border:'1px solid rgba(255,255,255,.95)',fontWeight:1000,color:'#fff',width:40,height:40,minWidth:40,padding:0,fontSize:19,borderRadius:'50%',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 8px rgba(110,201,242,.16)'},toolbarAdd:{background:'linear-gradient(135deg,#ffb0d0,#e96aa5)',border:'1px solid rgba(255,255,255,.95)',fontWeight:1000,color:'#fff',width:24,height:24,padding:0,fontSize:14,borderRadius:'50%',whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 8px rgba(233,106,165,.16)'},indexDesignNav:{display:'flex',justifyContent:'center',marginTop:10},indexNextPage:{border:0,borderRadius:999,padding:'11px 20px',background:'linear-gradient(135deg,#9bd7ff,#5aa9ff)',color:'#fff',fontWeight:900,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 8px 20px rgba(90,169,255,.22)'},flipPageOverlay:{position:'absolute',inset:0,zIndex:20,pointerEvents:'none',perspective:1600,overflow:'hidden'},flipPageInner:{position:'absolute',inset:0,transformOrigin:'0% 100%',animation:'notePageFlip 900ms cubic-bezier(.2,.7,.2,1) forwards',transformStyle:'preserve-3d',background:'linear-gradient(135deg,#fffdf9,#f9e8f1)',boxShadow:'20px -8px 50px rgba(53,33,67,.28)',borderRadius:'0 22px 0 0'},flipPageBack:{position:'absolute',inset:0,backfaceVisibility:'hidden',background:'linear-gradient(145deg,rgba(255,255,255,.96),rgba(247,217,232,.92))',border:'1px solid rgba(120,80,110,.18)'},
card:{maxWidth:'min(1500px,96vw)',minHeight:'calc(100vh - 120px)',margin:'20px auto',padding:20,borderRadius:26,background:'linear-gradient(145deg,#fffaf5,#f8dfea)',border:'2px solid rgba(255,255,255,.8)',boxShadow:'0 18px 55px rgba(86,53,84,.22)',transition:'background .25s ease,border-color .25s ease,transform .85s cubic-bezier(.2,.75,.2,1)',position:'relative',overflow:'hidden',color:'#1c2d4f'},newPageCard:{animation:'newPageCardIn 850ms cubic-bezier(.2,.75,.2,1) both'},toolbar:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:15},titleInput:{width:'100%',boxSizing:'border-box',padding:13,borderRadius:14,border:'1px solid rgba(45,61,94,.12)',background:'rgba(255,255,255,.62)',color:'#1c2d4f',fontFamily:'inherit',fontSize:18,fontWeight:800,outline:'none',marginBottom:12},editor:{width:'100%',minHeight:420,boxSizing:'border-box',resize:'vertical',padding:16,borderRadius:16,border:'1px solid rgba(45,61,94,.12)',backgroundColor:'rgba(255,255,255,.58)',color:'#1c2d4f',fontFamily:'inherit',fontSize:15,lineHeight:2,outline:'none'},reminder:{marginTop:16,padding:15,borderRadius:16,background:'rgba(255,255,255,.46)',border:'1px solid rgba(45,61,94,.12)'},pageFooter:{marginTop:28,padding:'18px 14px 12px',borderTop:'2px solid',textAlign:'center',fontSize:14,fontWeight:800,lineHeight:2,display:'flex',alignItems:'center',justifyContent:'center',gap:14,textShadow:'0 2px 8px rgba(255,255,255,.5)',background:'rgba(255,255,255,.38)',borderRadius:16},footerIcon:{opacity:.9,fontSize:20},footerLabel:{fontSize:14,opacity:.95},footerQuote:{fontSize:16,fontWeight:900,lineHeight:2.1},floatingAdd:{position:'absolute',left:22,bottom:'max(92px, calc(env(safe-area-inset-bottom) + 78px))',width:58,height:58,borderRadius:'50%',border:'3px solid rgba(255,255,255,.95)',background:'linear-gradient(135deg,#ff72a5,#e84393)',color:'#fff',fontSize:34,lineHeight:1,cursor:'pointer',boxShadow:'0 10px 28px rgba(232,67,147,.35)',zIndex:12},newPageOverlay:{position:'absolute',inset:0,zIndex:11,pointerEvents:'none',perspective:1400,overflow:'hidden'},newPageOverlaySheet:{position:'absolute',inset:0,transformOrigin:'0% 100%',background:'linear-gradient(145deg,#fffaf5,#f7dbea)',borderRadius:'26px 26px 26px 0',boxShadow:'24px -10px 60px rgba(54,36,64,.22)',animation:'newPageSheetIn 850ms cubic-bezier(.2,.75,.2,1) forwards'},emojiPanel:{marginTop:10,padding:12,borderRadius:16,background:'rgba(255,255,255,.62)',border:'1px solid rgba(45,61,94,.12)'},emojiTitle:{fontSize:12,opacity:.75,marginBottom:9},emojiGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(42px,1fr))',gap:6,maxHeight:300,overflowY:'auto'},emoji:{width:40,height:40,borderRadius:10,border:'1px solid rgba(45,61,94,.10)',background:'rgba(255,255,255,.55)',fontSize:22,cursor:'pointer'},grid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:12},input:{display:'block',width:'100%',boxSizing:'border-box',marginTop:6,padding:10,borderRadius:10,border:'1px solid rgba(45,61,94,.12)',background:'rgba(255,255,255,.6)',color:'#1c2d4f',fontFamily:'inherit'},deleteModal:{width:'min(430px,calc(100% - 30px))',padding:30,borderRadius:24,textAlign:'center',background:'linear-gradient(145deg,#fffafd,#fff1f7)',color:'#1c2d4f',border:'2px solid rgba(255,255,255,.95)',boxShadow:'0 30px 90px rgba(0,0,0,.28)'},deleteIcon:{width:62,height:62,margin:'0 auto 10px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg,#ff7aa8,#d92f68)',color:'#fff',fontSize:28,fontWeight:1000,boxShadow:'0 10px 25px rgba(217,47,104,.25)'},deleteActions:{display:'flex',gap:10,justifyContent:'center'},cancelDelete:{flex:1,border:0,borderRadius:14,padding:'12px 15px',background:'#e8edf5',color:'#33415c',fontWeight:900,cursor:'pointer',fontFamily:'inherit'},confirmDelete:{flex:1,border:0,borderRadius:14,padding:'12px 15px',background:'linear-gradient(135deg,#ff6f9e,#cf2d63)',color:'#fff',fontWeight:900,cursor:'pointer',fontFamily:'inherit'},overlay:{position:'fixed',inset:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(33,24,43,.55)'},modal:{width:'min(450px,calc(100% - 30px))',padding:30,borderRadius:20,textAlign:'center',background:'#fff7fb',color:'#1c2d4f',border:'1px solid rgba(255,193,7,.35)',boxShadow:'0 25px 80px rgba(0,0,0,.25)'},close:{border:0,borderRadius:999,padding:'10px 18px',background:'#ff72a5',color:'#fff',fontWeight:800,cursor:'pointer'},empty:{padding:45,textAlign:'center',opacity:.65},
};


const NOTE_PAGE_ANIMATION_STYLES = `
/* === Natural book page turn — based on the supplied book video === */
.bookFlipStage{
  position:absolute;
  inset:1% 0 2% 0;
  z-index:55;
  pointer-events:none;
  perspective:2200px;
  transform-style:preserve-3d;
  overflow:visible;
}
.bookFlipSheet{
  position:absolute;
  top:0;
  bottom:0;
  width:50%;
  transform-style:preserve-3d;
  overflow:visible;
  will-change:transform;
  border-radius:0;
  background:transparent;
  filter:drop-shadow(0 12px 13px rgba(45,30,50,.16));
}
.bookFlipSheet.next{
  left:50%;
  right:auto;
  transform-origin:0% 50%;
  animation:realBookTurnNext 1280ms cubic-bezier(.2,.72,.2,1) both;
}
.bookFlipSheet.prev{
  left:0;
  right:auto;
  transform-origin:100% 50%;
  animation:realBookTurnPrev 1280ms cubic-bezier(.2,.72,.2,1) both;
}
.bookFlipFace{
  position:absolute;
  inset:0;
  backface-visibility:hidden;
  -webkit-backface-visibility:hidden;
  overflow:hidden;
  background:#fff;
  border-radius:0 24px 24px 0;
  transform-style:preserve-3d;
}
.bookFlipFace.front{
  transform:rotateY(0deg);
  box-shadow:inset 7px 0 12px rgba(60,40,70,.08);
}
.bookFlipFace.back{
  transform:rotateY(180deg);
  border-radius:24px 0 0 24px;
  background:linear-gradient(90deg,rgba(58,39,67,.12),rgba(255,255,255,.92) 14%,#fff 100%);
  box-shadow:inset -8px 0 15px rgba(60,40,70,.08);
}
.bookFlipFace img{
  width:100%;
  height:100%;
  display:block;
  object-fit:cover;
  user-select:none;
  -webkit-user-drag:none;
  pointer-events:none;
}
.bookFlipCurl{
  position:absolute;
  top:-.5%;
  bottom:-.5%;
  width:32%;
  z-index:4;
  pointer-events:none;
  opacity:.9;
  background:
    linear-gradient(90deg,
      rgba(255,255,255,0),
      rgba(255,255,255,.20) 24%,
      rgba(255,255,255,.62) 48%,
      rgba(45,28,55,.13) 70%,
      rgba(255,255,255,0));
  filter:blur(.65px);
  transform-origin:center;
}
.bookFlipSheet.next .bookFlipCurl{
  left:-5%;
  transform:skewY(-1.5deg);
}
.bookFlipSheet.prev .bookFlipCurl{
  right:-5%;
  transform:scaleX(-1) skewY(1.5deg);
}
.bookFlipEdgeShadow{
  position:absolute;
  top:0;
  bottom:0;
  width:11px;
  z-index:5;
  pointer-events:none;
  background:linear-gradient(90deg,rgba(45,25,55,.28),rgba(255,255,255,.02),rgba(45,25,55,.10));
  filter:blur(1.2px);
}
.bookFlipSheet.next .bookFlipEdgeShadow{left:-3px;}
.bookFlipSheet.prev .bookFlipEdgeShadow{right:-3px;}

@keyframes realBookTurnNext{
  0%{
    transform:rotateY(0deg) rotateX(0deg) translateZ(0);
    filter:drop-shadow(0 7px 9px rgba(45,30,50,.10));
  }
  12%{
    transform:rotateY(-13deg) rotateX(1deg) translate3d(0,-.4%,18px);
    filter:drop-shadow(8px 10px 13px rgba(45,30,50,.15));
  }
  30%{
    transform:rotateY(-38deg) rotateX(2.8deg) translate3d(1%,-.9%,52px);
    filter:drop-shadow(15px 13px 18px rgba(45,30,50,.19));
  }
  48%{
    transform:rotateY(-72deg) rotateX(4.2deg) translate3d(3%,-1.2%,78px);
    filter:drop-shadow(22px 17px 24px rgba(45,30,50,.23));
  }
  62%{
    transform:rotateY(-103deg) rotateX(4.8deg) translate3d(4%,-1.1%,82px);
    filter:drop-shadow(24px 18px 26px rgba(45,30,50,.24));
  }
  78%{
    transform:rotateY(-139deg) rotateX(3.2deg) translate3d(3%,-.7%,58px);
    filter:drop-shadow(17px 14px 20px rgba(45,30,50,.19));
  }
  91%{
    transform:rotateY(-166deg) rotateX(1.2deg) translate3d(1%,-.2%,25px);
    filter:drop-shadow(9px 10px 14px rgba(45,30,50,.14));
  }
  100%{
    transform:rotateY(-180deg) rotateX(0deg) translateZ(0);
    filter:drop-shadow(0 5px 8px rgba(45,30,50,.08));
  }
}
@keyframes realBookTurnPrev{
  0%{
    transform:rotateY(0deg) rotateX(0deg) translateZ(0);
    filter:drop-shadow(0 7px 9px rgba(45,30,50,.10));
  }
  12%{
    transform:rotateY(13deg) rotateX(1deg) translate3d(0,-.4%,-18px);
    filter:drop-shadow(-8px 10px 13px rgba(45,30,50,.15));
  }
  30%{
    transform:rotateY(38deg) rotateX(2.8deg) translate3d(-1%,-.9%,-52px);
    filter:drop-shadow(-15px 13px 18px rgba(45,30,50,.19));
  }
  48%{
    transform:rotateY(72deg) rotateX(4.2deg) translate3d(-3%,-1.2%,-78px);
    filter:drop-shadow(-22px 17px 24px rgba(45,30,50,.23));
  }
  62%{
    transform:rotateY(103deg) rotateX(4.8deg) translate3d(-4%,-1.1%,-82px);
    filter:drop-shadow(-24px 18px 26px rgba(45,30,50,.24));
  }
  78%{
    transform:rotateY(139deg) rotateX(3.2deg) translate3d(-3%,-.7%,-58px);
    filter:drop-shadow(-17px 14px 20px rgba(45,30,50,.19));
  }
  91%{
    transform:rotateY(166deg) rotateX(1.2deg) translate3d(-1%,-.2%,-25px);
    filter:drop-shadow(-9px 10px 14px rgba(45,30,50,.14));
  }
  100%{
    transform:rotateY(180deg) rotateX(0deg) translateZ(0);
    filter:drop-shadow(0 5px 8px rgba(45,30,50,.08));
  }
}

/* Cover: use the same paper-like depth when opening the notebook. */
.coverImageFlipping{
  transform:perspective(2200px) rotateY(-105deg) rotateX(2deg) translateZ(28px) !important;
  transform-origin:right center !important;
  filter:drop-shadow(18px 14px 24px rgba(45,30,50,.20));
}
`;

