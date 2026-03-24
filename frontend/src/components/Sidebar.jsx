import React from 'react';
import { Activity, MapPin, FileText } from 'lucide-react';

export default function Sidebar({
    language = 'en',
    location, setLocation,
    diagnosis, setDiagnosis,
    imageNotApplicable, setImageNotApplicable,
    showGroundTruth = true,
    ageGroup, setAgeGroup,
    sex, setSex,
    skinTone, setSkinTone,
    onLogoClick
}) {
    const translations = {
      en: {
        subtitle: 'Professional AI Diagnostics',
        lesionContext: 'Lesion Context',
        lesionLocation: 'Lesion Location',
        selectSite: 'Select Site...',
        ageGroup: 'Age Group',
        sex: 'Sex',
        skinTone: 'Skin Tone',
        preferNotDisclose: 'Prefer not to disclose',
        groundTruth: 'Ground Truth',
        unknownNone: 'Unknown / None',
        imageNotApplicable: 'Image unclear or not applicable',
        metadataHint: 'Entering complete metadata improves longitudinal tracking but is optional for efficient inference.',
        locationOptions: [
          { label: 'Head / Neck', value: 'head/neck' },
          { label: 'Arms / Hands (Upper)', value: 'upper_extremity' },
          { label: 'Legs / Feet (Lower)', value: 'lower_extremity' },
          { label: 'Torso (Chest/Back/Sides)', value: 'torso' },
          { label: 'Other / Unknown', value: 'other_unknown' }
        ],
        ageGroups: ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80-84','85-89','90-94','95+'],
        sexOptions: ['Male','Female','Other'],
        skinToneOptions: [
          {v: '0', label: '0 — Very dark'},
          {v: '1', label: '1 — Dark'},
          {v: '2', label: '2 — Medium dark'},
          {v: '3', label: '3 — Medium'},
          {v: '4', label: '4 — Light'},
          {v: '5', label: '5 — Very light'}
        ]
      },
      tr: {
        subtitle: 'Profesyonel AI Teşhisi',
        lesionContext: 'Lezyon Bağlamı',
        lesionLocation: 'Lezyon Konumu',
        selectSite: 'Alan Seçin...',
        ageGroup: 'Yaş Grubu',
        sex: 'Cinsiyet',
        skinTone: 'Cilt Tonu',
        preferNotDisclose: 'Açıklamak istemiyorum',
        groundTruth: 'Gerçek Değer',
        unknownNone: 'Bilinmiyor / Yok',
        imageNotApplicable: 'Görüntü belirsiz veya geçerli değil',
        metadataHint: 'Tam meta veri girmek uzun vadeli takibi iyileştirir, ancak verimli çıkarım için isteğe bağlıdır.',
        locationOptions: [
          { label: 'Baş / Boyun', value: 'head/neck' },
          { label: 'Kollar / Eller (Üst)', value: 'upper_extremity' },
          { label: 'Bacaklar / Ayaklar (Alt)', value: 'lower_extremity' },
          { label: 'Gövde (Göğüs/Sırt/Yanlar)', value: 'torso' },
          { label: 'Diğer / Bilinmiyor', value: 'other_unknown' }
        ],
        ageGroups: ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49','50-54','55-59','60-64','65-69','70-74','75-79','80-84','85-89','90-94','95+'],
        sexOptions: ['Erkek','Kadın','Diğer'],
        skinToneOptions: [
          {v: '0', label: '0 — Çok koyu'},
          {v: '1', label: '1 — Koyu'},
          {v: '2', label: '2 — Orta koyu'},
          {v: '3', label: '3 — Orta'},
          {v: '4', label: '4 — Açık'},
          {v: '5', label: '5 — Çok açık'}
        ]
      }
    };

    const t = translations[language] || translations.en;

    const AGE_GROUPS = t.ageGroups;
    const SEX_OPTIONS = t.sexOptions;
    const SKIN_TONES = t.skinToneOptions;
    const UNIFIED_LOCATIONS = t.locationOptions;

    return (
        <aside className="flex-shrink-0 w-80 bg-slate-900 text-white flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-700 bg-slate-950">
                <div
                className={`flex items-center gap-2 mb-1 ${onLogoClick ? 'cursor-pointer' : ''}`}
                onClick={onLogoClick}
            >
                    <Activity className="w-6 h-6 text-teal-400" />
                    <h1 className="text-xl font-bold tracking-tight text-white">SUDerm</h1>
                </div>
                <p className="text-xs text-slate-400">{t.subtitle}</p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="mb-4 text-xs font-semibold tracking-wider text-teal-400 uppercase">{t.lesionContext}</h2>
                <div className="space-y-5">
                    {/* Location */}
                    <div>
                        <label htmlFor="location-select" className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">
                            <MapPin className="w-4 h-4" /> {t.lesionLocation}
                        </label>
                        <select
                            id="location-select"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        >
                            <option value="">{t.selectSite}</option>
                            {UNIFIED_LOCATIONS.map((loc) => (
                                <option key={loc.value} value={loc.value}>{loc.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Demographics: Age / Sex / Skin tone */}
                    <div>
                        <label htmlFor="age-group-select" className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">{t.ageGroup}</label>
                        <select
                            id="age-group-select"
                            value={ageGroup || ''}
                            onChange={(e) => setAgeGroup && setAgeGroup(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        >
                            <option value="">{t.preferNotDisclose}</option>
                            {AGE_GROUPS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="sex-select" className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">{t.sex}</label>
                        <select
                            id="sex-select"
                            value={sex || ''}
                            onChange={(e) => setSex && setSex(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        >
                            <option value="">{t.preferNotDisclose}</option>
                            {SEX_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="skin-tone-select" className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">{t.skinTone}</label>
                        <select
                            id="skin-tone-select"
                            value={skinTone || ''}
                            onChange={(e) => setSkinTone && setSkinTone(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                        >
                            <option value="">{t.preferNotDisclose}</option>
                            {SKIN_TONES.map((tOpt) => (
                                <option key={tOpt.v} value={tOpt.v}>{tOpt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Diagnosis + "not applicable" checkbox */}
                    {showGroundTruth && (
                      <>
                        <div>
                            <label htmlFor="diagnosis-select" className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">
                                <FileText className="w-4 h-4" /> {t.groundTruth}
                            </label>
                            <select
                                id="diagnosis-select"
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                disabled={imageNotApplicable}
                                className={`w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none ${imageNotApplicable ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="">{t.unknownNone}</option>
                                <option value="MEL">Melanoma (MEL)</option>
                                <option value="NV">Melanocytic Nevus (NV)</option>
                                <option value="BCC">Basal Cell Carcinoma (BCC)</option>
                                <option value="AKIEC">Actinic Keratosis (AKIEC)</option>
                                <option value="SCCKA">Squamous Cell Carcinoma (SCCKA)</option>
                                <option value="BKL">Benign Keratosis (BKL)</option>
                                <option value="DF">Dermatofibroma (DF)</option>
                                <option value="VASC">Vascular Lesion (VASC)</option>
                                <option value="INF">Inflammatory (INF)</option>
                                <option value="BEN_OTH">Benign Other (BEN_OTH)</option>
                                <option value="MAL_OTH">Malignant Other (MAL_OTH)</option>
                            </select>
                        </div>

                        {/* Image Not Applicable Checkbox */}
                        <div className="mt-2">
                            <label htmlFor="image-not-applicable" className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    id="image-not-applicable"
                                    type="checkbox"
                                    checked={imageNotApplicable}
                                    onChange={(e) => {
                                        setImageNotApplicable(e.target.checked);
                                        if (e.target.checked) setDiagnosis('NOT_APPLICABLE');
                                        else setDiagnosis('');
                                    }}
                                    className="w-4 h-4 text-amber-500 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                                />
                                <span className="text-sm text-amber-400 group-hover:text-amber-300">
                                    {t.imageNotApplicable}
                                </span>
                            </label>
                        </div>
                      </>
                    )}
                </div>

                <div className="pt-6 mt-6 border-t border-slate-700">
                    <p className="text-xs leading-relaxed text-slate-500">
                        {t.metadataHint}
                    </p>
                </div>
            </div>
        </aside>
    );
}

