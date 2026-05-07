import React from 'react';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * ConfidenceVisualization Component
 * Shows confidence score with visual feedback and recommendations
 */
export default function ConfidenceVisualization({ confidence, language = 'en' }) {
  const texts = {
    en: {
      confidence: 'Confidence Level',
      high: 'HIGH',
      moderate: 'MODERATE',
      low: 'LOW',
      veryHigh: 'VERY HIGH',
      recommendation_high: 'Strong model match. Review clinically before acting.',
      recommendation_moderate: 'Review differential diagnoses carefully.',
      recommendation_low: 'Recommend second opinion or biopsy.',
      recommendation_very_high: 'Very strong model match. Confirm clinically before acting.',
      similar: 'Similar Cases',
      cases: 'cases',
      matchStrength: 'Match Strength',
    },
    tr: {
      confidence: 'Güven Seviyesi',
      high: 'YÜKSEK',
      moderate: 'ORTA',
      low: 'DÜŞÜK',
      veryHigh: 'ÇOK YÜKSEK',
      recommendation_high: 'Güçlü model eşleşmesi. İşlemden önce klinik olarak gözden geçirin.',
      recommendation_moderate: 'Farklı teşhisleri dikkatle gözden geçirin.',
      recommendation_low: 'İkinci görüş veya biyopsi önerilir.',
      recommendation_very_high: 'Çok güçlü model eşleşmesi. İşlemden önce klinik olarak doğrulayın.',
      similar: 'Benzer Vakalar',
      cases: 'vaka',
      matchStrength: 'Eşleşme Gücü',
    },
  };

  const t = texts[language] || texts.en;

  if (confidence === null || confidence === undefined) {
    return null;
  }

  // Determine confidence level
  const getConfidenceLevel = () => {
    if (confidence >= 90) return { level: 'veryHigh', color: 'green', icon: '✓✓' };
    if (confidence >= 80) return { level: 'high', color: 'green', icon: '✓' };
    if (confidence >= 60) return { level: 'moderate', color: 'amber', icon: '⚠' };
    return { level: 'low', color: 'red', icon: '!' };
  };

  // Get similar cases count (mock - would come from backend)
  const getSimilarCasesCount = () => {
    const baseCases = 200;
    return Math.floor(baseCases * (confidence / 100));
  };

  const confidenceLevel = getConfidenceLevel();
  const similarCases = getSimilarCasesCount();
  const percentage = confidence.toFixed(1);

  const colorClasses = {
    green: {
      bg: 'bg-green-100',
      border: 'border-green-300',
      bar: 'bg-green-500',
      text: 'text-green-700',
    },
    amber: {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      bar: 'bg-amber-500',
      text: 'text-amber-700',
    },
    red: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      bar: 'bg-red-500',
      text: 'text-red-700',
    },
  };

  const colors = colorClasses[confidenceLevel.color];

  return (
    <div className={`p-6 rounded-2xl border-2 ${colors.bg} ${colors.border} space-y-4`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-600 uppercase tracking-wider">
            {t.confidence}
          </p>
          <p className={`text-3xl font-bold mt-1 ${colors.text}`}>
            {percentage}%
          </p>
        </div>
        <div className={`p-4 rounded-full ${colors.bg} ${colors.border} border-2`}>
          {confidenceLevel.color === 'green' ? (
            <CheckCircle className={`w-10 h-10 ${colors.text}`} />
          ) : confidenceLevel.color === 'amber' ? (
            <AlertCircle className={`w-10 h-10 ${colors.text}`} />
          ) : (
            <AlertCircle className={`w-10 h-10 ${colors.text}`} />
          )}
        </div>
      </div>

      {/* Confidence Level Badge */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full font-bold text-sm ${colors.bg} ${colors.text}`}>
          {t[confidenceLevel.level]}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600 uppercase">{t.matchStrength}</p>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Similar Cases Info */}
      <div className={`p-3 rounded-lg ${colors.bg}`}>
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-5 h-5 ${colors.text}`} />
          <div>
            <p className="text-xs font-semibold text-gray-600">{t.similar}</p>
            <p className={`text-lg font-bold ${colors.text}`}>
              {similarCases}+ {t.cases}
            </p>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className={`p-4 rounded-lg bg-white border ${colors.border} space-y-1`}>
        <p className="text-xs font-bold text-gray-600 uppercase">{t.matchStrength}</p>
        <p className={`text-sm font-medium ${colors.text}`}>
          {t[`recommendation_${confidenceLevel.level}`]}
        </p>
      </div>

      {/* Thresholds explanation */}
      <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-gray-300">
        <p><span className="font-semibold">90%+:</span> Very high confidence - clinically verify before acting</p>
        <p><span className="font-semibold">80-89%:</span> High confidence - verify differential</p>
        <p><span className="font-semibold">60-79%:</span> Moderate - review differential carefully</p>
        <p><span className="font-semibold">&lt;60%:</span> Low confidence - seek second opinion</p>
      </div>
    </div>
  );
}
