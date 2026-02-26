import React from 'react';
import { AlertCircle, CheckCircle, Info, Clipboard } from 'lucide-react';

export default function DiagnosisResult({ result, location }) {
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

    if (!result) return null;

    return (
        <div className="mt-8 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-2xl animate-fade-in">
            <div className="p-8">
                <h3 className="mb-6 text-lg font-bold text-gray-900">Diagnosis Result</h3>

                {/* Unified Prediction Display */}
                <div className={`p-6 mb-6 rounded-xl border ${getResultColor(result.prediction)} flex items-center gap-4`}>
                    {result.prediction.toLowerCase().includes('malignant')
                        ? <AlertCircle className="shrink-0 w-12 h-12" />
                        : <CheckCircle className="shrink-0 w-12 h-12" />
                    }
                    <div>
                        <div className="text-xs font-bold uppercase opacity-60">AI Prediction</div>
                        <div className="text-base font-bold text-gray-800">{result.prediction}</div>
                    </div>
                    <div className="ml-auto text-right">
                        <div className="text-xs font-bold uppercase opacity-60">Confidence</div>
                        <div className="text-base font-bold text-gray-800">{result.confidence_score.toFixed(1)}%</div>
                    </div>
                </div>

                {/* All Predictions Table */}
                {result.details?.all_predictions && (
                    <div className="mb-6">
                        <div className="text-xs font-bold uppercase opacity-60 mb-2">All Class Predictions</div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm text-left border rounded-lg">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="px-3 py-2 font-semibold">Class</th>
                                        <th className="px-3 py-2 font-semibold">Probability (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.details.all_predictions.map((pred, idx) => (
                                        <tr key={pred.class} className={pred.class === result.prediction ? 'bg-green-50 font-bold' : ''}>
                                            <td className="px-3 py-2">{pred.class}</td>
                                            <td className="px-3 py-2">{pred.prob.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-500">Top Differential Class</span>
                        <div className="text-xl font-bold text-slate-800 mt-1">{result.details?.top_class}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-500">Class Probability</span>
                        <div className="text-xl font-mono font-bold text-slate-600 mt-1">{result.details?.top_prob?.toFixed(2)}%</div>
                    </div>
                </div>

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

                {/* Copy Report Button */}
                <button
                    onClick={copyClinicalNote}
                    className="flex items-center justify-center w-full gap-2 px-4 py-3 mt-6 text-sm font-semibold text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 active:bg-gray-100"
                >
                    <Clipboard className="w-4 h-4" /> Copy Clinical Report
                </button>
            </div>
        </div>
    );
}
