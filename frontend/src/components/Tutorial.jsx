import React from 'react';

export default function Tutorial({ language = 'en', userType, onContinue, onSkip, onLanguageChange }) {
  const translations = {
    en: {
      title: 'Quick Start Guide',
      intro: 'To begin, upload a dermoscopic image, complete the metadata form, and run the analysis.',
      doctorNote: 'As a doctor, add the patient ID, include clinical imagery when available, then analyze the lesion.',
      personalNote: 'For personal use, upload a clear image and run the analysis for an exploratory screening.',
      stepsTitle: 'What to do next',
      step1: 'Upload at least one dermoscopic image. You may add a clinical image if available.',
      step2: 'Fill in the metadata fields on the left, such as lesion location and diagnosis.',
      step3: 'Click the button to analyze and view the AI results.',
      continue: 'Continue to App',
      skip: 'Skip Guide'
    },
    tr: {
      title: 'Hızlı Başlangıç Kılavuzu',
      intro: 'Başlamak için bir dermatoskopik görüntü yükleyin, meta veri formunu doldurun ve analizi çalıştırın.',
      doctorNote: 'Doktor olarak hasta kimliğini ekleyin, mevcutsa klinik görüntüleri dahil edin ve ardından lezyonu analiz edin.',
      personalNote: 'Bireysel kullanım için, net bir görüntü yükleyin ve keşif taraması için analizi çalıştırın.',
      stepsTitle: 'Sonraki adımlar',
      step1: 'En az bir dermatoskopik görüntü yükleyin. Mevcutsa klinik görüntü ekleyebilirsiniz.',
      step2: 'Sol taraftaki meta veri alanlarını doldurun; örneğin lezyon konumu ve tanı.',
      step3: 'AI sonuçlarını görüntülemek için analizi çalıştırma düğmesine tıklayın.',
      continue: 'Uygulamaya Devam Et',
      skip: 'Kılavuzu Atla'
    }
  };

  const t = translations[language] || translations.en;

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6">
      <div className="w-full max-w-3xl bg-slate-900/95 border border-white/10 rounded-3xl shadow-2xl p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-3">{t.title}</h1>
          <p className="text-sm text-slate-300 leading-7">{t.intro}</p>
          <p className="mt-4 text-sm text-slate-300 leading-7">
            {userType === 'doctor' ? t.doctorNote : t.personalNote}
          </p>
        </div>

        <div className="space-y-4 p-6 bg-slate-950/80 border border-white/10 rounded-3xl">
          <h2 className="text-xl font-semibold">{t.stepsTitle}</h2>
          <ol className="list-decimal list-inside space-y-2 text-slate-200">
            <li>{t.step1}</li>
            <li>{t.step2}</li>
            <li>{t.step3}</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-white/10 px-4 py-3">
            <span className="text-sm text-slate-300">Language:</span>
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${language === 'en' ? 'bg-brand-600 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('tr')}
              className={`px-3 py-2 rounded-lg text-sm font-medium ${language === 'tr' ? 'bg-brand-600 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}
            >
              Türkçe
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-end">
            <button
              onClick={onSkip}
              className="px-5 py-3 rounded-xl border border-white/20 bg-white/10 text-slate-100 hover:bg-white/15 transition"
            >
              {t.skip}
            </button>
            <button
              onClick={onContinue}
              className="px-5 py-3 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              {t.continue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
