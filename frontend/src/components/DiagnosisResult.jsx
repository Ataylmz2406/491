import React from 'react';
import { AlertCircle, CheckCircle, Info, Clipboard } from 'lucide-react';

export default function DiagnosisResult({ result, location, userType, loading, showToast }) {
    // ...existing code...
    // Mapping from abbreviation to full name
    const CLASS_NAME_MAP = {
        "AKIEC": "Actinic keratosis / intraepidermal carcinoma",
        "BCC": "Basal cell carcinoma",
        "BEN_OTH": "Other benign proliferations, including collision tumors",
        "BKL": "Benign keratinocytic lesion",
        "DF": "Dermatofibroma",
        "INF": "Inflammatory and infectious conditions",
        "MAL_OTH": "Other malignant proliferations, including collision tumors",
        "MEL": "Melanoma",
        "NV": "Melanocytic nevus",
        "SCCKA": "Squamous cell carcinoma / keratoacanthoma",
        "VASC": "Vascular lesions and hemorrhage"
    };

    const copyClinicalNote = () => {
        if (!result) return;
        const note = `
SUDerm CLINICAL REPORT - SABANCI UNIVERSITY
-------------------------------------------
LOCATION: ${location || "Unspecified"}
IMAGE STATUS: ${result.metadata?.zoom_check && result.metadata.zoom_check !== 'OK' && result.metadata.zoom_check !== 'N/A' ? "Warning: Low Res/Square" : "Validated"}
AI ASSESSMENT: ${result.prediction} (${result.confidence_score.toFixed(1)}% Confidence)
TOP DIFFERENTIAL: ${result.details?.top_class}
XAI HEATMAP: ${result.grad_cam_url || "Not generated"}
    `.trim();

        navigator.clipboard.writeText(note);
        if (showToast) {
            showToast("Clinical Note copied to clipboard.");
        } else {
            alert("Clinical Note copied to clipboard.");
        }
    };

    const getResultColor = (pred) => {
        if (pred?.toLowerCase().includes('malignant') || pred?.toLowerCase().includes('risk')) {
            return 'text-red-700 bg-red-50 border-red-200';
        }
        return 'text-green-700 bg-green-50 border-green-200';
    };

    // Malignant class set (matches backend)
    const MALIGNANT_CLASSES = new Set(['MEL', 'BCC', 'SCCKA', 'AKIEC', 'MAL_OTH']);

    // Sort predictions by probability descending
    const sortedPredictions = result?.details?.all_predictions
        ? [...result.details.all_predictions].sort((a, b) => b.prob - a.prob)
        : [];

    // Split into Malignant and Benign groups, each sorted descending
    const malignantPreds = sortedPredictions.filter(p => MALIGNANT_CLASSES.has(p.class));
    const benignPreds = sortedPredictions.filter(p => !MALIGNANT_CLASSES.has(p.class));

    return (
        <div className="mt-2 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-2xl animate-fade-in">
            <div className="p-4">
                <h3 className="mb-3 text-lg font-bold text-gray-900">Diagnosis Result</h3>
                
                {loading ? (
                    <div className="space-y-4 animate-fade-in-up">
                        <div className="h-20 rounded-xl skeleton" />
                        <div className="flex gap-4">
                            <div className="h-12 w-full rounded-lg skeleton" />
                            <div className="h-12 w-1/3 rounded-lg skeleton" />
                        </div>
                        <div className="h-48 rounded-lg skeleton mt-4" />
                    </div>
                ) : result ? (
                    <div aria-live="polite">
                        {/* AI Prediction Section */}
                        <div className={`p-4 mb-3 rounded-xl border ${getResultColor(result.prediction)} flex items-center gap-4`}>
                            {result.prediction.toLowerCase().includes('malignant')
                                ? <AlertCircle className="shrink-0 w-12 h-12" />
                                : <CheckCircle className="shrink-0 w-12 h-12" />
                            }
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold uppercase opacity-60">AI Prediction</div>
                                <div className="text-base font-bold text-gray-800 truncate">{CLASS_NAME_MAP[result.prediction] || result.prediction}</div>
                            </div>
                            <div className="flex flex-col items-end" style={{minWidth: '110px'}}>
                                <div className="text-sm font-bold uppercase opacity-60">Confidence</div>
                                <div className="text-base font-bold text-gray-800">{result.confidence_score.toFixed(1)}%</div>
                            </div>
                        </div>

                        {/* Top Differential Class Section */}
                        <div className="mb-3 flex items-center gap-4 px-4">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold uppercase opacity-60">Top Differential Class</div>
                                <div className="text-base font-bold text-gray-800 truncate">{CLASS_NAME_MAP[result.details?.top_class] || result.details?.top_class}</div>
                            </div>
                            <div className="flex flex-col items-end" style={{minWidth: '110px'}}>
                                <div className="text-sm font-bold uppercase opacity-60">Probability</div>
                                <div className="text-base font-bold text-gray-800">{result.details?.top_prob?.toFixed(2)}%</div>
                            </div>
                        </div>

                        {/* All Class Predictions Table */}
                        {sortedPredictions.length > 0 && (
                            userType === 'doctor' ? (
                                <div className="mb-6 px-4">
                                    <div className="text-sm font-bold uppercase opacity-60 mb-2">All Class Predictions</div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left border rounded-lg">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="px-3 py-2 font-semibold">Class</th>
                                                    <th className="px-3 py-2 font-semibold text-right" style={{minWidth: '110px'}}>Probability (%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedPredictions.map((pred) => (
                                                    <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-green-50 font-bold' : ''}>
                                                        <td className="px-3 py-2">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                        <td className="px-3 py-2 text-right" style={{minWidth: '110px'}}>{pred.prob.toFixed(2)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4 px-4">
                                    <table className="w-full text-sm text-left border rounded-lg">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="px-3 py-1.5 font-semibold">Class</th>
                                                <th className="px-3 py-1.5 font-semibold text-right" style={{minWidth: '110px'}}>Probability (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Malignant section */}
                                            <tr><td colSpan="2" className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold uppercase"><AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5" />Malignant</td></tr>
                                            {malignantPreds.map((pred) => (
                                                <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-red-50 font-bold' : ''}>
                                                    <td className="px-3 py-1.5">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                    <td className="px-3 py-1.5 text-right" style={{minWidth: '110px'}}>{pred.prob.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                            {/* Benign section */}
                                            <tr><td colSpan="2" className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase"><CheckCircle className="w-3 h-3 inline mr-1 -mt-0.5" />Benign</td></tr>
                                            {benignPreds.map((pred) => (
                                                <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-green-50 font-bold' : ''}>
                                                    <td className="px-3 py-1.5">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                    <td className="px-3 py-1.5 text-right" style={{minWidth: '110px'}}>{pred.prob.toFixed(2)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}

                        {/* Clinical Intelligence Card */}
                        {result?.metadata?.zoom_check && result.metadata.zoom_check !== 'OK' && result.metadata.zoom_check !== 'N/A' && (
                            <div className="flex items-start gap-3 p-4 mt-6 border rounded-lg bg-amber-50 border-amber-200">
                                <Info className="w-5 h-5 text-amber-600 mt-0.5" />
                                <div className="text-sm text-amber-800">
                                    <p className="mb-1 font-bold uppercase">Optical Quality Warning</p>
                                    {result.metadata.zoom_check}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-gray-400">No result yet. Upload images and run diagnosis.</p>
                )}
            </div>
        </div>
    );
}
