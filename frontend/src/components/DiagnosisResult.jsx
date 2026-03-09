import React from 'react';
import { AlertCircle, CheckCircle, Info, Clipboard } from 'lucide-react';

export default function DiagnosisResult({ result, location, userType }) {
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
        alert("Clinical Note copied to clipboard.");
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
                {result ? (
                    <>
                        {/* Unified Prediction Display */}
                        <div className={`p-4 mb-3 rounded-xl border ${getResultColor(result.prediction)} flex items-center gap-4`}>
                            {result.prediction.toLowerCase().includes('malignant')
                                ? <AlertCircle className="shrink-0 w-12 h-12" />
                                : <CheckCircle className="shrink-0 w-12 h-12" />
                            }
                            <div>
                                <div className="text-sm font-bold uppercase opacity-60">AI Prediction</div>
                                <div className="text-base font-bold text-gray-800">{CLASS_NAME_MAP[result.prediction] || result.prediction}</div>
                            </div>
                            <div className="ml-auto text-right">
                                <div className="text-sm font-bold uppercase opacity-60">Confidence</div>
                                <div className="text-base font-bold text-gray-800">{result.confidence_score.toFixed(1)}%</div>
                            </div>
                        </div>

                        {/* Top Differential Class (moved up) */}
                        <div className="mb-3 flex items-center gap-4">
                            <div>
                                <div className="text-sm font-bold uppercase opacity-60">Top Differential Class</div>
                                <div className="text-base font-bold text-gray-800">{CLASS_NAME_MAP[result.details?.top_class] || result.details?.top_class}</div>
                            </div>
                            <div className="ml-auto text-right">
                                <div className="text-sm font-bold uppercase opacity-60">Probability</div>
                                <div className="text-base font-bold text-gray-800">{result.details?.top_prob?.toFixed(2)}%</div>
                            </div>
                        </div>

                        {/* Predictions Table */}
                        {sortedPredictions.length > 0 && (
                            userType === 'doctor' ? (
                                /* Flat table for doctors */
                                <div className="mb-6">
                                    <div className="text-sm font-bold uppercase opacity-60 mb-2">All Class Predictions</div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm text-left border rounded-lg">
                                            <thead>
                                                <tr className="bg-gray-100">
                                                    <th className="px-3 py-2 font-semibold">Class</th>
                                                    <th className="px-3 py-2 font-semibold">Probability (%)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedPredictions.map((pred) => (
                                                    <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-green-50 font-bold' : ''}>
                                                        <td className="px-3 py-2">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                        <td className="px-3 py-2">{pred.prob.toFixed(2)}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                /* Grouped tables for non-doctors */
                                <div className="mb-6 space-y-4">
                                    {/* Malignant group */}
                                    <div>
                                        <div className="text-sm font-bold uppercase text-red-600 mb-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" /> Malignant Risk Classes
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm text-left border border-red-200 rounded-lg">
                                                <thead>
                                                    <tr className="bg-red-50">
                                                        <th className="px-3 py-2 font-semibold">Class</th>
                                                        <th className="px-3 py-2 font-semibold">Probability (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {malignantPreds.map((pred) => (
                                                        <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-red-50 font-bold' : ''}>
                                                            <td className="px-3 py-2">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                            <td className="px-3 py-2">{pred.prob.toFixed(2)}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Benign group */}
                                    <div>
                                        <div className="text-sm font-bold uppercase text-green-600 mb-1 flex items-center gap-1">
                                            <CheckCircle className="w-3.5 h-3.5" /> Benign Classes
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm text-left border border-green-200 rounded-lg">
                                                <thead>
                                                    <tr className="bg-green-50">
                                                        <th className="px-3 py-2 font-semibold">Class</th>
                                                        <th className="px-3 py-2 font-semibold">Probability (%)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {benignPreds.map((pred) => (
                                                        <tr key={pred.class} className={pred.class === result.details?.top_class ? 'bg-green-50 font-bold' : ''}>
                                                            <td className="px-3 py-2">{CLASS_NAME_MAP[pred.class] || pred.class}</td>
                                                            <td className="px-3 py-2">{pred.prob.toFixed(2)}%</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
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
                    </>
                ) : (
                    <p className="text-gray-400">No result yet. Upload images and run diagnosis.</p>
                )}
            </div>
        </div>
    );
}
