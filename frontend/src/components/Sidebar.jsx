import React from 'react';
import { Activity, MapPin, FileText } from 'lucide-react';

const UNIFIED_LOCATIONS = [
    { label: "Head / Neck", value: "head/neck" },
    { label: "Arms / Hands (Upper)", value: "upper_extremity" },
    { label: "Legs / Feet (Lower)", value: "lower_extremity" },
    { label: "Torso (Chest/Back/Sides)", value: "torso" },
    { label: "Other / Unknown", value: "other_unknown" }
];

export default function Sidebar({
    location, setLocation,
    diagnosis, setDiagnosis,
    imageNotApplicable, setImageNotApplicable,
    showGroundTruth = true,
    ageGroup, setAgeGroup,
    sex, setSex,
    skinTone, setSkinTone,
    onLogoClick
}) {
    // Age groups in 5-year bins
    const AGE_GROUPS = [
        '0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44','45-49',
        '50-54','55-59','60-64','65-69','70-74','75-79','80-84','85-89','90-94','95+'
    ];
    const SEX_OPTIONS = ['Male','Female','Other'];
    const SKIN_TONES = [
        {v: '0', label: '0 — Very dark'},
        {v: '1', label: '1 — Dark'},
        {v: '2', label: '2 — Medium dark'},
        {v: '3', label: '3 — Medium'},
        {v: '4', label: '4 — Light'},
        {v: '5', label: '5 — Very light'},
    ];
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
                <p className="text-xs text-slate-400">Professional AI Diagnostics</p>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                <h2 className="mb-4 text-xs font-semibold tracking-wider text-teal-400 uppercase">Lesion Context</h2>
                <div className="space-y-5">
                    {/* Location */}
                    <div>
                        <label className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">
                            <MapPin className="w-4 h-4" /> Lesion Location
                        </label>
                        <select
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-teal-500 focus:outline-none"
                        >
                            <option value="">Select Site...</option>
                            {UNIFIED_LOCATIONS.map((loc) => (
                                <option key={loc.value} value={loc.value}>{loc.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Demographics: Age / Sex / Skin tone */}
                    <div>
                        <label className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">Age Group</label>
                        <select
                            value={ageGroup || ''}
                            onChange={(e) => setAgeGroup && setAgeGroup(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-teal-500 focus:outline-none"
                        >
                            <option value="">Prefer not to disclose</option>
                            {AGE_GROUPS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">Sex</label>
                        <select
                            value={sex || ''}
                            onChange={(e) => setSex && setSex(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-teal-500 focus:outline-none"
                        >
                            <option value="">Prefer not to disclose</option>
                            {SEX_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">Skin Tone</label>
                        <select
                            value={skinTone || ''}
                            onChange={(e) => setSkinTone && setSkinTone(e.target.value)}
                            className="w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-teal-500 focus:outline-none"
                        >
                            <option value="">Prefer not to disclose</option>
                            {SKIN_TONES.map((t) => (
                                <option key={t.v} value={t.v}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Diagnosis + "not applicable" checkbox */}
                    {showGroundTruth && (
                      <>
                        <div>
                            <label className="flex items-center gap-2 mb-1 text-sm font-medium text-slate-300">
                                <FileText className="w-4 h-4" /> Ground Truth
                            </label>
                            <select
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                disabled={imageNotApplicable}
                                className={`w-full px-3 py-2 text-sm text-white transition-colors bg-slate-800 border border-slate-700 rounded-md focus:border-teal-500 focus:outline-none ${imageNotApplicable ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <option value="">Unknown / None</option>
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
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
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
                                    Image unclear or not applicable
                                </span>
                            </label>
                        </div>
                      </>
                    )}
                </div>

                <div className="pt-6 mt-6 border-t border-slate-700">
                    <p className="text-xs leading-relaxed text-slate-500">
                        Entering complete metadata improves longitudinal tracking but is optional for efficient inference.
                    </p>
                </div>
            </div>
        </aside>
    );
}
